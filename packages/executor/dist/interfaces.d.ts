/**
 * Executor interfaces and contracts.
 * Strictly implements Phase 3 (IExecutor) and RFC-0008.
 */
import { ExecutionLimits, ExecutionResult, SubsystemHealth, TaskContext } from '@agy/shared';
import { ISubsystem } from '@agy/kernel';
export interface PoolStatus {
    activeWorkers: number;
    availableWorkers: number;
    queuedTasks: number;
    totalCapacity: number;
}
export interface IExecutor extends ISubsystem {
    execute(task: TaskContext, limits?: ExecutionLimits): Promise<ExecutionResult>;
    getPoolStatus(): PoolStatus;
    drain(): Promise<void>;
    health(): Promise<SubsystemHealth> | SubsystemHealth;
}
//# sourceMappingURL=interfaces.d.ts.map