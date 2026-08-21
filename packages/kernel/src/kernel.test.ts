import { test } from 'node:test';
import assert from 'node:assert';
import { Kernel } from './kernel.js';
import { ISubsystem } from './interfaces.js';
import { SubsystemHealth } from '@agy/shared';

class MockSubsystem implements ISubsystem {
  public booted = false;
  public shutDown = false;
  constructor(public readonly name: string) {}

  async boot(): Promise<void> {
    this.booted = true;
  }

  async shutdown(): Promise<void> {
    this.shutDown = true;
  }

  health(): SubsystemHealth {
    return { status: 'healthy', uptimeMs: 100 };
  }
}

test('Kernel boots subsystems in order and reaches ready state', async () => {
  const kernel = new Kernel();
  const sub1 = new MockSubsystem('sub1');
  const sub2 = new MockSubsystem('sub2');

  kernel.registerSubsystem(sub1);
  kernel.registerSubsystem(sub2);

  const handle = await kernel.boot();
  assert.strictEqual(handle.state, 'ready');
  assert.strictEqual(sub1.booted, true);
  assert.strictEqual(sub2.booted, true);

  // Verification of health aggregation
  const health = await handle.health();
  assert.strictEqual(health['kernel'].status, 'healthy');
  assert.strictEqual(health['sub1'].status, 'healthy');
  assert.strictEqual(health['sub2'].status, 'healthy');

  // Verification of graceful shutdown
  await handle.shutdown();
  assert.strictEqual(kernel.state, 'shutdown');
  assert.strictEqual(sub1.shutDown, true);
  assert.strictEqual(sub2.shutDown, true);
});

test('Kernel shutdown is idempotent', async () => {
  const kernel = new Kernel();
  await kernel.boot();
  await kernel.shutdown();
  await kernel.shutdown(); // second call must succeed without error
  assert.strictEqual(kernel.state, 'shutdown');
});
