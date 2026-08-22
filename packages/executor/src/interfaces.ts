/**
 * Executor interfaces and contracts.
 * Strictly implements Phase 3 (IExecutor) and RFC-0008.
 */

import { ExecutionLimits, ExecutionResult, SubsystemHealth, TaskContext } from '@agy/shared';
import { ISubsystem } from '@agy/shared';
import { ISkillLoader } from '@agy/registry';
import { IArtifactStore } from '@agy/artifact';
import { IPolicyEngine } from '@agy/policy';
import { IEventBus } from '@agy/event-bus';

export interface PoolStatus {
  activeWorkers: number;
  availableWorkers: number;
  queuedTasks: number;
  totalCapacity: number;
}

export interface ExecutorOptions {
  skillLoader: ISkillLoader;
  artifactStore?: IArtifactStore;
  policyEngine?: IPolicyEngine;
  eventBus?: IEventBus;
  maxWorkers?: number;
}

export interface IExecutor extends ISubsystem {
  execute(task: TaskContext, limits?: ExecutionLimits): Promise<ExecutionResult>;
  getPoolStatus(): PoolStatus;
  drain(): Promise<void>;
  health(): Promise<SubsystemHealth> | SubsystemHealth;
}
