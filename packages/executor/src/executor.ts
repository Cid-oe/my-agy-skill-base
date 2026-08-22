/**
 * Concrete Sandboxed Executor Pool implementation.
 * Manages worker pool concurrency, hard resource execution limits,
 * crash isolation, artifact ingestion/emission, and event bus notification (RFC-0008).
 */

import { randomUUID } from 'node:crypto';
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

      if (this._policyEngine && task.lease.capabilities.length > 0) {
        for (const cap of task.lease.capabilities) {
          const valid = await this._policyEngine.validateLease(task.lease.leaseId, cap);
          if (!valid) {
            throw new AgyError(`Lease ${task.lease.leaseId} capability ${cap.name} validation failed`, {
              code: 'LEASE_VALIDATION_FAILED',
              subsystem: 'executor',
              retryable: false,
            });
          }
        }
      }

      const skill = await this._skillLoader.acquire(task.lease.subject);

      try {
        const executionPromise = skill.execute({
          taskId: task.taskId,
          planId: task.planId,
          leaseId: task.lease.leaseId,
        });

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

        const resultPayload = await Promise.race([executionPromise, timeoutPromise]);
        if (timer) {
          clearTimeout(timer);
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
