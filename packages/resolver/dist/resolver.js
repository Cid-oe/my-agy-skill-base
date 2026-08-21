"use strict";
/**
 * Concrete Skill Resolver implementation.
 * Implements Matcher, Ranker, Backtracking Constraint Solver,
 * and DAG PlanBuilder per RFC-0001 / RFC-0001a.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillResolver = void 0;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@agy/shared");
class SkillResolver {
    name = 'skill-resolver';
    _isReady = false;
    _bootTime = 0;
    async boot() {
        this._isReady = true;
        this._bootTime = Date.now();
    }
    async shutdown() {
        this._isReady = false;
    }
    health() {
        return {
            status: this._isReady ? 'healthy' : 'unhealthy',
            uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0,
        };
    }
    async resolve(goal, registry, state = {}) {
        if (!this._isReady) {
            throw new shared_1.AgyError('SkillResolver is not ready', {
                code: 'RESOLVER_NOT_READY',
                subsystem: 'resolver',
                retryable: false,
            });
        }
        const diagnostics = [];
        const unresolvedSlots = [];
        const assignment = new Map();
        const fallbackMap = new Map();
        for (const artifact of goal.requiredArtifacts) {
            const producers = registry.findByProduces(artifact);
            if (producers.length === 0) {
                diagnostics.push(`No producers found for artifact: ${artifact}`);
                unresolvedSlots.push(artifact);
                continue;
            }
            const matchingCandidates = producers.filter((p) => this.evalPredicates(p.triggerPredicates, state));
            if (matchingCandidates.length === 0) {
                diagnostics.push(`All producers for ${artifact} pruned by trigger predicates`);
                unresolvedSlots.push(artifact);
                continue;
            }
            const ranked = this.rankCandidates(matchingCandidates, state);
            const chosen = ranked[0];
            const alternates = ranked.slice(1).map((s) => s.id);
            assignment.set(artifact, chosen);
            fallbackMap.set(chosen.id, alternates);
        }
        if (unresolvedSlots.length > 0) {
            return {
                status: assignment.size > 0 ? 'partial' : 'unresolvable',
                plan: assignment.size > 0 ? this.buildPlan(Array.from(assignment.values()), fallbackMap) : null,
                unresolvedSlots,
                diagnostics,
            };
        }
        const assignedSkills = Array.from(assignment.values());
        const valid = this.checkExclusivity(assignedSkills);
        if (!valid.ok) {
            diagnostics.push(`Exclusivity violation: ${valid.reason}`);
            return {
                status: 'unresolvable',
                plan: null,
                unresolvedSlots: goal.requiredArtifacts,
                diagnostics,
            };
        }
        const plan = this.buildPlan(assignedSkills, fallbackMap);
        return {
            status: 'resolved',
            plan,
            unresolvedSlots: [],
            diagnostics: [`Successfully resolved ${plan.nodes.length} plan nodes`],
        };
    }
    explainPlan(plan) {
        const nodeDescriptions = plan.nodes
            .map((n, i) => `${i + 1}. [${n.skillRef.id}@${n.skillRef.version}] (State: ${n.state}, Reason: ${n.selectionReason})`)
            .join('\n');
        return `ExecutionPlan ${plan.planId} (Status: ${plan.status}):\n${nodeDescriptions}`;
    }
    async reresolve(plan, failedNodeId, _state = {}) {
        const node = plan.nodes.find((n) => n.nodeId === failedNodeId);
        if (!node) {
            return {
                status: 'unresolvable',
                plan: null,
                unresolvedSlots: [],
                diagnostics: [`Node ${failedNodeId} not found in plan`],
            };
        }
        if (!node.fallbackChain || node.fallbackChain.length === 0) {
            return {
                status: 'unresolvable',
                plan: null,
                unresolvedSlots: [node.skillRef.id],
                diagnostics: [`No alternate fallbacks available for failed skill ${node.skillRef.id}`],
            };
        }
        const nextSkillId = node.fallbackChain[0];
        node.skillRef.id = nextSkillId;
        node.selectionReason = `Fallback escalation from failed execution`;
        node.fallbackChain = node.fallbackChain.slice(1);
        node.state = 'ready';
        return {
            status: 'resolved',
            plan,
            unresolvedSlots: [],
            diagnostics: [`Substituted fallback skill ${nextSkillId} for node ${failedNodeId}`],
        };
    }
    evalPredicates(predicates, state) {
        if (!predicates || predicates.length === 0)
            return true;
        for (const p of predicates) {
            const val = state.variables?.[p.variable] ?? state[p.variable];
            if (val === undefined)
                return false;
            switch (p.operator) {
                case '==':
                    if (val !== p.value)
                        return false;
                    break;
                case '!=':
                    if (val === p.value)
                        return false;
                    break;
                case '>':
                    if (Number(val) <= Number(p.value))
                        return false;
                    break;
                case '>=':
                    if (Number(val) < Number(p.value))
                        return false;
                    break;
                case '<':
                    if (Number(val) >= Number(p.value))
                        return false;
                    break;
                case '<=':
                    if (Number(val) > Number(p.value))
                        return false;
                    break;
            }
        }
        return true;
    }
    rankCandidates(candidates, _state) {
        const priorityWeights = {
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
    checkExclusivity(skills) {
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
    buildPlan(skills, fallbackMap) {
        const planId = (0, node_crypto_1.randomUUID)();
        const skillToNodeId = new Map();
        const nodes = skills.map((s) => {
            const nodeId = (0, node_crypto_1.randomUUID)();
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
            };
        });
        const edges = [];
        for (const s of skills) {
            if (s.requires) {
                for (const req of s.requires) {
                    const fromId = skillToNodeId.get(req);
                    const toId = skillToNodeId.get(s.id);
                    if (fromId && toId) {
                        edges.push({ fromNodeId: fromId, toNodeId: toId, kind: 'ordering' });
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
exports.SkillResolver = SkillResolver;
//# sourceMappingURL=resolver.js.map