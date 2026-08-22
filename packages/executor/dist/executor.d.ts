/**
 * Concrete Sandboxed Executor Pool implementation.
 * Manages worker pool concurrency, hard resource execution limits,
 * crash isolation, artifact ingestion/emission, and event bus notification (RFC-0008).
 */
import { ExecutionLimits, ExecutionResult, SubsystemHealth, TaskContext, UUID } from '@agy/shared';
import { ExecutorOptions, IExecutor, PoolStatus } from './interfaces.js';
export declare class Executor implements IExecutor {
    readonly name = "executor";
    readonly id: UUID;
    private _skillLoader;
    private _artifactStore?;
    private _policyEngine?;
    private _eventBus?;
    private _maxWorkers;
    private _activeWorkers;
    private _queue;
    private _isReady;
    private _bootTime;
    constructor(options: ExecutorOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    getHealth(): Promise<SubsystemHealth>;
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