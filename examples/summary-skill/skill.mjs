// Reference executable skill module for AGY (runs inside an isolated worker).
// Declares a data dependency on EchoReport (see examples/echo-skill) so the
// resolver builds a 2-node plan with a data edge. This skill CONSUMES its
// upstream input: it parses the EchoReport artifact and derives its output from
// it, so callers can verify that input artifacts actually flow between skills.
export async function execute(context) {
  const inputs = (context && context.inputs) || [];
  if (inputs.length === 0) {
    throw new Error('summary-skill requires an EchoReport input artifact');
  }
  const echo = JSON.parse(inputs[0].data);
  const echoSum = echo.sum;
  return {
    skillId: 'summary-skill',
    report: 'Summary',
    echoSum, // mirrors the consumed EchoReport (4950)
    doubled: echoSum * 2, // 9900 — provably derived from the input
  };
}
