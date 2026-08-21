import { test } from 'node:test';
import assert from 'node:assert';
import { ReflectionEngine } from './reflection-engine.js';
import { RuntimeState } from '@agy/runtime-state';

test('ReflectionEngine performs read-only introspection over runtime state', async () => {
  const state = new RuntimeState();
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

  const reflection = new ReflectionEngine({ runtimeState: state });
  await reflection.boot();

  const report = await reflection.inspectRuntime();
  assert.strictEqual(report.runtimeVersion, 2);
  assert.strictEqual(report.activePlanCount, 1);
  assert.strictEqual(report.activeLeaseCount, 1);
  assert.strictEqual(report.snapshot.activePlans[0], 'plan-reflection-test');

  await reflection.shutdown();
  await state.shutdown();
});
