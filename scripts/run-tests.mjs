import { readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

function findTestFiles(dir, fileList = []) {
  if (!statSync(dir).isDirectory()) return fileList;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        findTestFiles(fullPath, fileList);
      }
    } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
      fileList.push(path.resolve(fullPath));
    }
  }
  return fileList;
}

const testRoots = ['packages', 'apps', 'tests'];
const testFiles = testRoots.flatMap((root) => {
  const rootPath = path.resolve(root);
  return findTestFiles(rootPath);
});

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
