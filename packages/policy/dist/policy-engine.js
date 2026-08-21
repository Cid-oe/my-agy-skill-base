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
            // Default allow if no restrictive policies installed
            return {
                requestId: request.requestId,
                subject: request.subject,
                capability: request.capability,
                decision: 'allow',
                reason: 'Default permit: No policies registered',
                policyVersion: '1.0.0',
            };
        }
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
        }
        return {
            requestId: request.requestId,
            subject: request.subject,
            capability: request.capability,
            decision: 'allow',
            reason: 'Permitted: All registered policies granted approval',
            policyVersion: '1.0.0',
        };
    }
    async issueLease(subject, capabilities, ttlMs = 60000) {
        const lease = {
            leaseId: (0, node_crypto_1.randomUUID)(),
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
        // Check capability matching
        return lease.capabilities.some((c) => c.name === requestedCapability.name && (c.scope === '*' || c.scope === requestedCapability.scope));
    }
    async revokeLease(leaseId) {
        if (this._runtimeState) {
            return await this._runtimeState.revokeLease(leaseId);
        }
        return false;
    }
}
exports.PolicyEngine = PolicyEngine;
//# sourceMappingURL=policy-engine.js.map