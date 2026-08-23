// Reference executable skill module for AGY (runs inside an isolated worker).
// Declares a data dependency on EchoReport (see examples/echo-skill) so the
// resolver builds a 2-node plan with a data edge. Returns a deterministic
// result so callers can verify it by content hash.
export async function execute(_context) {
  // Real, verifiable computation.
  let total = 0;
  for (let i = 0; i < 100; i++) total += i * 2;
  return {
    skillId: 'summary-skill',
    report: 'Summary',
    total, // 9900
  };
}
