/**
 * Standard typed error hierarchy for the AGY Kernel ecosystem.
 */

export type SubsystemName =
  | 'kernel'
  | 'resolver'
  | 'registry'
  | 'policy'
  | 'artifact'
  | 'runtime-state'
  | 'event-bus'
  | 'scheduler'
  | 'executor'
  | 'reflection'
  | 'shared';

export interface AgyErrorDetails {
  code: string;
  subsystem: SubsystemName;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export class AgyError extends Error {
  public readonly code: string;
  public readonly subsystem: SubsystemName;
  public readonly retryable: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, options: AgyErrorDetails) {
    super(`[${options.subsystem.toUpperCase()}:${options.code}] ${message}`);
    this.name = 'AgyError';
    this.code = options.code;
    this.subsystem = options.subsystem;
    this.retryable = options.retryable;
    this.details = options.details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ResolutionError extends AgyError {
  constructor(message: string, details?: Record<string, unknown>, retryable = false) {
    super(message, { code: 'RESOLUTION_FAILED', subsystem: 'resolver', retryable, details });
    this.name = 'ResolutionError';
  }
}

export class RegistryError extends AgyError {
  constructor(message: string, code = 'REGISTRY_ERROR', details?: Record<string, unknown>, retryable = false) {
    super(message, { code, subsystem: 'registry', retryable, details });
    this.name = 'RegistryError';
  }
}

export class PolicyError extends AgyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, { code: 'POLICY_DENIED', subsystem: 'policy', retryable: false, details });
    this.name = 'PolicyError';
  }
}

export class ArtifactError extends AgyError {
  constructor(message: string, code = 'ARTIFACT_ERROR', details?: Record<string, unknown>) {
    super(message, { code, subsystem: 'artifact', retryable: false, details });
    this.name = 'ArtifactError';
  }
}

export class StateError extends AgyError {
  constructor(message: string, code = 'STATE_ERROR', details?: Record<string, unknown>) {
    super(message, { code, subsystem: 'runtime-state', retryable: true, details });
    this.name = 'StateError';
  }
}

export class SchedulerError extends AgyError {
  constructor(message: string, code = 'SCHEDULER_ERROR', details?: Record<string, unknown>) {
    super(message, { code, subsystem: 'scheduler', retryable: true, details });
    this.name = 'SchedulerError';
  }
}

export class ExecutionError extends AgyError {
  constructor(message: string, code = 'EXECUTION_FAILED', details?: Record<string, unknown>, retryable = false) {
    super(message, { code, subsystem: 'executor', retryable, details });
    this.name = 'ExecutionError';
  }
}
