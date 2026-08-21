import { test } from 'node:test';
import assert from 'node:assert';
import { RuntimeState } from './runtime-state.js';
import { EventBus } from '@agy/event-bus';
import { Lease, LedgerEntry } from '@agy/shared';

test('RuntimeState applies transactions atomically and increments version', async () => {
  const bus = new EventBus();
  await bus.boot();

  const state = new RuntimeState({ eventBus: bus });
  await state.boot();

  const lease: Lease = {
    leaseId: 'lease-101',
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
  const fetchedLease = state.getLease('lease-101');
  assert.notStrictEqual(fetchedLease, null);
  assert.strictEqual(fetchedLease?.revoked, false);

  // Revoke lease
  const revoked = await state.revokeLease('lease-101');
  assert.strictEqual(revoked, true);
  assert.strictEqual(state.getLease('lease-101')?.revoked, true);

  await state.shutdown();
  await bus.shutdown();
});

test('RuntimeState maintains append-only execution ledgers', async () => {
  const state = new RuntimeState();
  await state.boot();

  await state.trackPlan('plan-uuid-1');

  const entry: LedgerEntry = {
    entryId: 'entry-1',
    planId: 'plan-uuid-1',
    action: 'NODE_DISPATCHED',
    timestamp: Date.now(),
  };

  await state.appendLedgerEntry('plan-uuid-1', entry);

  const ledger = state.getLedger('plan-uuid-1');
  assert.notStrictEqual(ledger, null);
  assert.strictEqual(ledger?.entries.length, 1);
  assert.strictEqual(ledger?.entries[0].action, 'NODE_DISPATCHED');

  await state.shutdown();
});
