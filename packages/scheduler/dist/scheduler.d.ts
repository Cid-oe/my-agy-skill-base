/**
 * Concrete DAG Scheduler implementation.
 * Enforces DAG dependency ordering, priority aging for anti-starvation (RFC-0007a),
 * bounded dispatch queues, and cooperative cancellation propagation.
 */
import { ExecutionPlan, SubsystemHealth, UUID } from '@agy/shared';
import { IEventBus } from '@agy/event-bus';
import { IRuntimeState } from '@agy/runtime-state';
import { IScheduler, TaskDispatcher } from './interfaces.js';
export interface SchedulerOptions {
    eventBus?: IEventBus;
    runtimeState?: IRuntimeState;
    agingFactorMs?: number;
}
export declare class Scheduler implements IScheduler {
    readonly name = "scheduler";
    private _plans;
    private _planTokens;
    private _nodeCompletion;
    private _inFlightPromises;
    private _dispatcher?;
    private _accepting;
    private _isReady;
    private _bootTime;
    private _agingFactorMs;
    private _eventBus?;
    private _runtimeState?;
    constructor(options?: SchedulerOptions);
    boot(): Promise<void>;
    shutdown(): Promise<void>;
    stopAccepting(): void;
    health(): SubsystemHealth;
    registerDispatcher(dispatcher: TaskDispatcher): void;
    submit(plan: ExecutionPlan): Promise<UUID>;
    cancel(planId: UUID): Promise<boolean>;
    getPlanStatus(planId: UUID): string | null;
    tick(): Promise<number>;
    private findReadyNodes;
}
//# sourceMappingURL=scheduler.d.ts.map