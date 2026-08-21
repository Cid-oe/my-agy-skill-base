/**
 * Concrete Policy Engine implementation.
 * Enforces Deny-Overrides resolution, priority ordering, lease management,
 * and integration with Runtime State (RFC-0003, RFC-0003a).
 */
import { Capability, Lease, PolicyDecision, PolicyRequest, SubsystemHealth, UUID } from '@agy/shared';
import { IRuntimeState } from '@agy/runtime-state';
import { IPolicy, IPolicyEngine } from './interfaces.js';
export interface PolicyEngineOptions {
    runtimeState?: IRuntimeState;
}
export declare class PolicyEngine implements IPolicyEngine {
    readonly name = "policy-engine";
    private _policies;
    private _runtimeState?;
    private _isReady;
    private _bootTime;
    constructor(options?: PolicyEngineOptions);
    boot(): Promise<void>;
    shutdown(): Promise<void>;
    health(): SubsystemHealth;
    registerPolicy(policy: IPolicy): void;
    unregisterPolicy(name: string): void;
    evaluate(request: PolicyRequest): Promise<PolicyDecision>;
    issueLease(subject: string, capabilities: Capability[], ttlMs?: number): Promise<Lease>;
    validateLease(leaseId: UUID, requestedCapability: Capability): Promise<boolean>;
    revokeLease(leaseId: UUID): Promise<boolean>;
}
//# sourceMappingURL=policy-engine.d.ts.map