/**
 * Concrete DAG Scheduler implementation.
 * Enforces DAG dependency ordering, priority aging for anti-starvation (RFC-0007a),
 * bounded dispatch queues, and cooperative cancellation propagation.
 */

import { randomUUID } from 'node:crypto';
import {
  ExecutionPlan,
  ICancellationToken,
  PlanNode,
  SubsystemHealth,
  TaskContext,
  UUID,
  AgyError,
} from '@agy/shared';
import { IEventBus } from '@agy/event-bus';
import { IRuntimeState } from '@agy/runtime-state';
import { IScheduler, TaskDispatcher } from './interfaces.js';

interface QueuedTask {
  taskId: UUID;
  node: PlanNode;
  planId: UUID;
  queuedAt: number;
  basePriority: number;
}

class SimpleCancellationToken implements ICancellationToken {
  public isCancellationRequested = false;
  private _callbacks: (() => void)[] = [];

  public cancel(): void {
    this.isCancellationRequested = true;
    for (const cb of this._callbacks) {
      cb();
    }
  }

  public onCancelled(callback: () => void): void {
    if (this.isCancellationRequested) {
      callback();
    } else {
      this._callbacks.push(callback);
    }
  }
}

export interface SchedulerOptions {
  eventBus?: IEventBus;
  runtimeState?: IRuntimeState;
  agingFactorMs?: number;
}

export class Scheduler implements IScheduler {
  public readonly name = 'scheduler';
  private _plans = new Map<UUID, ExecutionPlan>();
  private _planTokens = new Map<UUID, SimpleCancellationToken>();
  private _nodeCompletion = new Map<UUID, Set<UUID>>();
  private _inFlightPromises = new Map<UUID, Promise<void>[]>();
  private _dispatcher?: TaskDispatcher;
  private _accepting = true;
  private _isReady = false;
  private _bootTime = 0;
  private _agingFactorMs = 5000;
  private _eventBus?: IEventBus;
  private _runtimeState?: IRuntimeState;

  constructor(options: SchedulerOptions = {}) {
    this._eventBus = options.eventBus;
    this._runtimeState = options.runtimeState;
    if (options.agingFactorMs) {
      this._agingFactorMs = options.agingFactorMs;
    }
  }

  public async boot(): Promise<void> {
    this._isReady = true;
    this._accepting = true;
    this._bootTime = Date.now();
  }

  public async shutdown(): Promise<void> {
    this.stopAccepting();
    this._isReady = false;
  }

  public stopAccepting(): void {
    this._accepting = false;
  }

  public health(): SubsystemHealth {
    return {
      status: this._isReady ? 'healthy' : 'unhealthy',
      uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0,
    };
  }

  public registerDispatcher(dispatcher: TaskDispatcher): void {
    this._dispatcher = dispatcher;
  }

  public async submit(plan: ExecutionPlan): Promise<UUID> {
    if (!this._isReady) {
      throw new AgyError('Scheduler is not ready', {
        code: 'SCHEDULER_NOT_READY',
        subsystem: 'scheduler',
        retryable: false,
      });
    }
    if (!this._accepting) {
      throw new AgyError('Scheduler is currently draining and not accepting new plans', {
        code: 'SCHEDULER_DRAINING',
        subsystem: 'scheduler',
        retryable: false,
      });
    }

    plan.status = 'running';
    this._plans.set(plan.planId, plan);
    this._planTokens.set(plan.planId, new SimpleCancellationToken());
    this._nodeCompletion.set(plan.planId, new Set());
    this._inFlightPromises.set(plan.planId, []);

    if (this._runtimeState) {
      await this._runtimeState.trackPlan(plan.planId);
    }

    if (this._eventBus) {
      await this._eventBus.publish('scheduler.plan.submitted', {
        id: randomUUID(),
        topic: 'scheduler.plan.submitted',
        key: plan.planId,
        payload: { planId: plan.planId, nodeCount: plan.nodes.length },
        timestamp: Date.now(),
      });
    }

    return plan.planId;
  }

  public async cancel(planId: UUID): Promise<boolean> {
    const plan = this._plans.get(planId);
    if (!plan) return false;

    plan.status = 'cancelled';
    const token = this._planTokens.get(planId);
    if (token) {
      token.cancel();
    }

    if (this._runtimeState) {
      await this._runtimeState.untrackPlan(planId);
    }

    return true;
  }

  public getPlanStatus(planId: UUID): string | null {
    const plan = this._plans.get(planId);
    return plan ? plan.status : null;
  }

  public async tick(): Promise<number> {
    if (!this._isReady || !this._dispatcher) return 0;

    let dispatchedCount = 0;

    for (const [planId, plan] of this._plans.entries()) {
      if (plan.status !== 'running') continue;

      const completed = this._nodeCompletion.get(planId)!;
      const readyNodes = this.findReadyNodes(plan, completed);

      if (readyNodes.length === 0 && completed.size === plan.nodes.length) {
        plan.status = 'completed';
        if (this._runtimeState) {
          await this._runtimeState.untrackPlan(planId);
        }
        continue;
      }

      const now = Date.now();
      const taskQueue: QueuedTask[] = readyNodes.map((node) => ({
        taskId: randomUUID(),
        node,
        planId,
        queuedAt: plan.createdAt,
        basePriority: node.skillRef.id.startsWith('sec') ? 500 : 100,
      }));

      taskQueue.sort((a, b) => {
        const effA = a.basePriority + (now - a.queuedAt) / this._agingFactorMs;
        const effB = b.basePriority + (now - b.queuedAt) / this._agingFactorMs;
        return effB - effA;
      });

      const promises = this._inFlightPromises.get(planId) || [];

      for (const item of taskQueue) {
        if (item.node.state === 'running') continue;

        item.node.state = 'running';
        const cancellationToken = this._planTokens.get(planId) || new SimpleCancellationToken();

        const taskContext: TaskContext = {
          taskId: item.taskId,
          nodeId: item.node.nodeId,
          planId: item.planId,
          lease: {
            leaseId: randomUUID(),
            subject: item.node.skillRef.id,
            capabilities: [],
            issuedAt: now,
            expiresAt: now + (item.node.limits.maxDurationMs || 60000),
            revoked: false,
          },
          cancellationToken,
        };

        dispatchedCount++;

        const p = this._dispatcher(taskContext, item.node)
          .then(async () => {
            item.node.state = 'done';
            completed.add(item.node.nodeId);
            if (completed.size === plan.nodes.length) {
              plan.status = 'completed';
              if (this._runtimeState) {
                await this._runtimeState.untrackPlan(planId);
              }
            }
          })
          .catch((err) => {
            console.error(`Error executing task ${item.taskId} on skill ${item.node.skillRef.id}:`, err);
            item.node.state = 'error';
          });

        promises.push(p);
      }

      // Await in-flight tasks for synchronous settling
      if (promises.length > 0) {
        await Promise.allSettled(promises);
      }
    }

    return dispatchedCount;
  }

  private findReadyNodes(plan: ExecutionPlan, completed: Set<UUID>): PlanNode[] {
    const ready: PlanNode[] = [];

    for (const node of plan.nodes) {
      if (node.state === 'done' || node.state === 'running' || node.state === 'error') {
        continue;
      }

      const incoming = plan.edges.filter((e) => e.toNodeId === node.nodeId && e.kind === 'ordering');
      const satisfied = incoming.every((e) => completed.has(e.fromNodeId));

      if (satisfied) {
        ready.push(node);
      }
    }

    return ready;
  }
}
