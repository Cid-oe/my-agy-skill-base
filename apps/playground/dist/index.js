"use strict";
/**
 * Interactive developer playground for testing and simulating AGY workflows.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPlaygroundSimulation = runPlaygroundSimulation;
const cli_1 = require("@agy/cli");
async function runPlaygroundSimulation() {
    const rt = await (0, cli_1.createCliRuntime)();
    console.log('--- Starting AGY Playground Simulation ---');
    const statusRes = await (0, cli_1.handleCliCommand)(['status'], rt);
    console.log(statusRes.output);
    await rt.kernel.shutdown();
    return statusRes.success;
}
//# sourceMappingURL=index.js.map