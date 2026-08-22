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

  health(): SubsystemHealth | Promise<SubsystemHealth> {
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

test('Kernel rolls back booted subsystems in reverse order on boot failure', async () => {
  const kernel = new Kernel();
  const sub1 = new MockSubsystem('sub1');
  const subFail = new MockSubsystem('subFail');
  subFail.boot = async () => {
    throw new Error('Explosion during boot');
  };

  kernel.registerSubsystem(sub1);
  kernel.registerSubsystem(subFail);

  await assert.rejects(
    async () => {
      await kernel.boot();
    },
    (err: any) => {
      return err.code === 'BOOT_FAILED';
    }
  );

  assert.strictEqual(kernel.state, 'shutdown');
  assert.strictEqual(sub1.booted, true);
  assert.strictEqual(sub1.shutDown, true); // Rolled back cleanly!
});

test('Kernel handles hanging subsystem health checks gracefully', async () => {
  const kernel = new Kernel();
  const sub1 = new MockSubsystem('sub1');
  const subHanging = new MockSubsystem('subHanging');
  subHanging.health = async () => {
    await new Promise((r) => setTimeout(r, 5000));
    return { status: 'healthy', uptimeMs: 0 };
  };

  kernel.registerSubsystem(sub1);
  kernel.registerSubsystem(subHanging);

  await kernel.boot();
  const health = await kernel.health();

  assert.strictEqual(health['sub1'].status, 'healthy');
  assert.strictEqual(health['subHanging'].status, 'unhealthy');

  await kernel.shutdown();
});
