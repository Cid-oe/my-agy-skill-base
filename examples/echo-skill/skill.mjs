// Reference executable skill module for AGY (runs inside a restricted child process).
//
// A real skill exports an async `execute(context)` and returns a serializable
// result. The executor stores JSON.stringify(result) as the task's output
// artifact, content-addressed by SHA-256, stamped with the skill id/version.
// The result here is deterministic so callers can verify it by content hash.
export async function execute(_context) {
  // Real, verifiable computation: sum of 0..99.
  let sum = 0;
  for (let i = 0; i < 100; i++) sum += i;
  return {
    skillId: 'echo-skill',
    report: 'EchoReport',
    sum, // 4950
  };
}
