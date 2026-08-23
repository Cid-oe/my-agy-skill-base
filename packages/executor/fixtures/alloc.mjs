// Test fixture skill that exceeds a small heap memory limit (SRC-4).
// Allocates many heap-resident objects so the worker breaches
// maxOldGenerationSizeMb (Node worker resourceLimits).
export async function execute() {
  const arr = [];
  for (let i = 0; i < 4_000_000; i++) {
    arr.push({ i, s: 'x'.repeat(64) });
  }
  return { count: arr.length };
}
