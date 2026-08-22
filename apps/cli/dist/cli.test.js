"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const cli_js_1 = require("./cli.js");
const shared_1 = require("@agy/shared");
(0, node_test_1.test)('CLI status command inspects runtime and subsystems', async () => {
    const rt = await (0, cli_js_1.createCliRuntime)();
    const res = await (0, cli_js_1.handleCliCommand)(['status'], rt);
    node_assert_1.default.strictEqual(res.success, true);
    node_assert_1.default.strictEqual(res.output.includes('=== AGY Kernel Status ==='), true);
    node_assert_1.default.strictEqual(res.output.includes('kernel: healthy'), true);
    await rt.kernel.shutdown();
});
(0, node_test_1.test)('CLI skill install and run executes full end-to-end workflow', async () => {
    const rt = await (0, cli_js_1.createCliRuntime)();
    const manifest = {
        id: 'cli-sample-skill',
        name: 'CLI Sample Skill',
        version: (0, shared_1.asSemVer)('1.0.0'),
        description: 'Executes sample workflow',
        priority: 'high',
        requires: [],
        optional: [],
        consumes: [],
        produces: ['SampleArtifact'],
        exclusiveWith: [],
        confidenceThreshold: 0.9,
        triggerPredicates: [],
        permissions: [],
        capabilities: ['workflow'],
        entryPoint: 'index.ts',
    };
    const installRes = await (0, cli_js_1.handleCliCommand)(['skill', 'install', JSON.stringify(manifest)], rt);
    node_assert_1.default.strictEqual(installRes.success, true);
    node_assert_1.default.strictEqual(installRes.output.includes('Installed skill cli-sample-skill@1.0.0'), true);
    const runRes = await (0, cli_js_1.handleCliCommand)(['run', 'Process data', 'SampleArtifact'], rt);
    node_assert_1.default.strictEqual(runRes.success, true);
    node_assert_1.default.strictEqual(runRes.output.includes('Executed plan'), true);
    // Skill list verification
    const listRes = await (0, cli_js_1.handleCliCommand)(['skill', 'list'], rt);
    node_assert_1.default.strictEqual(listRes.success, true);
    node_assert_1.default.strictEqual(listRes.output.includes('cli-sample-skill@1.0.0'), true);
    // Invalid JSON error handling
    const badJsonRes = await (0, cli_js_1.handleCliCommand)(['skill', 'install', '{not-valid-json}'], rt);
    node_assert_1.default.strictEqual(badJsonRes.success, false);
    node_assert_1.default.strictEqual(badJsonRes.output.includes('Invalid JSON manifest'), true);
    await rt.kernel.shutdown();
});
//# sourceMappingURL=cli.test.js.map