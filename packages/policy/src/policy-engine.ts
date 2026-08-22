/**
 * Concrete Policy Engine implementation.
 * Enforces Deny-Overrides resolution, priority ordering, lease management,
 * and integration with Runtime State (RFC-0003, RFC-0003a).
 */

import { randomUUID } from 'node:crypto';
import { Capability, Lease, PolicyDecision, PolicyRequest, SubsystemHealth, UUID, asUUID, AgyError } from '@agy/shared';
import { IRuntimeState } from '@agy/runtime-state';
import { IPolicy, IPolicyEngine } from './interfaces.js';

export interface PolicyEngineOptions {
  runtimeState?: IRuntimeState;
}

export class PolicyEngine implements IPolicyEngine {
  public readonly id: UUID = asUUID('policy-engine');
  public readonly name = 'policy-engine';
  private _policies: IPolicy[] = [];
  private _runtimeState?: IRuntimeState;
  private _isReady = false;
  private _bootTime = 0;

  constructor(options: PolicyEngineOptions = {}) {
    this._runtimeState = options.runtimeState;
  }

  public async boot(): Promise<void> {
    this._isReady = true;
    this._bootTime = Date.now();
  }

  public async shutdown(): Promise<void> {
    this._isReady = false;
  }

  public async start(): Promise<void> { await this.boot(); }
  public async stop(): Promise<void> { await this.shutdown(); }
  public async getHealth(): Promise<SubsystemHealth> { return Promise.resolve(this.health()); }

  public health(): SubsystemHealth {
    return {
      status: this._isReady ? 'healthy' : 'unhealthy',
      uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0,
    };
  }

  public registerPolicy(policy: IPolicy): void {
    this._policies.push(policy);
    // Sort by priority (lowest number = highest priority)
    this._policies.sort((a, b) => a.priority - b.priority);
  }

  public unregisterPolicy(name: string): void {
    this._policies = this._policies.filter((p) => p.name !== name);
  }

  public async evaluate(request: PolicyRequest): Promise<PolicyDecision> {
    if (!this._isReady) {
      throw new AgyError('PolicyEngine is not ready', {
        code: 'POLICY_NOT_READY',
        subsystem: 'policy',
        retryable: false,
      });
    }

    if (this._policies.length === 0) {
      // Fail-closed default (RFC-0003a)
      return {
        requestId: request.requestId,
        subject: request.subject,
        capability: request.capability,
        decision: 'deny',
        reason: 'Default deny: No matching permit policy',
        policyVersion: '1.0.0',
      };
    }

    let hasExplicitAllow = false;
    let allowReason = 'Permitted: All registered policies granted approval';

    // Evaluate policies in priority order with Deny-Overrides (RFC-0003a)
    for (const policy of this._policies) {
      const decision = await policy.evaluate(request);
      if (decision.decision === 'deny') {
        return {
          ...decision,
          requestId: request.requestId,
          subject: request.subject,
          capability: request.capability,
        };
      }
      if (decision.decision === 'allow') {
        hasExplicitAllow = true;
        allowReason = decision.reason || allowReason;
      }
    }

    if (!hasExplicitAllow) {
      return {
        requestId: request.requestId,
        subject: request.subject,
        capability: request.capability,
        decision: 'deny',
        reason: 'Default deny: No matching permit policy',
        policyVersion: '1.0.0',
      };
    }

    return {
      requestId: request.requestId,
      subject: request.subject,
      capability: request.capability,
      decision: 'allow',
      reason: allowReason,
      policyVersion: '1.0.0',
    };
  }

  public async issueLease(
    subject: string,
    capabilities: Capability[],
    ttlMs: number = 60000
  ): Promise<Lease> {
    const lease: Lease = {
      leaseId: asUUID(randomUUID()),
      subject,
      capabilities: capabilities.map((c) => ({ ...c })),
      issuedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
      revoked: false,
    };

    if (this._runtimeState) {
      await this._runtimeState.grantLease(lease);
    }

    return lease;
  }

  public async validateLease(leaseId: UUID, requestedCapability: Capability): Promise<boolean> {
    let lease: Lease | null = null;
    if (this._runtimeState) {
      lease = this._runtimeState.getLease(leaseId);
    }

    if (!lease) return false;
    if (lease.revoked) return false;
    if (Date.now() > lease.expiresAt) return false;

    // Check capability matching with scope normalization and subpath containment
    return lease.capabilities.some((c) => {
      if (c.name !== requestedCapability.name) return false;
      if (c.scope === '*' || c.scope === requestedCapability.scope) return true;

      // Subpath containment check (e.g. /workspace/project matches /workspace/project/subfile)
      if (c.scope && requestedCapability.scope && requestedCapability.scope.startsWith(c.scope)) {
        return true;
      }

      return false;
    });
  }

  public async revokeLease(leaseId: UUID): Promise<boolean> {
    if (this._runtimeState) {
      return await this._runtimeState.revokeLease(leaseId);
    }
    return false;
  }

  public async sweepExpiredLeases(): Promise<number> {
    if (!this._runtimeState) return 0;
    const snapshot = this._runtimeState.getSnapshot();
    const now = Date.now();
    let swept = 0;

    for (const [id, lease] of Object.entries(snapshot.leases)) {
      if (!lease.revoked && now > lease.expiresAt) {
        await this._runtimeState.revokeLease(asUUID(id));
        swept++;
      }
    }

    return swept;
  }
}
