/**
 * Skill Resolver interfaces and contracts.
 * Strictly implements Phase 3 (ISkillResolver), RFC-0001, and RFC-0001a.
 */
import { ExecutionPlan, PlanNode, SubsystemHealth, UUID } from '@agy/shared';
import { ISubsystem } from '@agy/shared';
import { ISkillRegistry } from '@agy/registry';
export interface Goal {
    id: string;
    kind: 'raw_request' | 'subtask';
    description: string;
    requiredArtifacts: string[];
    riskHint?: 'low' | 'high' | 'unknown';
}
export interface ResolverRuntimeState {
    conversationTokens?: number;
    filesTouched?: number;
    changedFiles?: number;
    variables?: Record<string, string | number | boolean>;
    availableArtifacts?: string[];
    priorFailures?: string[];
    costSensitivity?: 'low' | 'medium' | 'high';
}
export interface Slot {
    requestedArtifact: string;
    candidates: PlanNode[];
    filled: boolean;
}
export interface ResolutionResult {
    status: 'resolved' | 'partial' | 'unresolvable';
    plan: ExecutionPlan | null;
    unresolvedSlots: string[];
    diagnostics: string[];
}
export interface ISkillResolver extends ISubsystem {
    resolve(goal: Goal, registry: ISkillRegistry, state?: ResolverRuntimeState): Promise<ResolutionResult>;
    explainPlan(plan: ExecutionPlan): string;
    reresolve(plan: ExecutionPlan, failedNodeId: UUID, state?: ResolverRuntimeState): Promise<ResolutionResult>;
    health(): Promise<SubsystemHealth> | SubsystemHealth;
}
//# sourceMappingURL=interfaces.d.ts.map