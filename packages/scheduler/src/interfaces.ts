/**
 * Scheduler interfaces and contracts.
 * Strictly implements Phase 3 (IScheduler), RFC-0007, and RFC-0007a.
 */

import { ExecutionPlan, ExecutionResult, PlanNode, SubsystemHealth, TaskContext, UUID } from '@agy/shared';
import { ISubsystem } from '@agy/shared';

/**
 * A task dispatcher runs a plan node. It may return the ExecutionResult so the
 * scheduler can capture output artifacts and pass them to downstream nodes
 * (input-artifact passing). Returning void is still allowed for simple dispatchers.
 */
export type TaskDispatcher = (task: TaskContext, node: PlanNode) => Promise<ExecutionResult | void>;

export interface IScheduler extends ISubsystem {
  submit(plan: ExecutionPlan): Promise<UUID>;
  cancel(planId: UUID): Promise<boolean>;
  getPlanStatus(planId: UUID): string | null;
  registerDispatcher(dispatcher: TaskDispatcher): void;
  tick(): Promise<number>; // dispatches ready tasks, returns dispatched count
  stopAccepting(): void;
  health(): Promise<SubsystemHealth> | SubsystemHealth;
}
