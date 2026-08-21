import { test } from 'node:test';
import assert from 'node:assert';
import { generateSyntheticCatalog, generateSyntheticManifest } from './fixtures.js';

test('Testkit generates synthetic manifests and large catalogs', () => {
  const single = generateSyntheticManifest('test-1');
  assert.strictEqual(single.id, 'test-1');
  assert.strictEqual(single.produces[0], 'Artifact-test-1');

  const catalog = generateSyntheticCatalog(100);
  assert.strictEqual(catalog.length, 100);
  assert.strictEqual(catalog[99].id, 'skill-99');
});
