/**
 * Concrete Sandboxed Executor Pool implementation.
 * Manages worker pool concurrency, hard resource execution limits,
 * crash isolation, artifact ingestion/emission, and event bus notification (RFC-0008).
 */
import { ExecutionLimits, ExecutionResult, SubsystemHealth, TaskContext } from '@agy/shared';
import { IEventBus } from '@agy/event-bus';
import { ISkillLoader } from '@agy/registry';
import { IArtifactStore } from '@agy/artifact';
import { IExecutor, PoolStatus } from './interfaces.js';
export interface ExecutorOptions {
    skillLoader: ISkillLoader;
    artifactStore?: IArtifactStore;
    eventBus?: IEventBus;
    maxWorkers?: number;
}
export declare class Executor implements IExecutor {
    readonly name = "executor";
    private _skillLoader;
    private _artifactStore?;
    private _eventBus?;
    private _maxWorkers;
    private _activeWorkers;
    private _queue;
    private _isReady;
    private _bootTime;
    constructor(options: ExecutorOptions);
    boot(): Promise<void>;
    shutdown(): Promise<void>;
    health(): SubsystemHealth;
    getPoolStatus(): PoolStatus;
    drain(): Promise<void>;
    execute(task: TaskContext, limits?: ExecutionLimits): Promise<ExecutionResult>;
    private acquireWorker;
    private releaseWorker;
}
//# sourceMappingURL=executor.d.ts.map