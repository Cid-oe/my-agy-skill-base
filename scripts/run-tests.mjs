import { globSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const rawFiles = globSync([
  'packages/*/dist/**/*.test.js',
  'apps/*/dist/**/*.test.js',
  'tests/dist/**/*.test.js',
], { ignore: ['**/node_modules/**'] });

const testFiles = Array.from(new Set(rawFiles.map((f) => path.resolve(f))));

console.log(`\n======================================================`);
console.log(` Running ${testFiles.length} test suites across the AGY monorepo...`);
console.log(`======================================================\n`);

let passed = 0;
let failed = 0;
const startTotal = performance.now();

for (const file of testFiles) {
  const relPath = path.relative(process.cwd(), file);
  try {
    execFileSync(process.execPath, ['--test', file], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10000,
    });
    console.log(`PASS: ${relPath}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${relPath}`);
    if (err.stdout) console.error(err.stdout);
    if (err.stderr) console.error(err.stderr);
    failed++;
  }
}

const totalDuration = (performance.now() - startTotal).toFixed(2);
console.log(`\n======================================================`);
console.log(` Test Suites: ${passed} passed, ${failed} failed, ${testFiles.length} total`);
console.log(` Time:        ${totalDuration}ms`);
console.log(`======================================================\n`);

process.exit(failed > 0 ? 1 : 0);
