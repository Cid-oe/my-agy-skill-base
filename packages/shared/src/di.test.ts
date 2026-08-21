import { test } from 'node:test';
import assert from 'node:assert';
import { Container } from './di.js';
import { AgyError, ResolutionError } from './errors.js';

test('Container registers and resolves singleton instance', () => {
  const container = new Container();
  const service = { name: 'testService' };
  container.register('test', service);

  assert.strictEqual(container.has('test'), true);
  assert.strictEqual(container.resolve('test'), service);
});

test('Container registers and resolves factory instance', () => {
  const container = new Container();
  let count = 0;
  container.registerFactory('factoryTest', () => {
    count++;
    return { count };
  });

  const first = container.resolve<{ count: number }>('factoryTest');
  const second = container.resolve<{ count: number }>('factoryTest');
  assert.strictEqual(first.count, 1);
  assert.strictEqual(second.count, 1); // cached after first resolution
  assert.strictEqual(count, 1);
});

test('Error hierarchy captures code, subsystem and retryable flags', () => {
  const err = new ResolutionError('Could not resolve graph', { reason: 'cycle' }, false);
  assert.strictEqual(err instanceof AgyError, true);
  assert.strictEqual(err.subsystem, 'resolver');
  assert.strictEqual(err.code, 'RESOLUTION_FAILED');
  assert.strictEqual(err.retryable, false);
});
