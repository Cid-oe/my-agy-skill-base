// Child-process execution harness. Results travel over a private IPC callback;
// the callback is hidden from the skill before its module is imported.

let sendToParent;
let finished = false;

function sendResult(value, exitCode = 0) {
  try {
    sendToParent?.(value, () => process.exit(exitCode));
  } catch {
    process.exit(exitCode);
  }
}

function hideControlChannel() {
  sendToParent = process.send?.bind(process);
  try { Object.defineProperty(process, 'send', { value: undefined, configurable: false, writable: false }); } catch { /* best effort */ }
  try { Object.defineProperty(process, 'channel', { value: undefined, configurable: false, writable: false }); } catch { /* best effort */ }
}

async function execute(input) {
  const { modulePath, functionSource, context, manifest } = input;
  let handler;
  if (modulePath) {
    const mod = await import(modulePath);
    handler = typeof mod.execute === 'function' ? mod.execute
      : typeof mod.default === 'function' ? mod.default
        : mod.default && typeof mod.default.execute === 'function' ? mod.default.execute : undefined;
  } else if (functionSource) {
    const factory = Function('manifest', `return (${functionSource});`);
    handler = factory(manifest);
  }
  if (typeof handler !== 'function') throw new Error('Skill does not export execute(context)');
  return handler(context);
}

process.on('message', async (input) => {
  if (finished) return;
  finished = true;
  hideControlChannel();
  try {
    const result = await execute(input);
    sendResult({ ok: true, result });
  } catch (err) {
    sendResult({ ok: false, error: err instanceof Error ? err.message : String(err), stack: err?.stack }, 1);
  }
});

process.on('uncaughtException', (err) => {
  if (!finished) sendResult({ ok: false, error: err.message, stack: err.stack }, 1);
  else process.exit(1);
});
process.on('unhandledRejection', (err) => {
  if (!finished) sendResult({ ok: false, error: String(err) }, 1);
  else process.exit(1);
});
