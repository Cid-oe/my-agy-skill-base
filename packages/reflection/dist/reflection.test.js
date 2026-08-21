"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const reflection_engine_js_1 = require("./reflection-engine.js");
const runtime_state_1 = require("@agy/runtime-state");
(0, node_test_1.test)('ReflectionEngine performs read-only introspection over runtime state', async () => {
    const state = new runtime_state_1.RuntimeState();
    await state.boot();
    await state.trackPlan('plan-reflection-test');
    await state.grantLease({
        leaseId: 'lease-ref-1',
        subject: 'skill-alpha',
        capabilities: [],
        issuedAt: Date.now(),
        expiresAt: Date.now() + 60000,
        revoked: false,
    });
    const reflection = new reflection_engine_js_1.ReflectionEngine({ runtimeState: state });
    await reflection.boot();
    const report = await reflection.inspectRuntime();
    node_assert_1.default.strictEqual(report.runtimeVersion, 2);
    node_assert_1.default.strictEqual(report.activePlanCount, 1);
    node_assert_1.default.strictEqual(report.activeLeaseCount, 1);
    node_assert_1.default.strictEqual(report.snapshot.activePlans[0], 'plan-reflection-test');
    await reflection.shutdown();
    await state.shutdown();
});
//# sourceMappingURL=reflection.test.js.map