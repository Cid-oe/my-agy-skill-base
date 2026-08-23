export interface PromotionThresholds {
  successRateMinDelta: number;
  accuracyMinDelta: number;
  hallucinationRateMaxDelta: number;
  latencyP95MaxDeltaMs: number;
  costMaxDeltaFraction: number;
}

export interface SkillOptAdapterConfig {
  skillopt: {
    python: string;
    version: string;
  };
  optimizer: {
    model: string;
    backend: string;
    epochs: number;
    batchSize: number;
    parallelism: number;
    retryAttempts: number;
    retryDelayMs: number;
    timeoutMs: number;
  };
  evaluator: {
    model: string;
    rollouts: number;
    goldenDataset: string;
  };
  thresholds: PromotionThresholds;
  trajectories: {
    storageDir: string;
    retentionDays: number | null;
    autoTriggerCount: number;
  };
  candidates: {
    storageDir: string;
    keepRejected: boolean;
    rejectedRetentionDays: number;
  };
  history: {
    storageDir: string;
    maxVersionsPerSkill: number;
  };
  sleep: {
    schedule: string;
    minTrajectories: number;
    timeoutMs: number;
  };
  security: {
    maxUserRequestChars: number;
    injectionPatterns: readonly string[];
  };
}

export interface EvaluationMetrics {
  successRate: number;
  accuracy: number;
  hallucinationRate: number;
  toolCorrectness: number;
  latencyP95Ms: number;
  avgCostUsd: number;
  instructionAdherence: number;
  sampleSize: number;
}

export interface MetricCheck {
  metric: string;
  candidateValue: number;
  baselineValue: number;
  delta: number;
  threshold: number;
  pass: boolean;
  description: string;
}

export interface ComparisonResult {
  skillName: string;
  candidateId: string;
  pass: boolean;
  checks: MetricCheck[];
  summary: string;
}

export interface CandidateSkill {
  id: string;
  skillName: string;
  candidatePath: string;
  productionPath: string;
  status: "evaluating" | "validated" | "promoted" | "rejected";
  diff: string;
  skilloptVersion: string;
  optimizerModel: string;
  evaluationMetrics?: EvaluationMetrics;
}

export interface ReasoningMetadata {
  hallucinationDetected?: boolean;
  instructionAdherence?: "full" | "partial" | "none";
  [key: string]: unknown;
}

export interface ToolCall {
  success: boolean;
  [key: string]: unknown;
}

export type ExecutionOutcome = "success" | "failure" | "partial" | "rejected";

export interface TrajectoryRecord {
  schemaVersion: "1";
  id: string;
  timestamp: string;
  skillName: string;
  skillContentHash: string;
  userRequest: string;
  activatedSkills: string[];
  reasoningMetadata: ReasoningMetadata;
  toolCalls: ToolCall[];
  skillInput: Record<string, unknown>;
  skillOutput: Record<string, unknown>;
  humanCorrected: boolean | null;
  correctedOutput: Record<string, unknown> | null;
  finalAnswer: Record<string, unknown>;
  outcome: ExecutionOutcome;
  failureReason: string | null;
  retryCount: number;
  durationMs: number;
  costUsd: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  modelId: string;
}

export interface OptimizationJob {
  id: string;
  skillName: string;
  skillPath: string;
  trajectoryPaths: string[];
  configPath: string;
  outputDir: string;
  enqueuedAt: string;
  status: "queued" | "running" | "completed" | "failed";
  startedAt: string | null;
  completedAt: string | null;
  candidateId: string | null;
  failureReason: string | null;
}

export interface SkillOptProgressEvent {
  event: string;
  epoch?: number;
  message?: string;
  error?: string;
}

export type AdapterEvent =
  | { type: "optimization:progress"; timestamp: string; skillName: string; jobId: string; epoch: number; totalEpochs: number; message: string; }
  | { type: "optimization:started"; timestamp: string; skillName: string; jobId: string; trajectoryCount: number; }
  | { type: "optimization:completed"; timestamp: string; skillName: string; jobId: string; candidateId: string; }
  | { type: "optimization:failed"; timestamp: string; skillName: string; jobId: string; reason: string; };

export type AdapterEventListener = (event: AdapterEvent) => void;

export interface PromotionRecord {
  schemaVersion: "1";
  id: string;
  timestamp: string;
  skillName: string;
  version: string;
  candidateId: string;
  gitCommit: string | null;
  candidateMetrics: EvaluationMetrics;
  baselineMetrics: EvaluationMetrics;
  diff: string;
  skilloptVersion: string;
  optimizerModel: string;
  evaluatorModel: string;
  promotionSummary: string;
  archivedPath: string;
}

export interface VersionRecord {
  schemaVersion: "1";
  version: string;
  skillName: string;
  skillPath: string;
  timestamp: string;
  gitCommit: string | null;
  promotedFromCandidateId: string;
  evaluationMetrics: EvaluationMetrics;
  diff: string;
  optimizerVersion: string;
  optimizerModel: string;
  evaluatorModel: string;
  rollbackTarget: string | null;
}
