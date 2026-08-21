"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const runtime_state_js_1 = require("./runtime-state.js");
const event_bus_1 = require("@agy/event-bus");
(0, node_test_1.test)('RuntimeState applies transactions atomically and increments version', async () => {
    const bus = new event_bus_1.EventBus();
    await bus.boot();
    const state = new runtime_state_js_1.RuntimeState({ eventBus: bus });
    await state.boot();
    const lease = {
        leaseId: 'lease-101',
        subject: 'skill-alpha',
        capabilities: [{ name: 'fs:read', scope: '/project' }],
        issuedAt: Date.now(),
        expiresAt: Date.now() + 60000,
        revoked: false,
    };
    await state.grantLease(lease);
    const snapshot = state.getSnapshot();
    node_assert_1.default.strictEqual(snapshot.version, 1);
    node_assert_1.default.strictEqual(snapshot.leases['lease-101'].subject, 'skill-alpha');
    // Verify lease retrieval
    const fetchedLease = state.getLease('lease-101');
    node_assert_1.default.notStrictEqual(fetchedLease, null);
    node_assert_1.default.strictEqual(fetchedLease?.revoked, false);
    // Revoke lease
    const revoked = await state.revokeLease('lease-101');
    node_assert_1.default.strictEqual(revoked, true);
    node_assert_1.default.strictEqual(state.getLease('lease-101')?.revoked, true);
    await state.shutdown();
    await bus.shutdown();
});
(0, node_test_1.test)('RuntimeState maintains append-only execution ledgers', async () => {
    const state = new runtime_state_js_1.RuntimeState();
    await state.boot();
    await state.trackPlan('plan-uuid-1');
    const entry = {
        entryId: 'entry-1',
        planId: 'plan-uuid-1',
        action: 'NODE_DISPATCHED',
        timestamp: Date.now(),
    };
    await state.appendLedgerEntry('plan-uuid-1', entry);
    const ledger = state.getLedger('plan-uuid-1');
    node_assert_1.default.notStrictEqual(ledger, null);
    node_assert_1.default.strictEqual(ledger?.entries.length, 1);
    node_assert_1.default.strictEqual(ledger?.entries[0].action, 'NODE_DISPATCHED');
    await state.shutdown();
});
//# sourceMappingURL=runtime-state.test.js.map