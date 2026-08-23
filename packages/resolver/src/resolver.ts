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
  SkillManifest,
  SubsystemHealth,
  UUID,
  AgyError,
  asUUID,
  deepClone,
} from '@agy/shared';
import { ISkillRegistry } from '@agy/registry';
import { Goal, ISkillResolver, ResolutionResult, ResolverRuntimeState } from './interfaces.js';
import { satisfiesVersion } from './version-constraints.js';

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
    const cycle = this.detectCycle(skillsList, state);
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

      const initialSkills = new Map(allSkills);
      const expanded = this.expandTransitiveDependencies(initialSkills, registry, state);
      if (!expanded) return null;
      const skillsArray = Array.from(expanded.values());
      allSkills.clear();
      for (const skill of skillsArray) allSkills.set(skill.id, skill);
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

  /**
   * Expand requires/consumes with backtracking across multiple artifact
   * producers. Each branch gets fresh maps so an incompatible producer cannot
   * poison the remaining alternatives.
   */
  private expandTransitiveDependencies(
    initial: Map<string, SkillManifest>,
    registry: ISkillRegistry,
    state: ResolverRuntimeState
  ): Map<string, SkillManifest> | null {
    const expand = (skills: Map<string, SkillManifest>, pending: SkillManifest[], visited: Set<string>): Map<string, SkillManifest> | null => {
      const current = pending.shift();
      if (!current) return skills;

      const nextSkills = new Map(skills);
      const nextPending = [...pending];
      const nextVisited = new Set(visited);
      for (const requiredId of current.requires ?? []) {
        const required = registry.getActiveVersion(requiredId);
        if (!required) return null;
        if (current.requiresSkillVersion && !satisfiesVersion(required.version, current.requiresSkillVersion, requiredId)) return null;
        if (!nextVisited.has(requiredId)) {
          nextVisited.add(requiredId);
          nextSkills.set(requiredId, required);
          nextPending.push(required);
        }
      }

      const consumed = (current.consumes ?? []).filter((artifact) => !state.availableArtifacts?.includes(artifact));
      const chooseProducer = (
        index: number,
        branchSkills: Map<string, SkillManifest>,
        branchPending: SkillManifest[],
        branchVisited: Set<string>
      ): Map<string, SkillManifest> | null => {
        if (index >= consumed.length) return expand(branchSkills, branchPending, branchVisited);
        const artifact = consumed[index];
        const candidates = this.rankCandidates(
          registry.findByProduces(artifact).filter((candidate) => this.evalPredicates(candidate.triggerPredicates, state)),
          state
        );
        for (const producer of candidates) {
          if (producer.id === current.id) continue;
          const candidateSkills = new Map(branchSkills);
          const candidatePending = [...branchPending];
          const candidateVisited = new Set(branchVisited);
          if (!candidateVisited.has(producer.id)) {
            candidateVisited.add(producer.id);
            candidateSkills.set(producer.id, producer);
            candidatePending.push(producer);
          }
          const result = chooseProducer(index + 1, candidateSkills, candidatePending, candidateVisited);
          if (result) return result;
        }
        return null;
      };

      return chooseProducer(0, nextSkills, nextPending, nextVisited);
    };

    return expand(new Map(initial), [...initial.values()], new Set(initial.keys()));
  }

  /**
   * Detect cycles in the resolved skill dependency graph using Tarjan's
   * strongly-connected-components algorithm (SRC-10). Returns a node-id path
   * describing the first cyclic SCC, or null if the graph is acyclic.
   */
  private detectCycle(skills: SkillManifest[], state: ResolverRuntimeState): string[] | null {
    const adj = new Map<string, string[]>();
    const nodes = new Set<string>();
    for (const s of skills) {
      nodes.add(s.id);
      const deps = (s.requires ? [...s.requires] : []).filter((r) => skills.some((x) => x.id === r));
      for (const consumed of s.consumes ?? []) {
        if (state.availableArtifacts?.includes(consumed)) continue;
        const producer = skills.find((candidate) => candidate.produces?.includes(consumed));
        if (producer) deps.push(producer.id);
      }
      adj.set(s.id, [...new Set(deps)]);
    }

    let index = 0;
    const stack: string[] = [];
    const onStack = new Set<string>();
    const indices = new Map<string, number>();
    const lowlinks = new Map<string, number>();
    let cyclic: string[] | null = null;

    const strongConnect = (v: string): void => {
      indices.set(v, index);
      lowlinks.set(v, index);
      index++;
      stack.push(v);
      onStack.add(v);

      for (const w of adj.get(v) ?? []) {
        if (!indices.has(w)) {
          strongConnect(w);
          lowlinks.set(v, Math.min(lowlinks.get(v)!, lowlinks.get(w)!));
        } else if (onStack.has(w)) {
          lowlinks.set(v, Math.min(lowlinks.get(v)!, indices.get(w)!));
        }
      }

      if (lowlinks.get(v) === indices.get(v)) {
        // Root of an SCC: pop until v.
        const component: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          component.push(w);
        } while (w !== v);

        const selfLoop = component.length === 1 && (adj.get(component[0]) ?? []).includes(component[0]);
        if (component.length > 1 || selfLoop) {
          cyclic = reconstructCycle(component, adj);
        }
      }
    };

    // Reconstruct an explicit cycle path within a cyclic SCC.
    const reconstructCycle = (component: string[], adjacency: Map<string, string[]>): string[] => {
      const inComp = new Set(component);
      const start = component[0];
      const path: string[] = [start];
      const seen = new Set<string>([start]);
      let current = start;
      // Walk edges that stay inside the component until we return to start.
      for (let i = 0; i < component.length; i++) {
        const next = (adjacency.get(current) ?? []).find((n) => inComp.has(n));
        if (!next) break;
        path.push(next);
        if (next === start) break;
        if (seen.has(next)) break;
        seen.add(next);
        current = next;
      }
      return path;
    };

    for (const n of nodes) {
      if (!indices.has(n)) {
        strongConnect(n);
        if (cyclic) return cyclic;
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
    state: ResolverRuntimeState = {},
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

    // A fallback is executable only when a registry can validate its identity,
    // output contract, dependencies, and security metadata. Accepting an
    // arbitrary ID here would bypass the resolver and policy preparation path.
    if (!registry) {
      return {
        status: 'unresolvable', plan: null, unresolvedSlots: [nextSkillId],
        diagnostics: ['A registry is required to validate fallback substitutions'],
      };
    }
    const fallbackManifest = registry.getActiveVersion(nextSkillId);
    const originalManifest = registry.getActiveVersion(targetNode.skillRef.id);
    if (!fallbackManifest || !originalManifest) {
      return {
        status: 'unresolvable', plan: null, unresolvedSlots: [nextSkillId],
        diagnostics: [`Fallback skill ${nextSkillId} is not registered`],
      };
    }
    if (!fallbackManifest.produces.some((artifact) => originalManifest.produces.includes(artifact))) {
      return {
        status: 'unresolvable', plan: null, unresolvedSlots: [nextSkillId],
        diagnostics: [`Fallback skill ${nextSkillId} does not produce an output of ${targetNode.skillRef.id}`],
      };
    }
    const planSkillIds = new Set(plan.nodes.map((node) => node.skillRef.id));
    for (const dependency of fallbackManifest.requires) {
      if (!registry.getActiveVersion(dependency)) {
        return {
          status: 'unresolvable', plan: null, unresolvedSlots: [dependency],
          diagnostics: [`Fallback skill ${nextSkillId} requires missing skill ${dependency}`],
        };
      }
      if (!planSkillIds.has(dependency)) {
        return {
          status: 'unresolvable', plan: null, unresolvedSlots: [dependency],
          diagnostics: [`Fallback skill ${nextSkillId} requires a dependency absent from the existing plan: ${dependency}`],
        };
      }
    }
    for (const consumed of fallbackManifest.consumes) {
      if (state.availableArtifacts?.includes(consumed)) continue;
      const hasProducer = plan.nodes.some((node) => node.skillRef.id !== nextSkillId
        && registry.getActiveVersion(node.skillRef.id)?.produces.includes(consumed));
      if (!hasProducer) {
        return {
          status: 'unresolvable', plan: null, unresolvedSlots: [consumed],
          diagnostics: [`Fallback skill ${nextSkillId} has an input absent from the existing plan: ${consumed}`],
        };
      }
    }

    const newNodes: PlanNode[] = plan.nodes.map((n) => {
      if (n.nodeId === failedNodeId) {
        return {
          ...n,
          skillRef: {
            ...n.skillRef,
            id: fallbackManifest.id,
            version: fallbackManifest.version,
            registryRef: `registry://${fallbackManifest.id}@${fallbackManifest.version}`,
            lifecycleState: 'loaded',
          },
          inputs: deepClone(n.inputs),
          limits: deepClone(n.limits),
          selectionReason: 'Fallback escalation from failed execution',
          fallbackChain: n.fallbackChain ? n.fallbackChain.slice(1) : [],
          confidenceThreshold: fallbackManifest.confidenceThreshold,
          requiredCapabilities: deepClone(fallbackManifest.permissions ?? []),
          priority: fallbackManifest.priority,
          state: 'ready',
        };
      }
      return {
        ...n,
        skillRef: deepClone(n.skillRef),
        inputs: deepClone(n.inputs),
        limits: deepClone(n.limits),
        requiredCapabilities: deepClone(n.requiredCapabilities ?? []),
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
        requiredCapabilities: deepClone(s.permissions ?? []),
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
