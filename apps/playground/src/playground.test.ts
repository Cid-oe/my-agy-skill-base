import { test } from 'node:test';
import assert from 'node:assert';
import { runPlaygroundSimulation } from './index.js';

test('Playground simulation runs end-to-end sandbox check', async () => {
  const success = await runPlaygroundSimulation();
  assert.strictEqual(success, true);
});
