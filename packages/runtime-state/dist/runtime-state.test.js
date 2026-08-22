"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const runtime_state_js_1 = require("./runtime-state.js");
const event_bus_1 = require("@agy/event-bus");
const shared_1 = require("@agy/shared");
(0, node_test_1.test)('RuntimeState applies transactions atomically and increments version', async () => {
    const bus = new event_bus_1.EventBus();
    await bus.boot();
    const state = new runtime_state_js_1.RuntimeState({ eventBus: bus });
    await state.boot();
    const lease = {
        leaseId: (0, shared_1.asUUID)('lease-101'),
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
    const fetchedLease = state.getLease((0, shared_1.asUUID)('lease-101'));
    node_assert_1.default.notStrictEqual(fetchedLease, null);
    node_assert_1.default.strictEqual(fetchedLease?.revoked, false);
    // Revoke lease
    const revoked = await state.revokeLease((0, shared_1.asUUID)('lease-101'));
    node_assert_1.default.strictEqual(revoked, true);
    node_assert_1.default.strictEqual(state.getLease((0, shared_1.asUUID)('lease-101'))?.revoked, true);
    await state.shutdown();
    await bus.shutdown();
});
(0, node_test_1.test)('RuntimeState maintains append-only execution ledgers', async () => {
    const state = new runtime_state_js_1.RuntimeState();
    await state.boot();
    await state.trackPlan((0, shared_1.asUUID)('plan-uuid-1'));
    const entry = {
        entryId: (0, shared_1.asUUID)('entry-1'),
        planId: (0, shared_1.asUUID)('plan-uuid-1'),
        action: 'NODE_DISPATCHED',
        timestamp: Date.now(),
    };
    await state.appendLedgerEntry((0, shared_1.asUUID)('plan-uuid-1'), entry);
    const ledger = state.getLedger((0, shared_1.asUUID)('plan-uuid-1'));
    node_assert_1.default.notStrictEqual(ledger, null);
    node_assert_1.default.strictEqual(ledger?.entries.length, 1);
    node_assert_1.default.strictEqual(ledger?.entries[0].action, 'NODE_DISPATCHED');
    await state.shutdown();
});
(0, node_test_1.test)('RuntimeState rolls back on command failure and recovers transaction queue', async () => {
    const state = new runtime_state_js_1.RuntimeState();
    await state.boot();
    // 1. Initial state
    await state.trackPlan((0, shared_1.asUUID)('plan-ok'));
    node_assert_1.default.strictEqual(state.getSnapshot().activePlans.includes('plan-ok'), true);
    // 2. Transact a batch with a failing command
    const res = await state.transact([
        { type: 'TRACK_PLAN', payload: { planId: (0, shared_1.asUUID)('plan-fail') } },
        { type: 'INVALID_COMMAND_TYPE', payload: {} } // will throw in applyCommand
    ]);
    node_assert_1.default.strictEqual(res.success, false);
    // plan-fail should NOT be tracked due to rollback
    node_assert_1.default.strictEqual(state.getSnapshot().activePlans.includes('plan-fail'), false);
    // 3. Verify queue is NOT bricked: next transaction should succeed
    const res2 = await state.transact([
        { type: 'TRACK_PLAN', payload: { planId: (0, shared_1.asUUID)('plan-after') } }
    ]);
    node_assert_1.default.strictEqual(res2.success, true);
    node_assert_1.default.strictEqual(state.getSnapshot().activePlans.includes('plan-after'), true);
    await state.shutdown();
});
(0, node_test_1.test)('RuntimeState ensures atomic rollback of multi-command batches', async () => {
    const state = new runtime_state_js_1.RuntimeState();
    await state.boot();
    const initialVersion = state.getSnapshot().version;
    const res = await state.transact([
        { type: 'TRACK_PLAN', payload: { planId: (0, shared_1.asUUID)('batch-plan-1') } },
        { type: 'TRACK_PLAN', payload: { planId: (0, shared_1.asUUID)('batch-plan-2') } },
        { type: 'TRACK_PLAN', payload: { planId: (0, shared_1.asUUID)('batch-plan-3') } },
        { type: 'INVALID_CMD', payload: {} }, // Failure here
        { type: 'TRACK_PLAN', payload: { planId: (0, shared_1.asUUID)('batch-plan-5') } },
    ]);
    node_assert_1.default.strictEqual(res.success, false);
    const snapshot = state.getSnapshot();
    node_assert_1.default.strictEqual(snapshot.version, initialVersion);
    node_assert_1.default.strictEqual(snapshot.activePlans.includes((0, shared_1.asUUID)('batch-plan-1')), false);
    node_assert_1.default.strictEqual(snapshot.activePlans.includes((0, shared_1.asUUID)('batch-plan-2')), false);
    node_assert_1.default.strictEqual(snapshot.activePlans.includes((0, shared_1.asUUID)('batch-plan-3')), false);
    await state.shutdown();
});
(0, node_test_1.test)('RuntimeState persists WAL and replays state on reboot after crash', async () => {
    const os = await import('node:os');
    const path = await import('node:path');
    const fs = await import('node:fs');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-wal-test-'));
    try {
        // 1. First instance commits state
        const state1 = new runtime_state_js_1.RuntimeState({ persistenceDir: tempDir });
        await state1.boot();
        await state1.trackPlan((0, shared_1.asUUID)('recovered-plan-1'));
        await state1.grantLease({
            leaseId: (0, shared_1.asUUID)('recovered-lease-1'),
            subject: 'skill-worker',
            capabilities: [{ name: 'fs:read', scope: '/work' }],
            issuedAt: Date.now(),
            expiresAt: Date.now() + 60000,
            revoked: false,
        });
        await state1.appendLedgerEntry((0, shared_1.asUUID)('recovered-plan-1'), {
            entryId: (0, shared_1.asUUID)('recovered-entry-1'),
            planId: (0, shared_1.asUUID)('recovered-plan-1'),
            action: 'BOOT_REPLAY',
            timestamp: Date.now(),
        });
        const v1 = state1.getSnapshot().version;
        node_assert_1.default.strictEqual(v1, 3);
        // Simulate abrupt stop without clean flush/shutdown
        await state1.shutdown();
        // 2. Second instance boots against same persistence directory and replays WAL
        const state2 = new runtime_state_js_1.RuntimeState({ persistenceDir: tempDir });
        await state2.boot();
        const snapshot2 = state2.getSnapshot();
        node_assert_1.default.strictEqual(snapshot2.version, 3);
        node_assert_1.default.strictEqual(snapshot2.activePlans.includes((0, shared_1.asUUID)('recovered-plan-1')), true);
        node_assert_1.default.strictEqual(snapshot2.leases['recovered-lease-1']?.subject, 'skill-worker');
        node_assert_1.default.strictEqual(state2.getLedger((0, shared_1.asUUID)('recovered-plan-1'))?.entries.length, 1);
        await state2.shutdown();
    }
    finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
//# sourceMappingURL=runtime-state.test.js.map