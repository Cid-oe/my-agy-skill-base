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
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SkillManifest, TaskContext, PlanNode, SubsystemHealth } from '@agy/shared';
import { findArtifactPaths, rankSkills, searchSkills, validateSkillDirectory } from './skill-hunt.js';

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
  skillPaths: Map<string, string>;
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

  // Connect scheduler task dispatcher to executor. Returns the ExecutionResult
  // so the scheduler can capture output artifacts and pass them downstream.
  scheduler.registerDispatcher(async (task: TaskContext, node: PlanNode) => {
    return executor.execute(task, node.limits);
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
    skillPaths: new Map(),
  };
}

export function initializeWorkspace(directory = process.cwd(), force = false): { created: string[] } {
  const configPath = path.join(directory, 'agy.config.json');
  const configExists = fs.existsSync(configPath);
  const created: string[] = [];
  for (const relative of ['.agy/state', '.agy/artifacts', '.agy/logs', 'skills']) {
    const target = path.join(directory, relative);
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
      created.push(relative);
    }
  }
  if (!configExists || force) {
    fs.writeFileSync(configPath, `${JSON.stringify({ version: 1, persistenceDir: '.agy', skillRoots: ['skills', 'examples'] }, null, 2)}\n`);
    created.push('agy.config.json');
  }
  return { created };
}

function manifestDirectories(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const found: string[] = [];
  const visit = (directory: string): void => {
    if (fs.existsSync(path.join(directory, 'manifest.json'))) {
      found.push(directory);
      return;
    }
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) visit(path.join(directory, entry.name));
    }
  };
  visit(root);
  return found;
}

async function scanSkillDirectory(rt: CliRuntime, directory: string): Promise<number> {
  let count = 0;
  for (const skillDirectory of manifestDirectories(directory)) {
    const validation = validateSkillDirectory(skillDirectory);
    if (!validation.manifest || validation.lines.some((line) => line.startsWith('FAIL'))) continue;
    await rt.registry.register(validation.manifest, skillDirectory);
    rt.skillPaths.set(validation.manifest.id, skillDirectory);
    count++;
  }
  return count;
}

function permissions(skill: SkillManifest): string {
  return skill.permissions.length === 0 ? 'none' : skill.permissions.map((permission) => `${permission.name}:${permission.scope}`).join(', ');
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

    if (cmd === 'init') {
      try {
        const initialized = initializeWorkspace(process.cwd(), subcmd === '--force' || rest.includes('--force'));
        return { success: true, output: `Initialized local AGY workspace (${initialized.created.length} paths created)` };
      } catch (error) {
        return { success: false, output: error instanceof Error ? error.message : String(error) };
      }
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

    if ((cmd === 'skill' && subcmd === 'scan') || (cmd === 'registry' && subcmd === 'scan')) {
      const scanDir = rest[0] || process.cwd();
      const discovered = await scanSkillDirectory(rt, scanDir);
      return { success: true, output: `Scanned ${scanDir}: found and registered ${discovered} skills` };
    }

    if (cmd === 'skill' && subcmd === 'search') {
      const query = rest.join(' ');
      if (!query) return { success: false, output: 'Usage: agy skill search <query>' };
      const matches = searchSkills(rt.registry.listAll(), query);
      return {
        success: true,
        output: matches.length === 0 ? `No skills match '${query}'` : [
          `=== Skill Search (${matches.length}) ===`,
          ...matches.map((skill) => `${skill.id}@${skill.version} — ${skill.description}\n  consumes: ${skill.consumes.join(', ') || 'none'}\n  produces: ${skill.produces.join(', ') || 'none'}\n  permissions: ${permissions(skill)}`),
        ].join('\n'),
      };
    }

    if (cmd === 'skill' && subcmd === 'inspect') {
      const skill = rt.registry.getActiveVersion(rest[0] || '');
      if (!skill) return { success: false, output: `Skill not found: ${rest[0] || '(missing id)'}` };
      return {
        success: true,
        output: [`${skill.id}@${skill.version} — ${skill.name}`, `Description: ${skill.description}`, `Consumes: ${skill.consumes.join(', ') || 'none'}`, `Produces: ${skill.produces.join(', ') || 'none'}`, `Permissions: ${permissions(skill)}`, `Capabilities: ${skill.capabilities.join(', ') || 'none'}`, `Entry point: ${skill.entryPoint}`, `Confidence: ${skill.confidenceThreshold}`].join('\n'),
      };
    }

    if (cmd === 'skill' && subcmd === 'validate') {
      if (!rest[0]) return { success: false, output: 'Usage: agy skill validate <directory>' };
      const validation = validateSkillDirectory(rest[0]);
      return { success: !validation.lines.some((line) => line.startsWith('FAIL')), output: [...validation.lines, `Score: ${validation.score}/100`].join('\n') };
    }

    if (cmd === 'skill' && subcmd === 'rank') {
      const flag = rest.indexOf('--produces');
      const artifact = flag >= 0 ? rest[flag + 1] : undefined;
      if (!artifact) return { success: false, output: 'Usage: agy skill rank --produces <artifact>' };
      const ranked = rankSkills(rt.registry.listAll(), artifact, rt.skillPaths);
      return {
        success: true,
        output: ranked.length === 0 ? `No skills produce ${artifact}` : [
          `=== Skill Rank for ${artifact} ===`,
          ...ranked.map((item) => `${item.score} ${item.manifest.id}@${item.manifest.version} — ${item.reasons.join('; ')}`),
        ].join('\n'),
      };
    }

    if (cmd === 'skill' && subcmd === 'paths') {
      const [fromArtifact, toArtifact] = rest;
      if (!fromArtifact || !toArtifact) return { success: false, output: 'Usage: agy skill paths <from-artifact> <to-artifact>' };
      const paths = findArtifactPaths(rt.registry.listAll(), fromArtifact, toArtifact);
      return {
        success: true,
        output: paths.length === 0 ? `No artifact path from ${fromArtifact} to ${toArtifact}` : paths.map((steps) => [fromArtifact, ...steps.flatMap((step) => [step.skillId, step.outputArtifact])].join(' -> ')).join('\n'),
      };
    }

    if (cmd === 'artifact' && subcmd === 'inspect') {
      const hash = rest[0] as import('@agy/shared').Hash | undefined;
      if (!hash) return { success: false, output: 'Usage: agy artifact inspect <hash>' };
      const envelope = await rt.store.getEnvelope(hash);
      if (!envelope) return { success: false, output: `Artifact not found: ${hash}` };
      const content = await rt.store.get(hash);
      const preview = content && (envelope.mimeType.includes('json') || envelope.mimeType.startsWith('text/')) ? content.toString('utf8').slice(0, 500) : '<binary>';
      return { success: true, output: [`Hash: ${envelope.hash}`, `Size: ${envelope.size}`, `MIME: ${envelope.mimeType}`, `Created By: ${envelope.createdBy.id}@${envelope.createdBy.version}`, `Created At: ${new Date(envelope.createdAt).toISOString()}`, `Metadata: ${JSON.stringify(envelope.metadata)}`, `Preview: ${preview}`].join('\n') };
    }

    if (cmd === 'run' || (cmd === 'goal' && subcmd === 'run')) {
      const goalDesc = cmd === 'run' ? (subcmd || 'default-goal') : (rest[0] || 'default-goal');
      const requiredArtifact = cmd === 'run' ? (rest[0] || 'DefaultArtifact') : (rest[1] || 'DefaultArtifact');

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
      output: `Unknown command: ${args.join(' ')}. Available commands: init, status, registry scan [dir], skill list|scan|search|inspect|validate|rank|paths, goal run <goal> <artifact>, run <goal> <artifact>, artifact inspect <hash>`,
    };
  } finally {
    if (!runtime) {
      await rt.kernel.shutdown();
    }
  }
}
