/**
 * Scheduler interfaces and contracts.
 * Strictly implements Phase 3 (IScheduler), RFC-0007, and RFC-0007a.
 */

import { ExecutionPlan, PlanNode, SubsystemHealth, TaskContext, UUID } from '@agy/shared';
import { ISubsystem } from '@agy/kernel';

export type TaskDispatcher = (task: TaskContext, node: PlanNode) => Promise<void>;

export interface IScheduler extends ISubsystem {
  submit(plan: ExecutionPlan): Promise<UUID>;
  cancel(planId: UUID): Promise<boolean>;
  getPlanStatus(planId: UUID): string | null;
  registerDispatcher(dispatcher: TaskDispatcher): void;
  tick(): Promise<number>; // dispatches ready tasks, returns dispatched count
  stopAccepting(): void;
  health(): Promise<SubsystemHealth> | SubsystemHealth;
}
