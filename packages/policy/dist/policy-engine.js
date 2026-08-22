"use strict";
/**
 * Concrete Policy Engine implementation.
 * Enforces Deny-Overrides resolution, priority ordering, lease management,
 * and integration with Runtime State (RFC-0003, RFC-0003a).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyEngine = void 0;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@agy/shared");
class PolicyEngine {
    id = (0, shared_1.asUUID)('policy-engine');
    name = 'policy-engine';
    _policies = [];
    _runtimeState;
    _isReady = false;
    _bootTime = 0;
    constructor(options = {}) {
        this._runtimeState = options.runtimeState;
    }
    async boot() {
        this._isReady = true;
        this._bootTime = Date.now();
    }
    async shutdown() {
        this._isReady = false;
    }
    async start() { await this.boot(); }
    async stop() { await this.shutdown(); }
    async getHealth() { return Promise.resolve(this.health()); }
    health() {
        return {
            status: this._isReady ? 'healthy' : 'unhealthy',
            uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0,
        };
    }
    registerPolicy(policy) {
        this._policies.push(policy);
        // Sort by priority (lowest number = highest priority)
        this._policies.sort((a, b) => a.priority - b.priority);
    }
    unregisterPolicy(name) {
        this._policies = this._policies.filter((p) => p.name !== name);
    }
    async evaluate(request) {
        if (!this._isReady) {
            throw new shared_1.AgyError('PolicyEngine is not ready', {
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
    async issueLease(subject, capabilities, ttlMs = 60000) {
        const lease = {
            leaseId: (0, shared_1.asUUID)((0, node_crypto_1.randomUUID)()),
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
    async validateLease(leaseId, requestedCapability) {
        let lease = null;
        if (this._runtimeState) {
            lease = this._runtimeState.getLease(leaseId);
        }
        if (!lease)
            return false;
        if (lease.revoked)
            return false;
        if (Date.now() > lease.expiresAt)
            return false;
        // Check capability matching with scope normalization and subpath containment
        return lease.capabilities.some((c) => {
            if (c.name !== requestedCapability.name)
                return false;
            if (c.scope === '*' || c.scope === requestedCapability.scope)
                return true;
            // Subpath containment check (e.g. /workspace/project matches /workspace/project/subfile)
            if (c.scope && requestedCapability.scope && requestedCapability.scope.startsWith(c.scope)) {
                return true;
            }
            return false;
        });
    }
    async revokeLease(leaseId) {
        if (this._runtimeState) {
            return await this._runtimeState.revokeLease(leaseId);
        }
        return false;
    }
    async sweepExpiredLeases() {
        if (!this._runtimeState)
            return 0;
        const snapshot = this._runtimeState.getSnapshot();
        const now = Date.now();
        let swept = 0;
        for (const [id, lease] of Object.entries(snapshot.leases)) {
            if (!lease.revoked && now > lease.expiresAt) {
                await this._runtimeState.revokeLease((0, shared_1.asUUID)(id));
                swept++;
            }
        }
        return swept;
    }
}
exports.PolicyEngine = PolicyEngine;
//# sourceMappingURL=policy-engine.js.map