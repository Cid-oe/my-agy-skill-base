/**
 * Operator CLI implementation for AGY Kernel.
 * Exposes commands: `run`, `skill install`, `status`.
 */

import { Kernel } from '@agy/kernel';
import { EventBus } from '@agy/event-bus';
import { RuntimeState } from '@agy/runtime-state';
import { ArtifactStore } from '@agy/artifact';
import { PolicyEngine } from '@agy/policy';
import { SkillRegistry, SkillLoader } from '@agy/registry';
import { SkillResolver } from '@agy/resolver';
import { Scheduler } from '@agy/scheduler';
import { Executor } from '@agy/executor';
import { ReflectionEngine } from '@agy/reflection';
import * as path from 'node:path';
import { SkillManifest, TaskContext, PlanNode, SubsystemHealth } from '@agy/shared';

export interface CliRuntime {
  kernel: Kernel;
  bus: EventBus;
  state: RuntimeState;
  store: ArtifactStore;
  policy: PolicyEngine;
  registry: SkillRegistry;
  loader: SkillLoader;
  resolver: SkillResolver;
  scheduler: Scheduler;
  executor: Executor;
  reflection: ReflectionEngine;
}

export interface CliRuntimeOptions {
  /**
   * When set, runtime state (WAL/ledgers/leases) and artifacts (CAS) are
   * persisted under this directory and recovered on reboot. When omitted the
   * runtime is in-memory (useful for tests and ephemeral runs).
   */
  persistenceDir?: string;
  /** Executor worker-pool size (defaults to 10). */
  maxWorkers?: number;
}

/**
 * Default durable data directory for the operator CLI: `$AGY_HOME` or
 * `<cwd>/.agy`. Used when handleCliCommand creates its own runtime so that
 * interactive `agy` usage is durable by default.
 */
export function defaultPersistenceDir(): string {
  return process.env.AGY_HOME ? process.env.AGY_HOME : path.resolve(process.cwd(), '.agy');
}

export async function createCliRuntime(options: CliRuntimeOptions = {}): Promise<CliRuntime> {
  const home = options.persistenceDir;
  const kernel = new Kernel();
  const bus = new EventBus();
  const store = new ArtifactStore({ eventBus: bus, persistenceDir: home ? path.join(home, 'artifacts') : undefined });
  const state = new RuntimeState({ eventBus: bus, persistenceDir: home ? path.join(home, 'state') : undefined });
  const policy = new PolicyEngine({ runtimeState: state });
  const registry = new SkillRegistry({ eventBus: bus });
  const loader = new SkillLoader({ registry, eventBus: bus });
  const resolver = new SkillResolver();
  const scheduler = new Scheduler({ eventBus: bus, runtimeState: state, policyEngine: policy });
  const executor = new Executor({
    skillLoader: loader,
    artifactStore: store,
    policyEngine: policy,
    eventBus: bus,
    maxWorkers: options.maxWorkers,
  });
  const reflection = new ReflectionEngine({ runtimeState: state });

  // Connect scheduler task dispatcher to executor
  scheduler.registerDispatcher(async (task: TaskContext, node: PlanNode) => {
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

export async function handleCliCommand(
  args: string[],
  runtime?: CliRuntime
): Promise<{ success: boolean; output: string }> {
  // When no runtime is supplied (e.g. the `agy` binary), default to durable
  // persistence so operator sessions survive restarts.
  const rt = runtime || (await createCliRuntime({ persistenceDir: defaultPersistenceDir() }));
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
        ...Object.entries(health).map(([k, v]) => `  ${k}: ${(v as SubsystemHealth).status}`),
      ].join('\n');

      return { success: true, output: summary };
    }

    if (cmd === 'skill' && subcmd === 'install') {
      const manifestJson = rest[0];
      if (!manifestJson) {
        return { success: false, output: 'Missing manifest payload' };
      }
      let manifest: SkillManifest;
      try {
        manifest = JSON.parse(manifestJson) as SkillManifest;
      } catch (e) {
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

      const resResult = await rt.resolver.resolve(
        {
          id: 'cli-goal',
          kind: 'subtask',
          description: goalDesc,
          requiredArtifacts: [requiredArtifact],
        },
        rt.registry
      );

      if (resResult.status !== 'resolved' || !resResult.plan) {
        return {
          success: false,
          output: `Resolution failed: ${resResult.diagnostics.join(', ')}`,
        };
      }

      await rt.scheduler.submit(resResult.plan);

      // The scheduler is pull-based: advance until the plan reaches a terminal
      // state. Reporting success after a single tick left multi-node plans
      // silently incomplete (EX-2).
      let status = rt.scheduler.getPlanStatus(resResult.plan.planId);
      let guard = 0;
      while (status === 'running' && guard < 100000) {
        await rt.scheduler.tick();
        status = rt.scheduler.getPlanStatus(resResult.plan.planId);
        guard++;
      }

      if (status !== 'completed') {
        return {
          success: false,
          output: `Plan ${resResult.plan.planId} for goal '${goalDesc}' did not complete (status: ${status})`,
        };
      }

      return {
        success: true,
        output: `Executed plan ${resResult.plan.planId} for goal '${goalDesc}' (status: completed)`,
      };
    }

    return {
      success: false,
      output: `Unknown command: ${args.join(' ')}. Available commands: status, skill list, skill scan [dir], skill install <json>, run <goal> <artifact>`,
    };
  } finally {
    if (!runtime) {
      await rt.kernel.shutdown();
    }
  }
}
