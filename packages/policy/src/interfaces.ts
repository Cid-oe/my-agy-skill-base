/**
 * Policy Engine interfaces and contracts.
 * Strictly implements Phase 3 (IPolicyEngine), RFC-0003, and RFC-0003a.
 */

import { Capability, Lease, PolicyDecision, PolicyRequest, SubsystemHealth, UUID } from '@agy/shared';
import { ISubsystem } from '@agy/shared';

export interface IPolicy {
  readonly name: string;
  readonly priority: number; // 1 = highest, e.g. Kernel Safety, 100 = Standard
  evaluate(request: PolicyRequest): Promise<PolicyDecision> | PolicyDecision;
}

export interface IPolicyEngine extends ISubsystem {
  registerPolicy(policy: IPolicy): void;
  unregisterPolicy(name: string): void;
  evaluate(request: PolicyRequest): Promise<PolicyDecision>;
  issueLease(subject: string, capabilities: Capability[], ttlMs?: number): Promise<Lease>;
  validateLease(leaseId: UUID, requestedCapability: Capability): Promise<boolean>;
  revokeLease(leaseId: UUID): Promise<boolean>;
  sweepExpiredLeases(): Promise<number>;
  health(): Promise<SubsystemHealth> | SubsystemHealth;
}
