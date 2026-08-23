/**
 * Concrete Sandboxed Executor Pool implementation.
 * Manages worker pool concurrency, hard resource execution limits,
 * crash isolation, artifact ingestion/emission, and event bus notification (RFC-0008).
 */

import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { Worker } from 'node:worker_threads';
import {
  ArtifactEnvelope,
  ExecutionLimits,
  ExecutionResult,
  SubsystemHealth,
  TaskContext,
  AgyError,
  UUID,
  asUUID,
} from '@agy/shared';
import { IEventBus } from '@agy/event-bus';
import { ISkillLoader } from '@agy/registry';
import { IArtifactStore } from '@agy/artifact';
import { IPolicyEngine } from '@agy/policy';
import { ExecutorOptions, IExecutor, PoolStatus } from './interfaces.js';

// Resolve the worker harness asset relative to this compiled module
// (packages/executor/dist/executor.js -> ../worker-harness.mjs).
const WORKER_HARNESS_PATH = path.resolve(__dirname, '..', 'worker-harness.mjs');

export class Executor implements IExecutor {
  public readonly name = 'executor';
  public readonly id: UUID = asUUID('executor');
  private _skillLoader: ISkillLoader;
  private _artifactStore?: IArtifactStore;
  private _policyEngine?: IPolicyEngine;
  private _eventBus?: IEventBus;
  private _maxWorkers: number;
  private _activeWorkers = 0;
  private _queue: (() => void)[] = [];
  private _isReady = false;
  private _bootTime = 0;

  constructor(options: ExecutorOptions) {
    this._skillLoader = options.skillLoader;
    this._artifactStore = options.artifactStore;
    this._policyEngine = options.policyEngine;
    this._eventBus = options.eventBus;
    this._maxWorkers = options.maxWorkers || 10;
  }

  public async start(): Promise<void> {
    await this.boot();
  }

  public async stop(): Promise<void> {
    await this.shutdown();
  }

  public async getHealth(): Promise<SubsystemHealth> {
    return Promise.resolve(this.health());
  }

  public async boot(): Promise<void> {
    this._isReady = true;
    this._bootTime = Date.now();
  }

  public async shutdown(): Promise<void> {
    await this.drain();
    this._isReady = false;
  }

  public health(): SubsystemHealth {
    return {
      status: this._isReady ? 'healthy' : 'unhealthy',
      uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0,
    };
  }

  public getPoolStatus(): PoolStatus {
    return {
      activeWorkers: this._activeWorkers,
      availableWorkers: Math.max(0, this._maxWorkers - this._activeWorkers),
      queuedTasks: this._queue.length,
      totalCapacity: this._maxWorkers,
    };
  }

  public async drain(): Promise<void> {
    while (this._activeWorkers > 0) {
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  public async execute(task: TaskContext, limits: ExecutionLimits = {}): Promise<ExecutionResult> {
    if (!this._isReady) {
      throw new AgyError('Executor is not ready', {
        code: 'EXECUTOR_NOT_READY',
        subsystem: 'executor',
        retryable: false,
      });
    }

    await this.acquireWorker();

    const startTime = Date.now();
    const timeoutMs = limits.maxDurationMs || 30000;
    let timer: NodeJS.Timeout | undefined;

    try {
      if (this._eventBus) {
        await this._eventBus.publish('executor.task.started', {
          id: asUUID(randomUUID()),
          topic: 'executor.task.started',
          key: task.taskId,
          payload: { taskId: task.taskId, skill: task.lease.subject },
          timestamp: startTime,
        });
      }

      if (task.cancellationToken.isCancellationRequested) {
        throw new AgyError(`Task ${task.taskId} cancelled before execution start`, {
          code: 'TASK_CANCELLED',
          subsystem: 'executor',
          retryable: false,
        });
      }

      const skill = await this._skillLoader.acquire(task.lease.subject);

      try {
        // Enforce that the task lease covers every capability the skill
        // declares it requires (manifest.permissions). Previously this check
        // was gated on `task.lease.capabilities.length > 0`, but the scheduler
        // issued empty-capability leases, so it was never reachable (SRC-5).
        if (this._policyEngine) {
          for (const required of skill.manifest.permissions ?? []) {
            const granted = await this._policyEngine.validateLease(task.lease.leaseId, required);
            if (!granted) {
              throw new AgyError(
                `Lease ${task.lease.leaseId} does not cover required capability ${required.name} (${required.scope})`,
                {
                  code: 'LEASE_VALIDATION_FAILED',
                  subsystem: 'executor',
                  retryable: false,
                }
              );
            }
          }
        }
        // Resolve input artifacts (from upstream nodes) so the skill can
        // consume upstream outputs. Content is read from the artifact store and
        // passed as utf-8 strings (artifacts are JSON-serialized results).
        const inputs: Array<{ hash: string; size: number; data: string }> = [];
        if (this._artifactStore && task.inputs && task.inputs.length > 0) {
          for (const envelope of task.inputs) {
            const buf = await this._artifactStore.get(envelope.hash);
            if (buf) {
              inputs.push({ hash: envelope.hash, size: envelope.size, data: buf.toString('utf-8') });
            }
          }
        }

        const ctxArg = {
          taskId: task.taskId,
          planId: task.planId,
          leaseId: task.lease.leaseId,
          inputs,
        };

        let resultPayload: unknown;
        if (skill.modulePath) {
          // Isolated execution in a worker thread with memory resource limits
          // and hard termination on timeout/cancellation (SRC-1, SRC-2, SRC-3,
          // SRC-4). The worker is killed (not merely raced) on timeout, so no
          // orphaned work survives.
          resultPayload = await this.runInWorker(skill.modulePath, ctxArg, limits, task.cancellationToken);
        } else {
          const executionPromise = skill.execute(ctxArg);

          const timeoutPromise = new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              reject(
                new AgyError(`Execution exceeded timeout of ${timeoutMs}ms`, {
                  code: 'EXECUTION_TIMEOUT',
                  subsystem: 'executor',
                  retryable: false,
                })
              );
            }, timeoutMs);

            task.cancellationToken.onCancelled(() => {
              if (timer) clearTimeout(timer);
              reject(
                new AgyError(`Execution cancelled by token`, {
                  code: 'TASK_CANCELLED',
                  subsystem: 'executor',
                  retryable: false,
                })
              );
            });
          });

          resultPayload = await Promise.race([executionPromise, timeoutPromise]);
          if (timer) {
            clearTimeout(timer);
          }
        }

        const outputArtifacts: ArtifactEnvelope[] = [];
        if (this._artifactStore && resultPayload) {
          const envelope = await this._artifactStore.put(
            JSON.stringify(resultPayload),
            { taskId: task.taskId, planId: task.planId },
            { id: task.lease.subject, version: skill.manifest.version },
            'application/json'
          );
          outputArtifacts.push(envelope);
        }

        const durationMs = Date.now() - startTime;
        const result: ExecutionResult = {
          taskId: task.taskId,
          outputArtifacts,
          metrics: { durationMs },
        };

        if (this._eventBus) {
          await this._eventBus.publish('executor.task.finished', {
            id: asUUID(randomUUID()),
            topic: 'executor.task.finished',
            key: task.taskId,
            payload: { taskId: task.taskId, durationMs },
            timestamp: Date.now(),
          });
        }

        return result;
      } finally {
        await this._skillLoader.release(skill);
      }
    } catch (err: unknown) {
      if (timer) {
        clearTimeout(timer);
      }
      if (this._eventBus) {
        const msg = err instanceof Error ? err.message : String(err);
        await this._eventBus.publish('executor.task.failed', {
          id: asUUID(randomUUID()),
          topic: 'executor.task.failed',
          key: task.taskId,
          payload: { taskId: task.taskId, error: msg },
          timestamp: Date.now(),
        });
      }
      throw err;
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
      this.releaseWorker();
    }
  }

  /**
   * Run a skill module in an isolated worker thread with resource limits and
   * hard termination on timeout/cancellation (SRC-1, SRC-2, SRC-3, SRC-4).
   *
   * maxMemoryMb is enforced via the worker's maxOldGenerationSizeMb limit.
   * maxCpuPercent is not natively enforceable by Node worker_threads and is
   * mitigated by the hard timeout (documented limitation).
   */
  private runInWorker(
    modulePath: string,
    context: Record<string, unknown>,
    limits: ExecutionLimits,
    cancellationToken: { isCancellationRequested: boolean; onCancelled(cb: () => void): void }
  ): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      const timeoutMs = limits.maxDurationMs || 30000;
      const resourceLimits: Record<string, number> = {};
      if (typeof limits.maxMemoryMb === 'number') {
        resourceLimits.maxOldGenerationSizeMb = limits.maxMemoryMb;
      }

      let worker: Worker;
      try {
        worker = new Worker(WORKER_HARNESS_PATH, {
          resourceLimits,
          workerData: { modulePath, context },
        });
      } catch (err) {
        reject(err);
        return;
      }

      let settled = false;
      let timer: NodeJS.Timeout | undefined;
      const settle = (action: () => void): void => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        action();
      };

      timer = setTimeout(() => {
        worker.terminate().catch(() => undefined).finally(() => {
          settle(() =>
            reject(new AgyError(`Execution exceeded timeout of ${timeoutMs}ms`, {
              code: 'EXECUTION_TIMEOUT',
              subsystem: 'executor',
              retryable: false,
            }))
          );
        });
      }, timeoutMs);

      cancellationToken.onCancelled(() => {
        worker.terminate().catch(() => undefined).finally(() => {
          settle(() =>
            reject(new AgyError('Execution cancelled by token', {
              code: 'TASK_CANCELLED',
              subsystem: 'executor',
              retryable: false,
            }))
          );
        });
      });

      worker.on('message', (msg: { ok: boolean; result?: unknown; error?: string }) => {
        settle(() => {
          if (msg && msg.ok) {
            resolve(msg.result);
          } else {
            reject(new AgyError(`Skill execution failed: ${msg?.error ?? 'unknown error'}`, {
              code: 'EXECUTION_FAILED',
              subsystem: 'executor',
              retryable: false,
            }));
          }
        });
      });

      worker.on('error', (err: Error) => {
        settle(() => {
          const message = err && err.message ? err.message : String(err);
          reject(new AgyError(`Worker error: ${message}`, {
            code: 'EXECUTION_FAILED',
            subsystem: 'executor',
            retryable: false,
            details: { raw: message },
          }));
        });
      });
    });
  }

  private async acquireWorker(): Promise<void> {
    if (this._activeWorkers < this._maxWorkers) {
      this._activeWorkers++;
      return;
    }

    return new Promise<void>((resolve) => {
      this._queue.push(() => {
        this._activeWorkers++;
        resolve();
      });
    });
  }

  private releaseWorker(): void {
    this._activeWorkers--;
    if (this._queue.length > 0) {
      const next = this._queue.shift()!;
      next();
    }
  }
}
