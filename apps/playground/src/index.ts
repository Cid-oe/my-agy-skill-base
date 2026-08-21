/**
 * Interactive developer playground for testing and simulating AGY workflows.
 */

import { createCliRuntime, handleCliCommand } from '@agy/cli';

export async function runPlaygroundSimulation(): Promise<boolean> {
  const rt = await createCliRuntime();

  console.log('--- Starting AGY Playground Simulation ---');
  const statusRes = await handleCliCommand(['status'], rt);
  console.log(statusRes.output);

  await rt.kernel.shutdown();
  return statusRes.success;
}
