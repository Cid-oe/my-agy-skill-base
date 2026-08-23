/**
 * Sandboxed executor pool.
 * Module-backed and declarative handlers run in short-lived child processes;
 * the parent never executes untrusted skill code or races an orphan promise.
 */

import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { ChildProcess, fork } from 'node:child_process';
import { ArtifactEnvelope, ExecutionLimits, ExecutionResult, SubsystemHealth, TaskContext, AgyError, UUID, asUUID } from '@agy/shared';
import { IEventBus } from '@agy/event-bus';
import { ISkillLoader } from '@agy/registry';
import { IArtifactStore } from '@agy/artifact';
import { IPolicyEngine } from '@agy/policy';
import { ExecutorOptions, IExecutor, PoolStatus } from './interfaces.js';

const HARNESS_PATH = path.resolve(__dirname, '..', 'worker-harness.mjs');
interface QueueWaiter { resolve: () => void; reject: (error: unknown) => void; cleanup?: () => void; }

export class Executor implements IExecutor {
  public readonly name = 'executor';
  public readonly id: UUID = asUUID('executor');
  private _skillLoader: ISkillLoader;
  private _artifactStore?: IArtifactStore;
  private _policyEngine?: IPolicyEngine;
  private _eventBus?: IEventBus;
  private readonly _maxWorkers: number;
  private readonly _shutdownTimeoutMs: number;
  private _activeWorkers = 0;
  private _queue: QueueWaiter[] = [];
  private _children = new Set<ChildProcess>();
  private _isReady = false;
  private _bootTime = 0;

  constructor(options: ExecutorOptions) {
    if (!options?.skillLoader) throw new TypeError('skillLoader is required');
    this._skillLoader = options.skillLoader;
    this._artifactStore = options.artifactStore;
    this._policyEngine = options.policyEngine;
    this._eventBus = options.eventBus;
    this._maxWorkers = validatePositiveInteger(options.maxWorkers ?? 10, 'maxWorkers');
    this._shutdownTimeoutMs = validateNonNegativeNumber(options.shutdownTimeoutMs ?? 5000, 'shutdownTimeoutMs');
  }

  public async start(): Promise<void> { await this.boot(); }
  public async stop(): Promise<void> { await this.shutdown(); }
  public async getHealth(): Promise<SubsystemHealth> { return Promise.resolve(this.health()); }
  public async boot(): Promise<void> { if (!this._isReady) { this._isReady = true; this._bootTime = Date.now(); } }

  public async shutdown(): Promise<void> {
    if (!this._isReady && this._activeWorkers === 0 && this._queue.length === 0) return;
    this._isReady = false;
    const shutdownError = new AgyError('Executor shutdown interrupted queued work', { code: 'EXECUTOR_SHUTDOWN', subsystem: 'executor', retryable: true });
    for (const waiter of this._queue.splice(0)) {
      waiter.cleanup?.();
      waiter.reject(shutdownError);
    }
    // Child processes are hard-killed. This is the only reliable way to stop a
    // skill that ignores cooperative cancellation.
    for (const child of this._children) child.kill('SIGKILL');
    await this.drain();
  }

  public health(): SubsystemHealth {
    return { status: this._isReady ? 'healthy' : 'unhealthy', uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0 };
  }

  public getPoolStatus(): PoolStatus {
    return { activeWorkers: this._activeWorkers, availableWorkers: Math.max(0, this._maxWorkers - this._activeWorkers), queuedTasks: this._queue.length, totalCapacity: this._maxWorkers };
  }

  public async drain(): Promise<void> {
    const deadline = Date.now() + this._shutdownTimeoutMs;
    while (this._activeWorkers > 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
  }

  public async execute(task: TaskContext, limits: ExecutionLimits = {}): Promise<ExecutionResult> {
    if (!this._isReady) throw new AgyError('Executor is not ready', { code: 'EXECUTOR_NOT_READY', subsystem: 'executor', retryable: false });
    validateLimits(limits);
    await this.acquireWorker(task.cancellationToken);
    const startTime = Date.now();
    let skill: Awaited<ReturnType<ISkillLoader['acquire']>> | undefined;
    try {
      await this.publish('executor.task.started', task.taskId, { taskId: task.taskId, skill: task.lease.subject });
      if (task.cancellationToken.isCancellationRequested) throw cancelledError(task.taskId);
      skill = await this._skillLoader.acquire(task.lease.subject);

      if (this._policyEngine) {
        if (!(await this._policyEngine.validateLeaseIdentity(task.lease.leaseId, skill.manifest.id))) {
          throw new AgyError(`Lease ${task.lease.leaseId} is invalid for ${skill.manifest.id}`, { code: 'LEASE_VALIDATION_FAILED', subsystem: 'executor', retryable: false });
        }
        for (const required of skill.manifest.permissions ?? []) {
          if (!(await this._policyEngine.validateLease(task.lease.leaseId, required))) {
            throw new AgyError(`Lease ${task.lease.leaseId} does not cover required capability ${required.name} (${required.scope})`, { code: 'LEASE_VALIDATION_FAILED', subsystem: 'executor', retryable: false });
          }
        }
      }

      const inputs: Array<{ hash: string; size: number; data: string }> = [];
      if (this._artifactStore && task.inputs) {
        for (const envelope of task.inputs) {
          const data = await this._artifactStore.get(envelope.hash);
          if (data === null) throw new AgyError(`Input artifact ${envelope.hash} is unavailable`, { code: 'INPUT_ARTIFACT_MISSING', subsystem: 'executor', retryable: false });
          inputs.push({ hash: envelope.hash, size: envelope.size, data: data.toString('utf8') });
        }
      }

      const context = { taskId: task.taskId, planId: task.planId, leaseId: task.lease.leaseId, inputs };
      const resultPayload = await this.runInSandbox(skill.modulePath, skill.execute.toString(), skill.manifest, context, limits, task.cancellationToken);
      const outputArtifacts: ArtifactEnvelope[] = [];
      if (this._artifactStore && resultPayload !== undefined) {
        outputArtifacts.push(await this._artifactStore.put(JSON.stringify(resultPayload), { taskId: task.taskId, planId: task.planId }, { id: skill.manifest.id, version: skill.manifest.version }, 'application/json'));
      }
      const result: ExecutionResult = { taskId: task.taskId, outputArtifacts, metrics: { durationMs: Date.now() - startTime } };
      await this.publish('executor.task.finished', task.taskId, { taskId: task.taskId, durationMs: result.metrics.durationMs });
      return result;
    } catch (err) {
      await this.publish('executor.task.failed', task.taskId, { taskId: task.taskId, error: err instanceof Error ? err.message : String(err) });
      throw err;
    } finally {
      if (skill) await this._skillLoader.release(skill);
      this.releaseWorker();
    }
  }

  private runInSandbox(
    modulePath: string | undefined,
    functionSource: string,
    manifest: unknown,
    context: Record<string, unknown>,
    limits: ExecutionLimits,
    cancellationToken: { isCancellationRequested: boolean; onCancelled(callback: () => void): void | (() => void) }
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const args: string[] = [];
      if (process.allowedNodeEnvironmentFlags.has('--experimental-permission')) {
        args.push('--experimental-permission', `--allow-fs-read=${path.dirname(HARNESS_PATH)}`);
        for (const readPath of moduleReadPaths(modulePath)) args.push(`--allow-fs-read=${readPath}`);
      }
      if (limits.maxMemoryMb !== undefined) args.push(`--max-old-space-size=${limits.maxMemoryMb}`);
      const child = fork(HARNESS_PATH, [], {
        cwd: modulePath ? path.dirname(modulePath) : path.dirname(HARNESS_PATH),
        env: { PATH: process.env.PATH ?? '', NODE_ENV: 'production' },
        execArgv: args,
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      });
      this._children.add(child);
      child.stderr?.resume();
      let settled = false;
      let timer: NodeJS.Timeout | undefined;
      let removeCancellation: (() => void) | undefined;
      const settle = (callback: () => void): void => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        removeCancellation?.();
        this._children.delete(child);
        callback();
      };
      const kill = (error: Error): void => {
        child.kill('SIGKILL');
        settle(() => reject(error));
      };

      child.once('error', (err) => settle(() => reject(new AgyError(`Sandbox process error: ${err.message}`, { code: 'EXECUTION_FAILED', subsystem: 'executor', retryable: false, cause: err }))));
      child.on('message', (message: { ok: boolean; result?: unknown; error?: string }) => {
        if (message.ok) settle(() => resolve(message.result));
        else settle(() => reject(new AgyError(`Skill execution failed: ${message.error ?? 'unknown error'}`, { code: 'EXECUTION_FAILED', subsystem: 'executor', retryable: false })));
      });
      child.once('close', (code, signal) => {
        if (!settled) settle(() => reject(new AgyError(`Sandbox exited without a result (code=${code}, signal=${signal ?? 'none'})`, { code: 'EXECUTION_FAILED', subsystem: 'executor', retryable: false })));
      });

      timer = setTimeout(() => kill(new AgyError(`Execution exceeded timeout of ${limits.maxDurationMs ?? 30000}ms`, { code: 'EXECUTION_TIMEOUT', subsystem: 'executor', retryable: false })), limits.maxDurationMs ?? 30000);
      const cancellationResult = cancellationToken.onCancelled(() => kill(new AgyError('Execution cancelled by token', { code: 'TASK_CANCELLED', subsystem: 'executor', retryable: false })));
      if (typeof cancellationResult === 'function') removeCancellation = cancellationResult;
      if (cancellationToken.isCancellationRequested) kill(cancelledError(asUUID(String(context.taskId))));

      child.send({ modulePath, functionSource: modulePath ? undefined : functionSource, context, manifest }, (err) => {
        if (err && !settled) kill(new AgyError(`Unable to send sandbox task: ${err.message}`, { code: 'EXECUTION_FAILED', subsystem: 'executor', retryable: false, cause: err }));
      });
    });
  }

  private async acquireWorker(token: { isCancellationRequested: boolean; onCancelled(callback: () => void): void | (() => void) }): Promise<void> {
    if (token.isCancellationRequested) throw new AgyError('Task cancelled before acquiring a worker', { code: 'TASK_CANCELLED', subsystem: 'executor', retryable: false });
    if (this._activeWorkers < this._maxWorkers) { this._activeWorkers++; return; }
    await new Promise<void>((resolve, reject) => {
      const waiter: QueueWaiter = { resolve: () => { waiter.cleanup?.(); this._activeWorkers++; resolve(); }, reject };
      const cancelResult = token.onCancelled(() => {
        const index = this._queue.indexOf(waiter);
        if (index >= 0) this._queue.splice(index, 1);
        waiter.cleanup?.();
        reject(new AgyError('Task cancelled while queued', { code: 'TASK_CANCELLED', subsystem: 'executor', retryable: false }));
      });
      if (typeof cancelResult === 'function') waiter.cleanup = cancelResult;
      this._queue.push(waiter);
    });
  }

  private releaseWorker(): void {
    if (this._activeWorkers > 0) this._activeWorkers--;
    const next = this._queue.shift();
    if (next) next.resolve();
  }

  private async publish(topic: string, key: UUID, payload: Record<string, unknown>): Promise<void> {
    if (!this._eventBus) return;
    try { await this._eventBus.publish(topic, { id: asUUID(randomUUID()), topic, key, payload, timestamp: Date.now() }); }
    catch (err) { console.error('[Executor] event publication failed:', err); }
  }
}

function moduleReadPaths(modulePath: string | undefined): string[] {
  if (!modulePath) return [];
  const paths = [path.dirname(modulePath)];
  let current = path.dirname(modulePath);
  while (current !== path.dirname(current)) {
    current = path.dirname(current);
    const nodeModules = path.join(current, 'node_modules');
    if (directoryExists(nodeModules)) paths.push(nodeModules);
  }
  return [...new Set(paths)];
}

function directoryExists(directory: string): boolean {
  try { return fs.statSync(directory).isDirectory(); } catch { return false; }
}

function cancelledError(taskId: UUID): AgyError {
  return new AgyError(`Task ${taskId} cancelled`, { code: 'TASK_CANCELLED', subsystem: 'executor', retryable: false });
}
function validatePositiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) throw new RangeError(`${name} must be a positive integer`);
  return value;
}
function validateNonNegativeNumber(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and non-negative`);
  return value;
}
function validateLimits(limits: ExecutionLimits): void {
  for (const [key, value] of Object.entries(limits)) {
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${key} must be a positive finite number`);
  }
  if (limits.maxCpuPercent !== undefined) throw new AgyError('maxCpuPercent cannot be enforced by this executor', { code: 'LIMIT_UNSUPPORTED', subsystem: 'executor', retryable: false });
}
