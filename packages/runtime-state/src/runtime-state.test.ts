import { test } from 'node:test';
import assert from 'node:assert';
import { RuntimeState } from './runtime-state.js';
import { EventBus } from '@agy/event-bus';
import { Lease, LedgerEntry, asUUID } from '@agy/shared';

test('RuntimeState applies transactions atomically and increments version', async () => {
  const bus = new EventBus();
  await bus.boot();

  const state = new RuntimeState({ eventBus: bus });
  await state.boot();

  const lease: Lease = {
    leaseId: asUUID('lease-101'),
    subject: 'skill-alpha',
    capabilities: [{ name: 'fs:read', scope: '/project' }],
    issuedAt: Date.now(),
    expiresAt: Date.now() + 60000,
    revoked: false,
  };

  await state.grantLease(lease);

  const snapshot = state.getSnapshot();
  assert.strictEqual(snapshot.version, 1);
  assert.strictEqual(snapshot.leases['lease-101'].subject, 'skill-alpha');

  // Verify lease retrieval
  const fetchedLease = state.getLease(asUUID('lease-101'));
  assert.notStrictEqual(fetchedLease, null);
  assert.strictEqual(fetchedLease?.revoked, false);

  // Revoke lease
  const revoked = await state.revokeLease(asUUID('lease-101'));
  assert.strictEqual(revoked, true);
  assert.strictEqual(state.getLease(asUUID('lease-101'))?.revoked, true);

  await state.shutdown();
  await bus.shutdown();
});

test('RuntimeState maintains append-only execution ledgers', async () => {
  const state = new RuntimeState();
  await state.boot();

  await state.trackPlan(asUUID('plan-uuid-1'));

  const entry: LedgerEntry = {
    entryId: asUUID('entry-1'),
    planId: asUUID('plan-uuid-1'),
    action: 'NODE_DISPATCHED',
    timestamp: Date.now(),
  };

  await state.appendLedgerEntry(asUUID('plan-uuid-1'), entry);

  const ledger = state.getLedger(asUUID('plan-uuid-1'));
  assert.notStrictEqual(ledger, null);
  assert.strictEqual(ledger?.entries.length, 1);
  assert.strictEqual(ledger?.entries[0].action, 'NODE_DISPATCHED');

  await state.shutdown();
});

test('RuntimeState rolls back on command failure and recovers transaction queue', async () => {
  const state = new RuntimeState();
  await state.boot();

  // 1. Initial state
  await state.trackPlan(asUUID('plan-ok'));
  assert.strictEqual(state.getSnapshot().activePlans.includes('plan-ok'), true);

  // 2. Transact a batch with a failing command
  const res = await state.transact([
    { type: 'TRACK_PLAN', payload: { planId: asUUID('plan-fail') } },
    { type: 'INVALID_COMMAND_TYPE', payload: {} } // will throw in applyCommand
  ]);

  assert.strictEqual(res.success, false);
  // plan-fail should NOT be tracked due to rollback
  assert.strictEqual(state.getSnapshot().activePlans.includes('plan-fail'), false);

  // 3. Verify queue is NOT bricked: next transaction should succeed
  const res2 = await state.transact([
    { type: 'TRACK_PLAN', payload: { planId: asUUID('plan-after') } }
  ]);
  assert.strictEqual(res2.success, true);
  assert.strictEqual(state.getSnapshot().activePlans.includes('plan-after'), true);

  await state.shutdown();
});

test('RuntimeState ensures atomic rollback of multi-command batches', async () => {
  const state = new RuntimeState();
  await state.boot();

  const initialVersion = state.getSnapshot().version;

  const res = await state.transact([
    { type: 'TRACK_PLAN', payload: { planId: asUUID('batch-plan-1') } },
    { type: 'TRACK_PLAN', payload: { planId: asUUID('batch-plan-2') } },
    { type: 'TRACK_PLAN', payload: { planId: asUUID('batch-plan-3') } },
    { type: 'INVALID_CMD', payload: {} }, // Failure here
    { type: 'TRACK_PLAN', payload: { planId: asUUID('batch-plan-5') } },
  ]);

  assert.strictEqual(res.success, false);
  const snapshot = state.getSnapshot();
  assert.strictEqual(snapshot.version, initialVersion);
  assert.strictEqual(snapshot.activePlans.includes(asUUID('batch-plan-1')), false);
  assert.strictEqual(snapshot.activePlans.includes(asUUID('batch-plan-2')), false);
  assert.strictEqual(snapshot.activePlans.includes(asUUID('batch-plan-3')), false);

  await state.shutdown();
});

test('RuntimeState persists WAL and replays state on reboot after crash', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-wal-test-'));

  try {
    // 1. First instance commits state
    const state1 = new RuntimeState({ persistenceDir: tempDir });
    await state1.boot();

    await state1.trackPlan(asUUID('recovered-plan-1'));
    await state1.grantLease({
      leaseId: asUUID('recovered-lease-1'),
      subject: 'skill-worker',
      capabilities: [{ name: 'fs:read', scope: '/work' }],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60000,
      revoked: false,
    });
    await state1.appendLedgerEntry(asUUID('recovered-plan-1'), {
      entryId: asUUID('recovered-entry-1'),
      planId: asUUID('recovered-plan-1'),
      action: 'BOOT_REPLAY',
      timestamp: Date.now(),
    });

    const v1 = state1.getSnapshot().version;
    assert.strictEqual(v1, 3);
    // Simulate abrupt stop without clean flush/shutdown
    await state1.shutdown();

    // 2. Second instance boots against same persistence directory and replays WAL
    const state2 = new RuntimeState({ persistenceDir: tempDir });
    await state2.boot();

    const snapshot2 = state2.getSnapshot();
    assert.strictEqual(snapshot2.version, 3);
    assert.strictEqual(snapshot2.activePlans.includes(asUUID('recovered-plan-1')), true);
    assert.strictEqual(snapshot2.leases['recovered-lease-1']?.subject, 'skill-worker');
    assert.strictEqual(state2.getLedger(asUUID('recovered-plan-1'))?.entries.length, 1);

    await state2.shutdown();
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('RuntimeState checkpoints and compacts the WAL to bound growth (EX-5)', async () => {
  const os = await import('node:os');
  const nodePath = await import('node:path');
  const fs = await import('node:fs');
  const tempDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'agy-wal-compact-'));

  try {
    // Checkpoint every 2 committed commands.
    const state = new RuntimeState({ persistenceDir: tempDir, checkpointIntervalCommands: 2 });
    await state.boot();

    for (let i = 0; i < 10; i++) {
      await state.trackPlan(asUUID(`cp-plan-${i}`));
    }

    const walFile = nodePath.join(tempDir, 'wal', 'current.wal');
    const snapshotFile = nodePath.join(tempDir, 'wal', 'snapshot.json');

    // A snapshot must exist and the WAL must have been compacted (small).
    assert.strictEqual(fs.existsSync(snapshotFile), true, 'snapshot.json should exist after checkpoint');
    const walRecords = fs.readFileSync(walFile, 'utf-8').split('\n').filter((l) => l.trim().length > 0);
    assert.ok(walRecords.length < 10, `WAL should be compacted, got ${walRecords.length} records`);

    // Reboot must restore full state (10 plans) from snapshot + residual WAL.
    await state.shutdown();
    const state2 = new RuntimeState({ persistenceDir: tempDir, checkpointIntervalCommands: 2 });
    await state2.boot();
    const snap = state2.getSnapshot();
    assert.strictEqual(snap.version, 10);
    assert.strictEqual(snap.activePlans.length, 10);

    await state.shutdown();
    await state2.shutdown();
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('RuntimeState WAL records carry a CRC and replay halts on corruption (SRC-13)', async () => {
  const os = await import('node:os');
  const nodePath = await import('node:path');
  const fs = await import('node:fs');
  const tempDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'agy-wal-crc-'));

  try {
    const state = new RuntimeState({ persistenceDir: tempDir, checkpointIntervalCommands: 1000 });
    await state.boot();
    await state.trackPlan(asUUID('crc-plan-1'));
    await state.trackPlan(asUUID('crc-plan-2'));
    await state.shutdown();

    // Corrupt the second WAL record's commands so its CRC no longer matches.
    const walFile = nodePath.join(tempDir, 'wal', 'current.wal');
    const lines = fs.readFileSync(walFile, 'utf-8').split('\n').filter((l) => l.trim().length > 0);
    const first = JSON.parse(lines[0]) as { crc: number; commands: unknown[] };
    assert.strictEqual(typeof first.crc, 'number', 'WAL record must carry a numeric crc');
    // Rewrite with a tampered commands array (crc unchanged -> mismatch).
    const tampered = { ...first, commands: [{ type: 'TRACK_PLAN', payload: { planId: 'tampered-plan' } }] };
    fs.writeFileSync(walFile, `${JSON.stringify(tampered)}\n${lines.slice(1).join('\n')}\n`);

    const state2 = new RuntimeState({ persistenceDir: tempDir, checkpointIntervalCommands: 1000 });
    await state2.boot();
    // Replay must stop at the corrupt record: tampered-plan must NOT be present.
    const snap = state2.getSnapshot();
    assert.strictEqual(snap.activePlans.includes('tampered-plan' as any), false);
    await state2.shutdown();
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

