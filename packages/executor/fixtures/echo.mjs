// Test fixture skill executed inside a restricted child process (SRC-2, SRC-3).
// Exports a real execute(context) that performs actual computation.
export async function execute(context) {
  const { taskId } = context ?? {};
  // Real work: compute a deterministic value the kernel could not fabricate.
  let acc = 0;
  for (let i = 0; i < 1000; i++) acc += i;
  return {
    skillId: 'worker-echo-skill',
    taskId,
    computed: acc, // 499500
    echoed: context,
    source: 'worker',
  };
}
