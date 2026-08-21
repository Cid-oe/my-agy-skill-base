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
export declare function createCliRuntime(): Promise<CliRuntime>;
export declare function handleCliCommand(args: string[], runtime?: CliRuntime): Promise<{
    success: boolean;
    output: string;
}>;
//# sourceMappingURL=cli.d.ts.map