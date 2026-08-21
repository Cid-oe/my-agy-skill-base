/**
 * Standard typed error hierarchy for the AGY Kernel ecosystem.
 */
export type SubsystemName = 'kernel' | 'resolver' | 'registry' | 'policy' | 'artifact' | 'runtime-state' | 'event-bus' | 'scheduler' | 'executor' | 'reflection' | 'shared';
export interface AgyErrorDetails {
    code: string;
    subsystem: SubsystemName;
    retryable: boolean;
    details?: Record<string, unknown>;
}
export declare class AgyError extends Error {
    readonly code: string;
    readonly subsystem: SubsystemName;
    readonly retryable: boolean;
    readonly details?: Record<string, unknown>;
    constructor(message: string, options: AgyErrorDetails);
}
export declare class ResolutionError extends AgyError {
    constructor(message: string, details?: Record<string, unknown>, retryable?: boolean);
}
export declare class RegistryError extends AgyError {
    constructor(message: string, code?: string, details?: Record<string, unknown>, retryable?: boolean);
}
export declare class PolicyError extends AgyError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class ArtifactError extends AgyError {
    constructor(message: string, code?: string, details?: Record<string, unknown>);
}
export declare class StateError extends AgyError {
    constructor(message: string, code?: string, details?: Record<string, unknown>);
}
export declare class SchedulerError extends AgyError {
    constructor(message: string, code?: string, details?: Record<string, unknown>);
}
export declare class ExecutionError extends AgyError {
    constructor(message: string, code?: string, details?: Record<string, unknown>, retryable?: boolean);
}
//# sourceMappingURL=errors.d.ts.map