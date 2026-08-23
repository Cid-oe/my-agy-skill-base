/**
 * Deny-by-default capability policy engine with durable lease integration.
 */

import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { Capability, Lease, PolicyDecision, PolicyRequest, SubsystemHealth, UUID, asUUID, AgyError, deepClone } from '@agy/shared';
import { IRuntimeState } from '@agy/runtime-state';
import { IPolicy, IPolicyEngine } from './interfaces.js';

export interface PolicyEngineOptions { runtimeState?: IRuntimeState; }

export class PolicyEngine implements IPolicyEngine {
  public readonly id: UUID = asUUID('policy-engine');
  public readonly name = 'policy-engine';
  private _policies: IPolicy[] = [];
  private _runtimeState?: IRuntimeState;
  private _isReady = false;
  private _bootTime = 0;

  constructor(options: PolicyEngineOptions = {}) { this._runtimeState = options.runtimeState; }
  public async boot(): Promise<void> { if (!this._isReady) { this._isReady = true; this._bootTime = Date.now(); } }
  public async shutdown(): Promise<void> { this._isReady = false; }
  public async start(): Promise<void> { await this.boot(); }
  public async stop(): Promise<void> { await this.shutdown(); }
  public async getHealth(): Promise<SubsystemHealth> { return Promise.resolve(this.health()); }
  public health(): SubsystemHealth { return { status: this._isReady ? 'healthy' : 'unhealthy', uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0 }; }

  public registerPolicy(policy: IPolicy): void {
    if (!policy || !policy.name || !Number.isFinite(policy.priority) || typeof policy.evaluate !== 'function') throw new TypeError('Invalid policy');
    this._policies = this._policies.filter((existing) => existing.name !== policy.name);
    this._policies.push(policy);
    this._policies.sort((a, b) => a.priority - b.priority);
  }
  public unregisterPolicy(name: string): void { this._policies = this._policies.filter((policy) => policy.name !== name); }

  public async evaluate(request: PolicyRequest): Promise<PolicyDecision> {
    if (!this._isReady) throw new AgyError('PolicyEngine is not ready', { code: 'POLICY_NOT_READY', subsystem: 'policy', retryable: false });
    if (!request?.subject || !request.capability?.name || !request.capability?.scope) throw new AgyError('Invalid policy request', { code: 'POLICY_REQUEST_INVALID', subsystem: 'policy', retryable: false });
    if (this._policies.length === 0) return this.deny(request, 'Default deny: No matching permit policy');

    let allow: PolicyDecision | undefined;
    for (const policy of this._policies) {
      const decision = await policy.evaluate(deepClone(request));
      if (decision.decision === 'deny') return { ...deepClone(decision), requestId: request.requestId, subject: request.subject, capability: deepClone(request.capability) };
      if (decision.decision === 'allow') allow = decision;
    }
    return allow
      ? { ...deepClone(allow), requestId: request.requestId, subject: request.subject, capability: deepClone(request.capability) }
      : this.deny(request, 'Default deny: No matching permit policy');
  }

  public async issueLease(subject: string, capabilities: Capability[], ttlMs = 60000): Promise<Lease> {
    if (!this._isReady) throw new AgyError('PolicyEngine is not ready', { code: 'POLICY_NOT_READY', subsystem: 'policy', retryable: false });
    if (!this._runtimeState) throw new AgyError('RuntimeState is required for lease issuance', { code: 'POLICY_STATE_UNAVAILABLE', subsystem: 'policy', retryable: false });
    if (!subject || !Array.isArray(capabilities) || !Number.isFinite(ttlMs) || ttlMs <= 0) throw new AgyError('Invalid lease request', { code: 'LEASE_INVALID', subsystem: 'policy', retryable: false });

    for (const capability of capabilities) {
      const decision = await this.evaluate({ requestId: asUUID(randomUUID()), subject, capability: deepClone(capability) });
      if (decision.decision !== 'allow') throw new AgyError(`Policy denied lease capability ${capability.name} (${capability.scope}): ${decision.reason}`, { code: 'LEASE_DENIED', subsystem: 'policy', retryable: false });
    }

    const now = Date.now();
    const lease: Lease = {
      leaseId: asUUID(randomUUID()), subject, capabilities: deepClone(capabilities), issuedAt: now, expiresAt: now + ttlMs, revoked: false,
    };
    await this._runtimeState.grantLease(lease);
    return deepClone(lease);
  }

  public async validateLease(leaseId: UUID, requestedCapability: Capability): Promise<boolean> {
    if (!this._isReady || !this._runtimeState) return false;
    const lease = this._runtimeState.getLease(leaseId);
    if (!lease || lease.revoked || Date.now() >= lease.expiresAt) return false;
    return lease.capabilities.some((granted) => granted.name === requestedCapability.name
      && this.isScopeCovered(granted.scope, requestedCapability.scope)
      && this.constraintsCovered(granted.constraints, requestedCapability.constraints));
  }

  public async validateLeaseIdentity(leaseId: UUID, subject: string): Promise<boolean> {
    if (!this._isReady || !this._runtimeState) return false;
    const lease = this._runtimeState.getLease(leaseId);
    return !!lease && lease.subject === subject && !lease.revoked && Date.now() < lease.expiresAt;
  }

  public async revokeLease(leaseId: UUID): Promise<boolean> {
    if (!this._isReady || !this._runtimeState) return false;
    return this._runtimeState.revokeLease(leaseId);
  }

  public async sweepExpiredLeases(): Promise<number> {
    if (!this._isReady || !this._runtimeState) return 0;
    const now = Date.now(); let swept = 0;
    for (const [id, lease] of Object.entries(this._runtimeState.getSnapshot().leases)) {
      if (!lease.revoked && now >= lease.expiresAt && await this._runtimeState.revokeLease(asUUID(id))) swept++;
    }
    return swept;
  }

  private deny(request: PolicyRequest, reason: string): PolicyDecision {
    return { requestId: request.requestId, subject: request.subject, capability: deepClone(request.capability), decision: 'deny', reason, policyVersion: '1.0.0' };
  }

  private constraintsCovered(granted: Record<string, unknown> | undefined, requested: Record<string, unknown> | undefined): boolean {
    if (!requested) return true;
    if (!granted) return false;
    return Object.entries(requested).every(([key, value]) => deepEqual(granted[key], value));
  }

  private isScopeCovered(granted: string, requested: string): boolean {
    if (!granted || !requested) return false;
    if (granted === '*' || granted === requested) return true;
    if (granted.startsWith('/') && requested.startsWith('/')) {
      const g = path.resolve(granted); const r = path.resolve(requested);
      return r === g || r.startsWith(g + path.sep);
    }
    return requested.startsWith(granted + '/') || requested.startsWith(granted + '.');
  }
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null) return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const leftKeys = Object.keys(left as object); const rightKeys = Object.keys(right as object);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && deepEqual((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]));
}
