/**
 * Concrete Skill Resolver implementation.
 * Implements Matcher, Ranker, Backtracking Constraint Solver,
 * and DAG PlanBuilder per RFC-0001 / RFC-0001a.
 */
import { ExecutionPlan, SubsystemHealth, UUID } from '@agy/shared';
import { ISkillRegistry } from '@agy/registry';
import { Goal, ISkillResolver, ResolutionResult, ResolverRuntimeState } from './interfaces.js';
export declare class SkillResolver implements ISkillResolver {
    readonly id: UUID;
    readonly name = "skill-resolver";
    private _isReady;
    private _bootTime;
    start(): Promise<void>;
    stop(): Promise<void>;
    getHealth(): Promise<SubsystemHealth>;
    boot(): Promise<void>;
    shutdown(): Promise<void>;
    health(): SubsystemHealth;
    resolve(goal: Goal, registry: ISkillRegistry, state?: ResolverRuntimeState): Promise<ResolutionResult>;
    private backtrackSolve;
    private detectCycle;
    explainPlan(plan: ExecutionPlan): string;
    reresolve(plan: ExecutionPlan, failedNodeId: UUID, _state?: ResolverRuntimeState): Promise<ResolutionResult>;
    private evalPredicates;
    private rankCandidates;
    private checkExclusivity;
    private buildPlan;
}
//# sourceMappingURL=resolver.d.ts.map