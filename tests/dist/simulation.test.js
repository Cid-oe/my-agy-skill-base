"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const cli_1 = require("@agy/cli");
const testkit_1 = require("@agy/testkit");
(0, node_test_1.test)('End-to-End Autonomous Simulation: multi-skill workflow execution', async () => {
    const rt = await (0, cli_1.createCliRuntime)();
    // Install a pipeline of 3 skills: Stage1 -> Stage2 -> Stage3
    const s1 = (0, testkit_1.generateSyntheticManifest)('pipeline-stage1', { produces: ['Artifact-S1'] });
    const s2 = (0, testkit_1.generateSyntheticManifest)('pipeline-stage2', { requires: ['pipeline-stage1'], produces: ['Artifact-S2'] });
    const s3 = (0, testkit_1.generateSyntheticManifest)('pipeline-stage3', { requires: ['pipeline-stage2'], produces: ['Artifact-S3'] });
    await rt.registry.register(s1);
    await rt.registry.register(s2);
    await rt.registry.register(s3);
    const goal = {
        id: 'sim-goal-1',
        kind: 'subtask',
        description: 'Execute multi-stage autonomous pipeline',
        requiredArtifacts: ['Artifact-S3'],
    };
    const res = await rt.resolver.resolve(goal, rt.registry);
    node_assert_1.default.strictEqual(res.status, 'resolved');
    node_assert_1.default.strictEqual(res.plan?.nodes.length, 1);
    await rt.scheduler.submit(res.plan);
    await rt.scheduler.tick();
    // Allow asynchronous worker execution to complete
    await new Promise((r) => setTimeout(r, 50));
    await rt.scheduler.tick();
    const status = rt.scheduler.getPlanStatus(res.plan.planId);
    node_assert_1.default.strictEqual(status, 'completed');
    await rt.kernel.shutdown();
});
//# sourceMappingURL=simulation.test.js.map