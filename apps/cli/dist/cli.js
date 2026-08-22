"use strict";
/**
 * Operator CLI implementation for AGY Kernel.
 * Exposes commands: `run`, `skill install`, `status`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCliRuntime = createCliRuntime;
exports.handleCliCommand = handleCliCommand;
const kernel_1 = require("@agy/kernel");
const event_bus_1 = require("@agy/event-bus");
const runtime_state_1 = require("@agy/runtime-state");
const artifact_1 = require("@agy/artifact");
const policy_1 = require("@agy/policy");
const registry_1 = require("@agy/registry");
const resolver_1 = require("@agy/resolver");
const scheduler_1 = require("@agy/scheduler");
const executor_1 = require("@agy/executor");
const reflection_1 = require("@agy/reflection");
async function createCliRuntime() {
    const kernel = new kernel_1.Kernel();
    const bus = new event_bus_1.EventBus();
    const store = new artifact_1.ArtifactStore({ eventBus: bus });
    const state = new runtime_state_1.RuntimeState({ eventBus: bus });
    const policy = new policy_1.PolicyEngine({ runtimeState: state });
    const registry = new registry_1.SkillRegistry({ eventBus: bus });
    const loader = new registry_1.SkillLoader({ registry, eventBus: bus });
    const resolver = new resolver_1.SkillResolver();
    const scheduler = new scheduler_1.Scheduler({ eventBus: bus, runtimeState: state });
    const executor = new executor_1.Executor({
        skillLoader: loader,
        artifactStore: store,
        eventBus: bus,
    });
    const reflection = new reflection_1.ReflectionEngine({ runtimeState: state });
    // Connect scheduler task dispatcher to executor
    scheduler.registerDispatcher(async (task, node) => {
        await executor.execute(task, node.limits);
    });
    // Register in topological startup order per Phase 5
    kernel.registerSubsystem(bus);
    kernel.registerSubsystem(store);
    kernel.registerSubsystem(policy);
    kernel.registerSubsystem(state);
    kernel.registerSubsystem(registry);
    kernel.registerSubsystem(loader);
    kernel.registerSubsystem(resolver);
    kernel.registerSubsystem(scheduler);
    kernel.registerSubsystem(executor);
    kernel.registerSubsystem(reflection);
    await kernel.boot();
    return {
        kernel,
        bus,
        state,
        store,
        policy,
        registry,
        loader,
        resolver,
        scheduler,
        executor,
        reflection,
    };
}
async function handleCliCommand(args, runtime) {
    const rt = runtime || (await createCliRuntime());
    const [cmd, subcmd, ...rest] = args;
    try {
        if (cmd === 'status') {
            const report = await rt.reflection.inspectRuntime();
            const health = await rt.kernel.health();
            const summary = [
                '=== AGY Kernel Status ===',
                `Runtime Version: ${report.runtimeVersion}`,
                `Active Plans: ${report.activePlanCount}`,
                `Active Leases: ${report.activeLeaseCount}`,
                '--- Subsystem Health ---',
                ...Object.entries(health).map(([k, v]) => `  ${k}: ${v.status}`),
            ].join('\n');
            return { success: true, output: summary };
        }
        if (cmd === 'skill' && subcmd === 'install') {
            const manifestJson = rest[0];
            if (!manifestJson) {
                return { success: false, output: 'Missing manifest payload' };
            }
            let manifest;
            try {
                manifest = JSON.parse(manifestJson);
            }
            catch (e) {
                return { success: false, output: `Invalid JSON manifest: ${e instanceof Error ? e.message : String(e)}` };
            }
            const handle = await rt.registry.register(manifest);
            return { success: true, output: `Installed skill ${handle.id}@${handle.version}` };
        }
        if (cmd === 'skill' && subcmd === 'list') {
            const skills = rt.registry.listAll();
            const output = [
                `=== Registered Skills (${skills.length}) ===`,
                ...skills.map((s) => `  - ${s.id}@${s.version} [${s.name}] produces: [${s.produces.join(', ')}]`),
            ].join('\n');
            return { success: true, output };
        }
        if (cmd === 'skill' && subcmd === 'scan') {
            const scanDir = rest[0] || process.cwd();
            const discovered = await rt.registry.scan([scanDir]);
            return { success: true, output: `Scanned ${scanDir}: found and registered ${discovered.length} skills` };
        }
        if (cmd === 'run') {
            const goalDesc = subcmd || 'default-goal';
            const requiredArtifact = rest[0] || 'DefaultArtifact';
            const resResult = await rt.resolver.resolve({
                id: 'cli-goal',
                kind: 'subtask',
                description: goalDesc,
                requiredArtifacts: [requiredArtifact],
            }, rt.registry);
            if (resResult.status !== 'resolved' || !resResult.plan) {
                return {
                    success: false,
                    output: `Resolution failed: ${resResult.diagnostics.join(', ')}`,
                };
            }
            await rt.scheduler.submit(resResult.plan);
            await rt.scheduler.tick();
            return {
                success: true,
                output: `Executed plan ${resResult.plan.planId} for goal '${goalDesc}'`,
            };
        }
        return {
            success: false,
            output: `Unknown command: ${args.join(' ')}. Available commands: status, skill list, skill scan [dir], skill install <json>, run <goal> <artifact>`,
        };
    }
    finally {
        if (!runtime) {
            await rt.kernel.shutdown();
        }
    }
}
//# sourceMappingURL=cli.js.map