"use strict";
/**
 * Standard typed error hierarchy for the AGY Kernel ecosystem.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionError = exports.SchedulerError = exports.StateError = exports.ArtifactError = exports.PolicyError = exports.RegistryError = exports.ResolutionError = exports.AgyError = void 0;
class AgyError extends Error {
    code;
    subsystem;
    retryable;
    details;
    constructor(message, options) {
        super(`[${options.subsystem.toUpperCase()}:${options.code}] ${message}`);
        this.name = 'AgyError';
        this.code = options.code;
        this.subsystem = options.subsystem;
        this.retryable = options.retryable;
        this.details = options.details;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.AgyError = AgyError;
class ResolutionError extends AgyError {
    constructor(message, details, retryable = false) {
        super(message, { code: 'RESOLUTION_FAILED', subsystem: 'resolver', retryable, details });
        this.name = 'ResolutionError';
    }
}
exports.ResolutionError = ResolutionError;
class RegistryError extends AgyError {
    constructor(message, code = 'REGISTRY_ERROR', details, retryable = false) {
        super(message, { code, subsystem: 'registry', retryable, details });
        this.name = 'RegistryError';
    }
}
exports.RegistryError = RegistryError;
class PolicyError extends AgyError {
    constructor(message, details) {
        super(message, { code: 'POLICY_DENIED', subsystem: 'policy', retryable: false, details });
        this.name = 'PolicyError';
    }
}
exports.PolicyError = PolicyError;
class ArtifactError extends AgyError {
    constructor(message, code = 'ARTIFACT_ERROR', details) {
        super(message, { code, subsystem: 'artifact', retryable: false, details });
        this.name = 'ArtifactError';
    }
}
exports.ArtifactError = ArtifactError;
class StateError extends AgyError {
    constructor(message, code = 'STATE_ERROR', details) {
        super(message, { code, subsystem: 'runtime-state', retryable: true, details });
        this.name = 'StateError';
    }
}
exports.StateError = StateError;
class SchedulerError extends AgyError {
    constructor(message, code = 'SCHEDULER_ERROR', details) {
        super(message, { code, subsystem: 'scheduler', retryable: true, details });
        this.name = 'SchedulerError';
    }
}
exports.SchedulerError = SchedulerError;
class ExecutionError extends AgyError {
    constructor(message, code = 'EXECUTION_FAILED', details, retryable = false) {
        super(message, { code, subsystem: 'executor', retryable, details });
        this.name = 'ExecutionError';
    }
}
exports.ExecutionError = ExecutionError;
//# sourceMappingURL=errors.js.map