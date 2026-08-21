/**
 * Canonical types and interfaces for the AGY Kernel ecosystem.
 * Strictly implements Phase 3 and Phase 4 of the AGY Kernel Implementation Plan.
 */

export type UUID = string;
export type Hash = string;
export type SemVer = string;
export type Timestamp = number;

export type SkillLifecycleState =
  | 'unloaded'
  | 'loading'
  | 'loaded'
  | 'active'
  | 'draining'
  | 'failed';

export interface Predicate {
  variable: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: string | number | boolean;
}

export interface Capability {
  name: string;
  scope: string;
  constraints?: Record<string, unknown>;
}

export interface Permission {
  capability: Capability;
  effect: 'allow' | 'deny';
  priority: number;
}

export interface SkillManifest {
  id: string;
  name: string;
  version: SemVer;
  description: string;
  author?: string;
  license?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  requires: string[];
  optional: string[];
  consumes: string[];
  produces: string[];
  exclusiveWith: string[];
  estimatedCost?: 'low' | 'medium' | 'high';
  estimatedLatency?: 'fast' | 'medium' | 'slow';
  estimatedContext?: 'low' | 'medium' | 'high';
  confidenceThreshold: number;
  escalateTo?: string | null;
  triggerPredicates: Predicate[];
  permissions: Capability[];
  capabilities: string[];
  entryPoint: string;
  hooks?: {
    onLoad?: string | null;
    onUnload?: string | null;
    onValidate?: string | null;
  };
  requiresSkillVersion?: string;
  minAgyVersion?: string;
  deprecated?: boolean;
  deprecatedReason?: string | null;
  supersededBy?: string | null;
  checksum?: Hash;
  signature?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SkillHandle {
  id: string;
  version: SemVer;
  registryRef: string;
  lifecycleState: SkillLifecycleState;
}

export interface ArtifactEnvelope {
  hash: Hash;
  size: number;
  mimeType: string;
  createdBy: { id: string; version: SemVer };
  refCount: number;
  createdAt: Timestamp;
  metadata?: Record<string, unknown>;
}

export interface ExecutionLimits {
  maxDurationMs?: number;
  maxMemoryMb?: number;
  maxCpuPercent?: number;
}

export type PlanNodeState = 'waiting' | 'ready' | 'running' | 'done' | 'error';

export interface PlanNode {
  nodeId: UUID;
  skillRef: SkillHandle;
  inputs: ArtifactEnvelope[];
  limits: ExecutionLimits;
  state: PlanNodeState;
  selectionReason?: string;
  fallbackChain?: string[];
  confidenceThreshold?: number;
}

export interface PlanEdge {
  fromNodeId: UUID;
  toNodeId: UUID;
  kind: 'data' | 'ordering' | 'exclusion';
}

export interface ExecutionPlan {
  planId: UUID;
  nodes: PlanNode[];
  edges: PlanEdge[];
  createdAt: Timestamp;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
}

export interface Lease {
  leaseId: UUID;
  subject: string;
  capabilities: Capability[];
  issuedAt: Timestamp;
  expiresAt: Timestamp;
  revoked: boolean;
}

export interface PolicyRequest {
  requestId: UUID;
  subject: string;
  capability: Capability;
  context?: Record<string, unknown>;
}

export interface PolicyDecision {
  requestId: UUID;
  subject: string;
  capability: Capability;
  decision: 'allow' | 'deny';
  reason: string;
  policyVersion: string;
}

export interface LedgerEntry {
  entryId: UUID;
  planId: UUID;
  nodeId?: UUID;
  action: string;
  timestamp: Timestamp;
  payload?: unknown;
}

export interface ExecutionLedger {
  planId: UUID;
  entries: LedgerEntry[];
  finalStatus?: string;
}

export interface StateSnapshot {
  version: number;
  leases: Record<string, Lease>;
  ledgers: Record<string, ExecutionLedger>;
  activePlans: string[];
}

export interface Command {
  type: string;
  payload: unknown;
}

export interface TransactionResult {
  version: number;
  success: boolean;
  error?: string;
}

export interface ICancellationToken {
  isCancellationRequested: boolean;
  onCancelled(callback: () => void): void;
}

export interface TaskContext {
  taskId: UUID;
  nodeId: UUID;
  planId: UUID;
  lease: Lease;
  cancellationToken: ICancellationToken;
}

export interface ExecutionResult {
  taskId: UUID;
  outputArtifacts: ArtifactEnvelope[];
  metrics: {
    durationMs: number;
    memoryUsedMb?: number;
  };
}

export interface SubsystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastError?: string;
  uptimeMs: number;
}
