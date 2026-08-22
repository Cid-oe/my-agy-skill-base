// Test fixture skill that never resolves, to exercise worker termination on
// timeout (SRC-1 hard isolation).
export async function execute() {
  return new Promise(() => {
    // intentionally never settles
  });
}
