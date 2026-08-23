/**
 * Validating, priority-aware asynchronous DAG scheduler.
 * Rejects malformed/deadlocked plans and preserves terminal lifecycle states.
 */

import { randomUUID } from 'node:crypto';
import { ArtifactEnvelope, ExecutionPlan, ICancellationToken, PlanNode, SubsystemHealth, TaskContext, UUID, asUUID, AgyError } from '@agy/shared';
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
  private _callbacks = new Set<() => void>();

  public cancel(): void {
    if (this.isCancellationRequested) return;
    this.isCancellationRequested = true;
    const callbacks = [...this._callbacks];
    this._callbacks.clear();
    for (const callback of callbacks) callback();
  }

  public onCancelled(callback: () => void): () => void {
    if (this.isCancellationRequested) { callback(); return () => undefined; }
    this._callbacks.add(callback);
    return () => this._callbacks.delete(callback);
  }
}

export interface SchedulerOptions {
  eventBus?: IEventBus;
  runtimeState?: IRuntimeState;
  policyEngine?: IPolicyEngine;
  agingFactorMs?: number;
  maxConcurrentDispatch?: number;
  shutdownTimeoutMs?: number;
}

const PRIORITY_WEIGHTS: Record<string, number> = { critical: 1000, high: 500, medium: 100, low: 10 };

export class Scheduler implements IScheduler {
  public readonly id: UUID = asUUID('scheduler');
  public readonly name = 'scheduler';
  private _plans = new Map<UUID, ExecutionPlan>();
  private _planTokens = new Map<UUID, SimpleCancellationToken>();
  private _nodeCompletion = new Map<UUID, Set<UUID>>();
  private _inFlightPromises = new Map<UUID, Promise<void>[]>();
  private _nodeOutputs = new Map<UUID, Map<UUID, ArtifactEnvelope[]>>();
  private _dispatcher?: TaskDispatcher;
  private _accepting = true;
  private _isReady = false;
  private _bootTime = 0;
  private readonly _agingFactorMs: number;
  private readonly _maxConcurrentDispatch: number;
  private readonly _shutdownTimeoutMs: number;
  private _nodeEnqueueTime = new Map<UUID, number>();
  private _eventBus?: IEventBus;
  private _runtimeState?: IRuntimeState;
  private _policyEngine?: IPolicyEngine;

  constructor(options: SchedulerOptions = {}) {
    this._eventBus = options.eventBus;
    this._runtimeState = options.runtimeState;
    this._policyEngine = options.policyEngine;
    this._agingFactorMs = validatePositiveNumber(options.agingFactorMs ?? 5000, 'agingFactorMs');
    this._maxConcurrentDispatch = options.maxConcurrentDispatch === undefined
      ? Infinity
      : validatePositiveInteger(options.maxConcurrentDispatch, 'maxConcurrentDispatch');
    this._shutdownTimeoutMs = validateNonNegativeNumber(options.shutdownTimeoutMs ?? 5000, 'shutdownTimeoutMs');
  }

  public async start(): Promise<void> { await this.boot(); }
  public async stop(): Promise<void> { await this.shutdown(); }
  public async getHealth(): Promise<SubsystemHealth> { return Promise.resolve(this.health()); }

  public async boot(): Promise<void> {
    if (this._isReady) return;
    this._isReady = true;
    this._accepting = true;
    this._bootTime = Date.now();
  }

  public async shutdown(): Promise<void> {
    if (!this._isReady && this._plans.size === 0) return;
    this.stopAccepting();
    this._isReady = false;
    const waits: Promise<void>[] = [];
    for (const [planId, plan] of this._plans) {
      if (plan.status === 'running') {
        plan.status = 'cancelled';
        this._planTokens.get(planId)?.cancel();
        waits.push(...(this._inFlightPromises.get(planId) ?? []));
      }
    }
    if (waits.length > 0) {
      await Promise.race([
        Promise.allSettled(waits).then(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, this._shutdownTimeoutMs)),
      ]);
    }
    for (const planId of [...this._plans.keys()]) this.cleanupPlanExecutionResources(planId);
    this._plans.clear();
  }

  public stopAccepting(): void { this._accepting = false; }

  public health(): SubsystemHealth {
    return { status: this._isReady ? 'healthy' : 'unhealthy', uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0 };
  }

  public registerDispatcher(dispatcher: TaskDispatcher): void {
    if (typeof dispatcher !== 'function') throw new TypeError('dispatcher must be a function');
    this._dispatcher = dispatcher;
  }

  public async submit(plan: ExecutionPlan): Promise<UUID> {
    if (!this._isReady) throw new AgyError('Scheduler is not ready', { code: 'SCHEDULER_NOT_READY', subsystem: 'scheduler', retryable: false });
    if (!this._accepting) throw new AgyError('Scheduler is draining and not accepting new plans', { code: 'SCHEDULER_DRAINING', subsystem: 'scheduler', retryable: false });
    this.validatePlan(plan);
    if (this._plans.has(plan.planId)) throw new AgyError(`Plan ${plan.planId} is already registered`, { code: 'PLAN_DUPLICATE', subsystem: 'scheduler', retryable: false });

    plan.status = 'running';
    this._plans.set(plan.planId, plan);
    this._planTokens.set(plan.planId, new SimpleCancellationToken());
    this._nodeCompletion.set(plan.planId, new Set());
    this._inFlightPromises.set(plan.planId, []);
    this._nodeOutputs.set(plan.planId, new Map());

    try {
      if (this._runtimeState) await this._runtimeState.trackPlan(plan.planId);
    } catch (err) {
      this._plans.delete(plan.planId);
      this.cleanupPlanExecutionResources(plan.planId);
      plan.status = 'failed';
      throw err;
    }
    if (this._eventBus) {
      try {
        await this._eventBus.publish('scheduler.plan.submitted', {
          id: asUUID(randomUUID()), topic: 'scheduler.plan.submitted', key: plan.planId,
          payload: { planId: plan.planId, nodeCount: plan.nodes.length }, timestamp: Date.now(),
        });
      } catch (err) { console.error('[Scheduler] submission event failed:', err); }
    }
    return plan.planId;
  }

  public async cancel(planId: UUID): Promise<boolean> {
    const plan = this._plans.get(planId);
    if (!plan || plan.status !== 'running') return false;
    plan.status = 'cancelled';
    this._planTokens.get(planId)?.cancel();
    this.cleanupPlanExecutionResources(planId);
    await this.safeUntrack(planId);
    return true;
  }

  public getPlanStatus(planId: UUID): string | null {
    return this._plans.get(planId)?.status ?? null;
  }

  public async tick(): Promise<number> {
    if (!this._isReady) return 0;
    if (!this._dispatcher) {
      for (const [planId, plan] of this._plans) {
        if (plan.status === 'running') await this.failPlan(planId, new AgyError('No task dispatcher is registered', { code: 'DISPATCHER_MISSING', subsystem: 'scheduler', retryable: false }));
      }
      return 0;
    }

    let dispatchedCount = 0;
    for (const [planId, plan] of this._plans) {
      if (plan.status !== 'running') continue;
      const completed = this._nodeCompletion.get(planId);
      if (!completed) continue;
      const readyNodes = this.findReadyNodes(plan, completed);

      if (readyNodes.length === 0) {
        const hasRunning = plan.nodes.some((node) => node.state === 'running');
        if (!hasRunning && completed.size !== plan.nodes.length) {
          await this.failPlan(planId, new AgyError(`Plan ${planId} is deadlocked`, { code: 'PLAN_DEADLOCK', subsystem: 'scheduler', retryable: false }));
        } else if (completed.size === plan.nodes.length) {
          await this.completePlan(planId);
        }
        continue;
      }

      const now = Date.now();
      const taskQueue: QueuedTask[] = readyNodes.map((node) => {
        if (!this._nodeEnqueueTime.has(node.nodeId)) this._nodeEnqueueTime.set(node.nodeId, now);
        return {
          taskId: asUUID(randomUUID()), node, planId,
          queuedAt: this._nodeEnqueueTime.get(node.nodeId)!,
          basePriority: PRIORITY_WEIGHTS[node.priority ?? 'medium'] ?? 100,
        };
      });
      taskQueue.sort((a, b) => {
        const effectiveA = a.basePriority + (now - a.queuedAt) / this._agingFactorMs;
        const effectiveB = b.basePriority + (now - b.queuedAt) / this._agingFactorMs;
        return effectiveB - effectiveA;
      });

      const promises = this._inFlightPromises.get(planId) ?? [];
      for (const item of taskQueue.slice(0, this._maxConcurrentDispatch)) {
        if (item.node.state === 'running') continue;
        item.node.state = 'running';
        try {
          const nowLease = Date.now();
          const ttl = validatePositiveInteger(item.node.limits.maxDurationMs ?? 60000, 'maxDurationMs');
          const lease = this._policyEngine
            ? await this._policyEngine.issueLease(item.node.skillRef.id, item.node.requiredCapabilities ?? [], ttl)
            : {
                leaseId: asUUID(randomUUID()), subject: item.node.skillRef.id, capabilities: [],
                issuedAt: nowLease, expiresAt: nowLease + ttl, revoked: false,
              };
          const planOutputs = this._nodeOutputs.get(planId) ?? new Map<UUID, ArtifactEnvelope[]>();
          const inputs = [...item.node.inputs];
          for (const edge of plan.edges) {
            if (edge.toNodeId === item.node.nodeId && (edge.kind === 'data' || edge.kind === 'ordering')) {
              const upstream = planOutputs.get(edge.fromNodeId);
              if (upstream) inputs.push(...upstream);
            }
          }
          const task: TaskContext = {
            taskId: item.taskId, nodeId: item.node.nodeId, planId: item.planId, lease,
            cancellationToken: this._planTokens.get(planId) ?? new SimpleCancellationToken(), inputs,
          };
          dispatchedCount++;
          const promise = Promise.resolve().then(() => this._dispatcher!(task, item.node))
            .then(async (result) => {
              if (!this._plans.has(planId)) return;
              item.node.state = 'done';
              completed.add(item.node.nodeId);
              if (result?.outputArtifacts?.length) planOutputs.set(item.node.nodeId, result.outputArtifacts);
              // Finalization occurs on the next scheduler tick so callers can
              // observe the last dispatch as a completed task before the plan
              // transitions to its terminal state.
            })
            .catch(async (err) => {
              if (item.node.state !== 'done') item.node.state = 'error';
              if (plan.status === 'running') await this.failPlan(planId, err);
            });
          promises.push(promise);
        } catch (err) {
          item.node.state = 'error';
          await this.failPlan(planId, err);
          break;
        }
      }
      if (promises.length > 0) await Promise.allSettled(promises);
    }
    return dispatchedCount;
  }

  private validatePlan(plan: ExecutionPlan): void {
    if (!plan || typeof plan.planId !== 'string' || !Array.isArray(plan.nodes) || !Array.isArray(plan.edges)) {
      throw new AgyError('Execution plan shape is invalid', { code: 'PLAN_INVALID', subsystem: 'scheduler', retryable: false });
    }
    if (plan.status !== 'pending') throw new AgyError('Only pending plans may be submitted', { code: 'PLAN_INVALID_STATE', subsystem: 'scheduler', retryable: false });
    const ids = new Set<string>();
    for (const node of plan.nodes) {
      if (!node || typeof node.nodeId !== 'string' || ids.has(node.nodeId)) throw new AgyError('Plan node IDs must be unique', { code: 'PLAN_INVALID', subsystem: 'scheduler', retryable: false });
      if (!['waiting', 'ready'].includes(node.state)) throw new AgyError(`Node ${node.nodeId} is not submit-ready`, { code: 'PLAN_INVALID_STATE', subsystem: 'scheduler', retryable: false });
      ids.add(node.nodeId);
    }
    const adjacency = new Map<string, string[]>();
    for (const id of ids) adjacency.set(id, []);
    for (const edge of plan.edges) {
      if (!ids.has(edge.fromNodeId) || !ids.has(edge.toNodeId) || edge.fromNodeId === edge.toNodeId) throw new AgyError('Plan edge references an invalid or self node', { code: 'PLAN_INVALID_EDGE', subsystem: 'scheduler', retryable: false });
      if (edge.kind === 'ordering' || edge.kind === 'data') adjacency.get(edge.fromNodeId)!.push(edge.toNodeId);
    }
    const indegree = new Map<string, number>([...ids].map((id) => [id, 0]));
    for (const targets of adjacency.values()) for (const target of targets) indegree.set(target, indegree.get(target)! + 1);
    const queue = [...ids].filter((id) => indegree.get(id) === 0);
    let visited = 0;
    while (queue.length) {
      const id = queue.shift()!; visited++;
      for (const target of adjacency.get(id)!) {
        indegree.set(target, indegree.get(target)! - 1);
        if (indegree.get(target) === 0) queue.push(target);
      }
    }
    if (visited !== ids.size) throw new AgyError('Execution plan contains a dependency cycle', { code: 'PLAN_CYCLE', subsystem: 'scheduler', retryable: false });
  }

  private async completePlan(planId: UUID): Promise<void> {
    const plan = this._plans.get(planId);
    if (!plan || plan.status !== 'running') return;
    plan.status = 'completed';
    this.cleanupPlanExecutionResources(planId);
    await this.safeUntrack(planId);
  }

  private async failPlan(planId: UUID, _error: unknown): Promise<void> {
    const plan = this._plans.get(planId);
    if (!plan || plan.status !== 'running') return;
    plan.status = 'failed';
    this._planTokens.get(planId)?.cancel();
    this.cleanupPlanExecutionResources(planId);
    await this.safeUntrack(planId);
  }

  private async safeUntrack(planId: UUID): Promise<void> {
    if (!this._runtimeState) return;
    try { await this._runtimeState.untrackPlan(planId); }
    catch (err) { console.error('[Scheduler] failed to untrack plan:', err); }
  }

  private cleanupPlanExecutionResources(planId: UUID): void {
    this._planTokens.delete(planId);
    this._nodeCompletion.delete(planId);
    this._inFlightPromises.delete(planId);
    this._nodeOutputs.delete(planId);
    const plan = this._plans.get(planId);
    if (plan) for (const node of plan.nodes) this._nodeEnqueueTime.delete(node.nodeId);
  }

  private findReadyNodes(plan: ExecutionPlan, completed: Set<UUID>): PlanNode[] {
    const ready: PlanNode[] = [];
    for (const node of plan.nodes) {
      if (node.state === 'done' || node.state === 'running' || node.state === 'error') continue;
      const incoming = plan.edges.filter((edge) => edge.toNodeId === node.nodeId && (edge.kind === 'ordering' || edge.kind === 'data'));
      if (incoming.every((edge) => completed.has(edge.fromNodeId))) ready.push(node);
    }
    return ready;
  }
}

function validatePositiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) throw new RangeError(`${name} must be a positive integer`);
  return value;
}
function validatePositiveNumber(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be a finite positive number`);
  return value;
}
function validateNonNegativeNumber(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and non-negative`);
  return value;
}
