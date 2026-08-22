/**
 * Concrete Reflection Engine implementation.
 * Provides read-only introspection over runtime state snapshots,
 * lease metrics, and system diagnostics without state mutation paths (RFC-0011).
 */
import { SubsystemHealth, UUID } from '@agy/shared';
import { IRuntimeState } from '@agy/runtime-state';
import { IReflectionEngine, ReflectionReport } from './interfaces.js';
export interface ReflectionEngineOptions {
    runtimeState: IRuntimeState;
}
export declare class ReflectionEngine implements IReflectionEngine {
    readonly id: UUID;
    readonly name = "reflection";
    private _runtimeState;
    private _isReady;
    private _bootTime?;
    constructor(options: ReflectionEngineOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    getHealth(): Promise<SubsystemHealth>;
    boot(): Promise<void>;
    shutdown(): Promise<void>;
    health(): SubsystemHealth;
    inspectRuntime(): Promise<ReflectionReport>;
}
//# sourceMappingURL=reflection-engine.d.ts.map