"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const policy_engine_js_1 = require("./policy-engine.js");
const runtime_state_1 = require("@agy/runtime-state");
(0, node_test_1.test)('PolicyEngine enforces Deny-Overrides and Priority Precedence', async () => {
    const engine = new policy_engine_js_1.PolicyEngine();
    await engine.boot();
    const allowPolicy = {
        name: 'GeneralAllow',
        priority: 100,
        evaluate: (req) => ({
            requestId: req.requestId,
            subject: req.subject,
            capability: req.capability,
            decision: 'allow',
            reason: 'General allow rule',
            policyVersion: '1.0.0',
        }),
    };
    const securityDenyPolicy = {
        name: 'SecurityDeny',
        priority: 1, // High priority
        evaluate: (req) => {
            if (req.capability.name === 'fs:delete_root') {
                return {
                    requestId: req.requestId,
                    subject: req.subject,
                    capability: req.capability,
                    decision: 'deny',
                    reason: 'Protected root path violation',
                    policyVersion: '1.0.0',
                };
            }
            return {
                requestId: req.requestId,
                subject: req.subject,
                capability: req.capability,
                decision: 'allow',
                reason: 'Safe capability',
                policyVersion: '1.0.0',
            };
        },
    };
    engine.registerPolicy(allowPolicy);
    engine.registerPolicy(securityDenyPolicy);
    const safeReq = {
        requestId: 'req-1',
        subject: 'skill-reader',
        capability: { name: 'fs:read', scope: '/project' },
    };
    const deniedReq = {
        requestId: 'req-2',
        subject: 'skill-rogue',
        capability: { name: 'fs:delete_root', scope: '/' },
    };
    const safeDecision = await engine.evaluate(safeReq);
    node_assert_1.default.strictEqual(safeDecision.decision, 'allow');
    const denyDecision = await engine.evaluate(deniedReq);
    node_assert_1.default.strictEqual(denyDecision.decision, 'deny');
    node_assert_1.default.strictEqual(denyDecision.reason, 'Protected root path violation');
    await engine.shutdown();
});
(0, node_test_1.test)('PolicyEngine issues and validates Leases against RuntimeState', async () => {
    const state = new runtime_state_1.RuntimeState();
    await state.boot();
    const engine = new policy_engine_js_1.PolicyEngine({ runtimeState: state });
    await engine.boot();
    const lease = await engine.issueLease('agent-worker-1', [{ name: 'network:outbound', scope: 'api.google.com' }], 60000);
    const isValid = await engine.validateLease(lease.leaseId, {
        name: 'network:outbound',
        scope: 'api.google.com',
    });
    node_assert_1.default.strictEqual(isValid, true);
    const isInvalidCapability = await engine.validateLease(lease.leaseId, {
        name: 'fs:write',
        scope: '/etc',
    });
    node_assert_1.default.strictEqual(isInvalidCapability, false);
    // Revoke lease
    await engine.revokeLease(lease.leaseId);
    const isPostRevokeValid = await engine.validateLease(lease.leaseId, {
        name: 'network:outbound',
        scope: 'api.google.com',
    });
    node_assert_1.default.strictEqual(isPostRevokeValid, false);
    await engine.shutdown();
    await state.shutdown();
});
//# sourceMappingURL=policy-engine.test.js.map