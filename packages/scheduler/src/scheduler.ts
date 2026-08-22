/**
 * Concrete DAG Scheduler implementation.
 * Enforces DAG dependency ordering, priority aging for anti-starvation (RFC-0007a),
 * bounded dispatch queues, and cooperative cancellation propagation.
 */

import { randomUUID } from 'node:crypto';
import { ExecutionPlan, ICancellationToken, PlanNode, PlanEdge, SubsystemHealth, TaskContext, UUID, asUUID, AgyError } from '@agy/shared';
import { IEventBus } from '@agy/event-bus';
import { IRuntimeState } from '@agy/runtime-state';
import { IPolicyEngine } from '@agy/policy';
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
  policyEngine?: IPolicyEngine;
  agingFactorMs?: number;
  /**
   * Maximum nodes dispatched concurrently per tick. Defaults to Infinity (all
   * ready nodes). When finite, ready nodes in excess wait and are ordered by
   * manifest priority plus waiting-time aging (SRC-8, SRC-9).
   */
  maxConcurrentDispatch?: number;
}

const PRIORITY_WEIGHTS: Record<string, number> = {
  critical: 1000,
  high: 500,
  medium: 100,
  low: 10,
};

export class Scheduler implements IScheduler {
  public readonly id: UUID = asUUID('scheduler');

  public async start(): Promise<void> {
    await this.boot();
  }

  public async stop(): Promise<void> {
    await this.shutdown();
  }

  public async getHealth(): Promise<SubsystemHealth> {
    return Promise.resolve(this.health());
  }

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
  private _maxConcurrentDispatch = Infinity;
  private _nodeEnqueueTime = new Map<UUID, number>();
  private _eventBus?: IEventBus;
  private _runtimeState?: IRuntimeState;
  private _policyEngine?: IPolicyEngine;

  constructor(options: SchedulerOptions = {}) {
    this._eventBus = options.eventBus;
    this._runtimeState = options.runtimeState;
    this._policyEngine = options.policyEngine;
    if (options.agingFactorMs) {
      this._agingFactorMs = options.agingFactorMs;
    }
    if (typeof options.maxConcurrentDispatch === 'number') {
      this._maxConcurrentDispatch = options.maxConcurrentDispatch;
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
        id: asUUID(randomUUID()),
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
    this.cleanupPlanExecutionResources(planId);

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
        this.cleanupPlanExecutionResources(planId);
        if (this._runtimeState) {
          await this._runtimeState.untrackPlan(planId);
        }
        continue;
      }

      const now = Date.now();
      const taskQueue: QueuedTask[] = readyNodes.map((node) => {
        // Record per-node first-ready time so waiting-time aging is meaningful
        // (SRC-9) instead of identical for every node in a plan.
        if (!this._nodeEnqueueTime.has(node.nodeId)) {
          this._nodeEnqueueTime.set(node.nodeId, now);
        }
        return {
          taskId: asUUID(randomUUID()),
          node,
          planId: asUUID(planId),
          queuedAt: this._nodeEnqueueTime.get(node.nodeId)!,
          // Derive dispatch priority from the skill manifest (SRC-8) instead of
          // the previous id.startsWith('sec') heuristic.
          basePriority: PRIORITY_WEIGHTS[node.priority ?? 'medium'] ?? 100,
        };
      });

      taskQueue.sort((a, b) => {
        const effA = a.basePriority + (now - a.queuedAt) / this._agingFactorMs;
        const effB = b.basePriority + (now - b.queuedAt) / this._agingFactorMs;
        return effB - effA;
      });

      // Bound fan-out: dispatch at most maxConcurrentDispatch ready nodes this
      // tick; the rest remain ready and age until a later tick.
      const dispatchable = taskQueue.slice(0, this._maxConcurrentDispatch);
      const promises = this._inFlightPromises.get(planId) || [];

      for (const item of dispatchable) {
        if (item.node.state === 'running') continue;

        item.node.state = 'running';
        const cancellationToken = this._planTokens.get(planId) || new SimpleCancellationToken();

        // When a policy engine is available, mint a real, registered lease for
        // the node's required capabilities so the executor can enforce it
        // (SRC-5). Otherwise fall back to an unregistered placeholder lease.
        const ttl = item.node.limits.maxDurationMs || 60000;
        const lease = this._policyEngine
          ? await this._policyEngine.issueLease(
              item.node.skillRef.id,
              item.node.requiredCapabilities ?? [],
              ttl
            )
          : {
              leaseId: asUUID(randomUUID()),
              subject: item.node.skillRef.id,
              capabilities: [],
              issuedAt: now,
              expiresAt: now + ttl,
              revoked: false,
            };

        const taskContext: TaskContext = {
          taskId: item.taskId,
          nodeId: item.node.nodeId,
          planId: item.planId,
          lease,
          cancellationToken,
        };

        dispatchedCount++;

        const p = this._dispatcher(taskContext, item.node)
          .then(async () => {
            item.node.state = 'done';
            completed.add(item.node.nodeId);
            if (plan.status === 'running' && completed.size === plan.nodes.length) {
              plan.status = 'completed';
              this.cleanupPlanExecutionResources(planId);
              if (this._runtimeState) {
                await this._runtimeState.untrackPlan(planId);
              }
            }
          })
          .catch(async (err) => {
            console.error(`Error executing task ${item.taskId} on skill ${item.node.skillRef.id}:`, err);
            item.node.state = 'error';
            plan.status = 'failed';
            // Cancel other tasks in this plan
            const token = this._planTokens.get(planId);
            if (token) {
              token.cancel();
            }
            this.cleanupPlanExecutionResources(planId);
            if (this._runtimeState) {
              await this._runtimeState.untrackPlan(planId);
            }
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

  private cleanupPlanExecutionResources(planId: UUID): void {
    this._planTokens.delete(planId);
    this._nodeCompletion.delete(planId);
    this._inFlightPromises.delete(planId);
    for (const nodeId of this._nodeEnqueueTime.keys()) {
      this._nodeEnqueueTime.delete(nodeId);
    }
  }

  private findReadyNodes(plan: ExecutionPlan, completed: Set<UUID>): PlanNode[] {
    const ready: PlanNode[] = [];

    for (const node of plan.nodes) {
      if (node.state === 'done' || node.state === 'running' || node.state === 'error') {
        continue;
      }

      const incoming = plan.edges.filter((e: PlanEdge) => e.toNodeId === node.nodeId && e.kind === 'ordering');
      const satisfied = incoming.every((e: PlanEdge) => completed.has(e.fromNodeId));

      if (satisfied) {
        ready.push(node);
      }
    }

    return ready;
  }
}
