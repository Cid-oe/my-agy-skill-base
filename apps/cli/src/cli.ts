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
import { SkillManifest } from '@agy/shared';

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

export async function createCliRuntime(): Promise<CliRuntime> {
  const kernel = new Kernel();
  const bus = new EventBus();
  const store = new ArtifactStore({ eventBus: bus });
  const state = new RuntimeState({ eventBus: bus });
  const policy = new PolicyEngine({ runtimeState: state });
  const registry = new SkillRegistry({ eventBus: bus });
  const loader = new SkillLoader({ registry, eventBus: bus });
  const resolver = new SkillResolver();
  const scheduler = new Scheduler({ eventBus: bus, runtimeState: state });
  const executor = new Executor({
    skillLoader: loader,
    artifactStore: store,
    eventBus: bus,
  });
  const reflection = new ReflectionEngine({ runtimeState: state });

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

export async function handleCliCommand(
  args: string[],
  runtime?: CliRuntime
): Promise<{ success: boolean; output: string }> {
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
      const manifest = JSON.parse(manifestJson) as SkillManifest;
      const handle = await rt.registry.register(manifest);
      return { success: true, output: `Installed skill ${handle.id}@${handle.version}` };
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
      await rt.scheduler.tick();

      return {
        success: true,
        output: `Executed plan ${resResult.plan.planId} for goal '${goalDesc}'`,
      };
    }

    return {
      success: false,
      output: `Unknown command: ${args.join(' ')}. Available commands: status, skill install <json>, run <goal> <artifact>`,
    };
  } finally {
    if (!runtime) {
      await rt.kernel.shutdown();
    }
  }
}
