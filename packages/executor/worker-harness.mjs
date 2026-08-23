// Worker harness for the Sandboxed Executor (SRC-1, SRC-2, SRC-3).
//
// Runs in a worker thread isolated from the main kernel process. Dynamically
// imports the skill module at `modulePath` and invokes its exported
// `execute(context)` function, posting the result (or error) back to the
// parent. This file is a static runtime asset resolved relative to the
// compiled executor (packages/executor/dist -> ../worker-harness.mjs).
import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';

async function run() {
  if (isMainThread || !parentPort || !workerData) {
    return;
  }
  const { modulePath, context } = workerData;
  try {
    // Dynamic import treats a Windows absolute path as a URL with a `c:`
    // scheme. Convert filesystem paths explicitly while still accepting an
    // already-qualified module URL from a caller.
    const moduleUrl = modulePath.startsWith('file:') ? modulePath : pathToFileURL(modulePath).href;
    const mod = await import(moduleUrl);
    const execute = typeof mod.execute === 'function'
      ? mod.execute
      : typeof mod.default === 'function'
        ? mod.default
        : mod.default && typeof mod.default.execute === 'function'
          ? mod.default.execute
          : undefined;

    if (typeof execute !== 'function') {
      throw new Error(`Skill module ${modulePath} does not export an execute(context) function`);
    }

    const result = await execute(context);
    parentPort.postMessage({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    parentPort.postMessage({ ok: false, error: message, stack });
  }
}

run();
