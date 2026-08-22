/**
 * Concrete Skill Resolver implementation.
 * Implements Matcher, Ranker, Backtracking Constraint Solver,
 * and DAG PlanBuilder per RFC-0001 / RFC-0001a.
 */

import { randomUUID } from 'node:crypto';
import {
  ExecutionPlan,
  PlanEdge,
  PlanNode,
  Predicate,
  SemVer,
  SkillManifest,
  SubsystemHealth,
  UUID,
  AgyError,
  asUUID,
} from '@agy/shared';
import { ISkillRegistry } from '@agy/registry';
import { Goal, ISkillResolver, ResolutionResult, ResolverRuntimeState } from './interfaces.js';

export class SkillResolver implements ISkillResolver {
  public readonly id: UUID = asUUID('skill-resolver');
  public readonly name = 'skill-resolver';
  private _isReady = false;
  private _bootTime = 0;

  public async start(): Promise<void> { await this.boot(); }
  public async stop(): Promise<void> { await this.shutdown(); }
  public async getHealth(): Promise<SubsystemHealth> { return Promise.resolve(this.health()); }

  public async boot(): Promise<void> {
    this._isReady = true;
    this._bootTime = Date.now();
  }

  public async shutdown(): Promise<void> {
    this._isReady = false;
  }

  public health(): SubsystemHealth {
    return {
      status: this._isReady ? 'healthy' : 'unhealthy',
      uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0,
    };
  }

  public async resolve(
    goal: Goal,
    registry: ISkillRegistry,
    state: ResolverRuntimeState = {}
  ): Promise<ResolutionResult> {
    if (!this._isReady) {
      throw new AgyError('SkillResolver is not ready', {
        code: 'RESOLVER_NOT_READY',
        subsystem: 'resolver',
        retryable: false,
      });
    }

    const diagnostics: string[] = [];
    const unresolvedSlots: string[] = [];

    // Step 1: Collect slots for all goal artifacts
    const slotCandidates = new Map<string, SkillManifest[]>();

    for (const artifact of goal.requiredArtifacts) {
      const producers = registry.findByProduces(artifact);
      if (producers.length === 0) {
        diagnostics.push(`No producers found for artifact: ${artifact}`);
        unresolvedSlots.push(artifact);
        continue;
      }

      const matching = producers.filter((p) => this.evalPredicates(p.triggerPredicates, state));
      if (matching.length === 0) {
        diagnostics.push(`All producers for ${artifact} pruned by trigger predicates`);
        unresolvedSlots.push(artifact);
        continue;
      }

      const ranked = this.rankCandidates(matching, state);
      slotCandidates.set(artifact, ranked);
    }

    if (unresolvedSlots.length > 0) {
      return {
        status: slotCandidates.size > 0 ? 'partial' : 'unresolvable',
        plan: null,
        unresolvedSlots,
        diagnostics,
      };
    }

    // Step 2: Recursive Backtracking Search with Transitive Dependency Expansion
    const artifacts = Array.from(slotCandidates.keys());
    const solution = this.backtrackSolve(0, artifacts, slotCandidates, new Map(), registry, state);

    if (!solution) {
      diagnostics.push('Exclusivity conflict or unresolvable transitive constraints among candidates');
      return {
        status: 'unresolvable',
        plan: null,
        unresolvedSlots: goal.requiredArtifacts,
        diagnostics,
      };
    }

    // Step 3: Check Cycle Detection on resolved skills
    const skillsList = Array.from(solution.skills.values());
    const cycle = this.detectCycle(skillsList);
    if (cycle) {
      diagnostics.push(`Cycle detected in dependency graph: ${cycle.join(' -> ')}`);
      return {
        status: 'unresolvable',
        plan: null,
        unresolvedSlots: goal.requiredArtifacts,
        diagnostics,
      };
    }

    const plan = this.buildPlan(skillsList, solution.fallbackMap);
    return {
      status: 'resolved',
      plan,
      unresolvedSlots: [],
      diagnostics: [`Successfully resolved ${plan.nodes.length} plan nodes`],
    };
  }

  private backtrackSolve(
    index: number,
    artifacts: string[],
    slotCandidates: Map<string, SkillManifest[]>,
    currentAssignment: Map<string, SkillManifest>,
    registry: ISkillRegistry,
    state: ResolverRuntimeState
  ): { skills: Map<string, SkillManifest>; fallbackMap: Map<string, string[]> } | null {
    if (index >= artifacts.length) {
      // Transitive expansion for all requires and consumes
      const allSkills = new Map<string, SkillManifest>();
      for (const skill of currentAssignment.values()) {
        allSkills.set(skill.id, skill);
      }

      const queue = Array.from(allSkills.values());
      const visited = new Set<string>(queue.map((s) => s.id));

      while (queue.length > 0) {
        const curr = queue.shift()!;
        // Expand direct skill requirements
        if (curr.requires) {
          for (const reqSkillId of curr.requires) {
            if (!visited.has(reqSkillId)) {
              const reqManifest = registry.getActiveVersion(reqSkillId);
              if (!reqManifest) return null; // Transitive dependency missing
              visited.add(reqSkillId);
              allSkills.set(reqSkillId, reqManifest);
              queue.push(reqManifest);
            }
          }
        }
        // Expand consumed artifact requirements
        if (curr.consumes) {
          for (const consumedArtifact of curr.consumes) {
            const producers = registry.findByProduces(consumedArtifact);
            if (producers.length > 0) {
              const prod = producers[0];
              if (!visited.has(prod.id)) {
                visited.add(prod.id);
                allSkills.set(prod.id, prod);
                queue.push(prod);
              }
            }
          }
        }
      }

      const skillsArray = Array.from(allSkills.values());
      const exclusivity = this.checkExclusivity(skillsArray);
      if (!exclusivity.ok) return null;

      const fallbackMap = new Map<string, string[]>();
      for (const [art, candidates] of slotCandidates.entries()) {
        const chosen = currentAssignment.get(art);
        if (chosen) {
          fallbackMap.set(
            chosen.id,
            candidates.filter((c) => c.id !== chosen.id).map((c) => c.id)
          );
        }
      }

      return { skills: allSkills, fallbackMap };
    }

    const artifact = artifacts[index];
    const candidates = slotCandidates.get(artifact) || [];

    for (const candidate of candidates) {
      currentAssignment.set(artifact, candidate);

      // Early exclusivity prune
      const partialSkills = Array.from(currentAssignment.values());
      if (this.checkExclusivity(partialSkills).ok) {
        const res = this.backtrackSolve(
          index + 1,
          artifacts,
          slotCandidates,
          currentAssignment,
          registry,
          state
        );
        if (res) return res;
      }

      currentAssignment.delete(artifact);
    }

    return null;
  }

  private detectCycle(skills: SkillManifest[]): string[] | null {
    const adj = new Map<string, string[]>();
    for (const s of skills) {
      adj.set(s.id, s.requires ? [...s.requires] : []);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = adj.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          path.push(neighbor);
          return true;
        }
      }

      path.pop();
      recStack.delete(node);
      return false;
    };

    for (const s of skills) {
      if (!visited.has(s.id)) {
        if (dfs(s.id)) {
          return path;
        }
      }
    }

    return null;
  }

  public explainPlan(plan: ExecutionPlan): string {
    const nodeDescriptions = plan.nodes
      .map(
        (n, i) =>
          `${i + 1}. [${n.skillRef.id}@${n.skillRef.version}] (State: ${n.state}, Reason: ${n.selectionReason})`
      )
      .join('\n');
    return `ExecutionPlan ${plan.planId} (Status: ${plan.status}):\n${nodeDescriptions}`;
  }

  public async reresolve(
    plan: ExecutionPlan,
    failedNodeId: UUID,
    _state: ResolverRuntimeState = {},
    registry?: ISkillRegistry
  ): Promise<ResolutionResult> {
    // Return immutable deep clone with substitution
    const targetNode = plan.nodes.find((n) => n.nodeId === failedNodeId);
    if (!targetNode) {
      return {
        status: 'unresolvable',
        plan: null,
        unresolvedSlots: [],
        diagnostics: [`Node ${failedNodeId} not found in plan`],
      };
    }

    if (!targetNode.fallbackChain || targetNode.fallbackChain.length === 0) {
      return {
        status: 'unresolvable',
        plan: null,
        unresolvedSlots: [targetNode.skillRef.id],
        diagnostics: [`No alternate fallbacks available for failed skill ${targetNode.skillRef.id}`],
      };
    }

    const nextSkillId = targetNode.fallbackChain[0];

    // Validate the fallback skill exists and resolve its version before
    // substituting (SRC-12). Without a registry the substitution is preserved
    // for backwards compatibility but cannot be validated.
    let nextVersion: string | undefined;
    if (registry) {
      const fallbackManifest = registry.getActiveVersion(nextSkillId);
      if (!fallbackManifest) {
        return {
          status: 'unresolvable',
          plan: null,
          unresolvedSlots: [nextSkillId],
          diagnostics: [`Fallback skill ${nextSkillId} is not registered`],
        };
      }
      nextVersion = fallbackManifest.version;
    }

    const newNodes: PlanNode[] = plan.nodes.map((n) => {
      if (n.nodeId === failedNodeId) {
        return {
          ...n,
          skillRef: {
            ...n.skillRef,
            id: nextSkillId,
            ...(nextVersion ? { version: nextVersion as SemVer } : {}),
            registryRef: `registry://${nextSkillId}@${nextVersion ?? n.skillRef.version}`,
          },
          selectionReason: `Fallback escalation from failed execution`,
          fallbackChain: n.fallbackChain ? n.fallbackChain.slice(1) : [],
          state: 'ready',
        };
      }
      return {
        ...n,
        skillRef: { ...n.skillRef },
        fallbackChain: n.fallbackChain ? [...n.fallbackChain] : [],
      };
    });

    const newPlan: ExecutionPlan = {
      planId: asUUID(randomUUID()),
      nodes: newNodes,
      edges: plan.edges.map((e) => ({ ...e })),
      createdAt: Date.now(),
      status: 'pending',
    };

    return {
      status: 'resolved',
      plan: newPlan,
      unresolvedSlots: [],
      diagnostics: [`Substituted fallback skill ${nextSkillId} for node ${failedNodeId}`],
    };
  }

  private evalPredicates(predicates: Predicate[], state: ResolverRuntimeState): boolean {
    if (!predicates || predicates.length === 0) return true;
    for (const p of predicates) {
      const val = state.variables?.[p.variable] ?? (state as Record<string, unknown>)[p.variable];
      if (val === undefined) return false;

      switch (p.operator) {
        case '==':
          if (val !== p.value) return false;
          break;
        case '!=':
          if (val === p.value) return false;
          break;
        case '>':
          if (Number(val) <= Number(p.value)) return false;
          break;
        case '>=':
          if (Number(val) < Number(p.value)) return false;
          break;
        case '<':
          if (Number(val) >= Number(p.value)) return false;
          break;
        case '<=':
          if (Number(val) > Number(p.value)) return false;
          break;
      }
    }
    return true;
  }

  private rankCandidates(candidates: SkillManifest[], _state: ResolverRuntimeState): SkillManifest[] {
    const priorityWeights: Record<string, number> = {
      critical: 1000,
      high: 500,
      medium: 100,
      low: 10,
    };

    return [...candidates].sort((a, b) => {
      const scoreA = (priorityWeights[a.priority] || 100) + a.confidenceThreshold * 100;
      const scoreB = (priorityWeights[b.priority] || 100) + b.confidenceThreshold * 100;
      return scoreB - scoreA;
    });
  }

  private checkExclusivity(skills: SkillManifest[]): { ok: boolean; reason?: string } {
    for (let i = 0; i < skills.length; i++) {
      for (let j = i + 1; j < skills.length; j++) {
        const s1 = skills[i];
        const s2 = skills[j];
        if (s1.exclusiveWith?.includes(s2.id) || s2.exclusiveWith?.includes(s1.id)) {
          return {
            ok: false,
            reason: `Mutually exclusive skills '${s1.id}' and '${s2.id}' cannot be in same plan`,
          };
        }
      }
    }
    return { ok: true };
  }

  private buildPlan(
    skills: SkillManifest[],
    fallbackMap: Map<string, string[]>
  ): ExecutionPlan {
    const planId = asUUID(randomUUID());
    const skillToNodeId = new Map<string, UUID>();

    const nodes: PlanNode[] = skills.map((s) => {
      const nodeId = asUUID(randomUUID());
      skillToNodeId.set(s.id, nodeId);
      return {
        nodeId,
        skillRef: {
          id: s.id,
          version: s.version,
          registryRef: `registry://${s.id}@${s.version}`,
          lifecycleState: 'loaded',
        },
        inputs: [],
        limits: { maxDurationMs: 60000 },
        state: 'ready',
        selectionReason: `Selected via highest priority ranking`,
        confidenceThreshold: s.confidenceThreshold,
        fallbackChain: fallbackMap.get(s.id) || [],
        requiredCapabilities: s.permissions ? [...s.permissions] : [],
        priority: s.priority,
      };
    });

    const edges: PlanEdge[] = [];

    // Index which skill (in this plan) produces each artifact, so consumed
    // artifacts can be wired as data dependencies (SRC-11).
    const producesIndex = new Map<string, string>();
    for (const s of skills) {
      for (const produced of s.produces ?? []) {
        producesIndex.set(produced, s.id);
      }
    }

    for (const s of skills) {
      // ordering edges from declared skill requirements
      if (s.requires) {
        for (const req of s.requires) {
          const fromId = skillToNodeId.get(req);
          const toId = skillToNodeId.get(s.id);
          if (fromId && toId) {
            edges.push({ fromNodeId: fromId, toNodeId: toId, kind: 'ordering' });
          }
        }
      }
      // data edges from consumed artifacts produced by another plan skill
      for (const consumed of s.consumes ?? []) {
        const producerSkillId = producesIndex.get(consumed);
        if (producerSkillId && producerSkillId !== s.id) {
          const fromId = skillToNodeId.get(producerSkillId);
          const toId = skillToNodeId.get(s.id);
          if (fromId && toId) {
            edges.push({ fromNodeId: fromId, toNodeId: toId, kind: 'data' });
          }
        }
      }
    }

    return {
      planId,
      nodes,
      edges,
      createdAt: Date.now(),
      status: 'pending',
    };
  }
}
