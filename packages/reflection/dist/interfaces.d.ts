/**
 * Reflection Engine interfaces and contracts.
 * Strictly implements Phase 3 (IReflectionEngine) and RFC-0011.
 */
import { StateSnapshot, SubsystemHealth } from '@agy/shared';
import { ISubsystem } from '@agy/shared';
export interface ReflectionReport {
    timestamp: number;
    runtimeVersion: number;
    activePlanCount: number;
    activeLeaseCount: number;
    snapshot: StateSnapshot;
    diagnostics: string[];
}
export interface IReflectionEngine extends ISubsystem {
    inspectRuntime(): Promise<ReflectionReport>;
    health(): Promise<SubsystemHealth> | SubsystemHealth;
}
//# sourceMappingURL=interfaces.d.ts.map