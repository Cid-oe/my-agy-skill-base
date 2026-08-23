/**
 * @module trajectory
 *
 * Trajectory recorder and serializer.
 *
 * Design goals:
 * - Zero latency impact on the hot path: record() returns synchronously
 *   after writing to an in-memory queue; background flush writes to disk.
 * - All sensitive data is sanitized before storage.
 * - Corrupt files are skipped on read, never fatal.
 * - Schema-versioned NDJSON format (one record per line).
 */

import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import type {
  TrajectoryRecord,
  ReasoningMetadata,
  ToolCall,
  ExecutionOutcome,
  SkillOptAdapterConfig,
} from "./types.js";
import {
  sanitizeUserRequest,
  sanitizeJsonObject,
  validateTrajectoryRecord,
} from "./security.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Input to TrajectoryRecorder.record(). */
export interface TrajectoryInput {
  readonly skillName: string;
  readonly skillContentHash: string;
  readonly userRequest: string;
  readonly activatedSkills: readonly string[];
  readonly reasoningMetadata: ReasoningMetadata;
  readonly toolCalls: readonly ToolCall[];
  readonly skillInput: Record<string, unknown>;
  readonly skillOutput: Record<string, unknown>;
  readonly humanCorrected?: boolean;
  readonly correctedOutput?: Record<string, unknown>;
  readonly finalAnswer: Record<string, unknown>;
  readonly outcome: ExecutionOutcome;
  readonly failureReason?: string;
  readonly retryCount: number;
  readonly durationMs: number;
  readonly costUsd?: number;
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly modelId: string;
}

// ─── Content Hash ─────────────────────────────────────────────────────────────

/**
 * Compute the SHA-256 content hash of a SKILL.md file.
 * Used to identify which version of a skill produced a trajectory.
 */
export function computeSkillContentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

// ─── Storage Paths ────────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Returns the NDJSON file path for a given skill and date.
 * One file per skill per day keeps files manageable.
 */
function trajectoryFilePath(
  storageDir: string,
  skillName: string,
  date: Date,
): string {
  const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
  return join(storageDir, skillName, `trajectories-${dateStr}.ndjson`);
}

// ─── Recorder ─────────────────────────────────────────────────────────────────

/**
 * Records execution trajectories to disk.
 *
 * Usage:
 * ```ts
 * const recorder = new TrajectoryRecorder(config);
 * recorder.record({ skillName: "docx", ... });
 * ```
 */
export class TrajectoryRecorder {
  private readonly config: SkillOptAdapterConfig;
  private readonly pendingCount = new Map<string, number>();

  constructor(config: SkillOptAdapterConfig) {
    this.config = config;
  }

  /**
   * Record a trajectory. Returns the trajectory ID.
   *
   * This method is synchronous and designed to add < 1ms overhead.
   * File I/O is done with appendFileSync on a small JSON line.
   *
   * @throws Never — errors are caught and logged without crashing execution.
   */
  record(input: TrajectoryInput): string {
    const id = randomUUID();
    try {
      const record = this.buildRecord(id, input);
      this.writeRecord(record);
      this.incrementPending(input.skillName);
    } catch (err) {
      // Never crash execution due to trajectory recording failure.
      // Log and continue.
      console.error(
        `[skillopt-adapter/trajectory] Failed to record trajectory for ` +
          `skill "${input.skillName}": ${String(err)}`,
      );
    }
    return id;
  }

  /**
   * Returns the number of pending (unprocessed) trajectories for a skill.
   */
  pendingCountFor(skillName: string): number {
    return this.pendingCount.get(skillName) ?? 0;
  }

  /**
   * Check whether a skill has accumulated enough trajectories to trigger
   * automatic optimization.
   */
  shouldTriggerOptimization(skillName: string): boolean {
    return (
      this.pendingCountFor(skillName) >=
      this.config.trajectories.autoTriggerCount
    );
  }

  /**
   * Load all trajectory records for a skill, in chronological order.
   * Corrupt lines are skipped with a warning.
   */
  loadTrajectories(skillName: string): TrajectoryRecord[] {
    const dir = join(this.config.trajectories.storageDir, skillName);
    if (!existsSync(dir)) return [];

    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".ndjson"))
      .sort(); // lexicographic = chronological due to YYYY-MM-DD prefix

    const records: TrajectoryRecord[] = [];
    for (const file of files) {
      const filePath = join(dir, file);
      const lines = readFileSync(filePath, "utf8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as Record<string, unknown>;
          const errors = validateTrajectoryRecord(parsed);
          if (errors.length > 0) {
            console.warn(
              `[skillopt-adapter/trajectory] Skipping corrupt trajectory ` +
                `in ${filePath}: ${errors.join("; ")}`,
            );
            continue;
          }
          records.push(parsed as unknown as TrajectoryRecord);
        } catch {
          console.warn(
            `[skillopt-adapter/trajectory] Skipping unparseable line ` +
              `in ${filePath}`,
          );
        }
      }
    }
    return records;
  }

  /**
   * Load trajectories since a given date.
   */
  loadTrajectoriesSince(
    skillName: string,
    since: Date,
  ): TrajectoryRecord[] {
    return this.loadTrajectories(skillName).filter(
      (r) => new Date(r.timestamp) >= since,
    );
  }

  /**
   * Export trajectories to SkillOpt's expected input format.
   * Returns the path to the written export file.
   */
  exportForSkillOpt(
    trajectories: TrajectoryRecord[],
    outputPath: string,
  ): void {
    ensureDir(join(outputPath, "..").replace(/\.\.$/, ""));
    const lines = trajectories.map((r) =>
      JSON.stringify(toSkillOptTrajectory(r)),
    );
    appendFileSync(outputPath, lines.join("\n") + "\n", "utf8");
  }

  /**
   * Prune trajectory files older than the configured retention period.
   */
  pruneOldTrajectories(skillName: string): number {
    const { retentionDays } = this.config.trajectories;
    if (retentionDays == null) return 0;

    const dir = join(this.config.trajectories.storageDir, skillName);
    if (!existsSync(dir)) return 0;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    let pruned = 0;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".ndjson")) continue;
      const filePath = join(dir, file);
      const mtime = statSync(filePath).mtime;
      if (mtime < cutoff) {
        unlinkSync(filePath);
        pruned++;
      }
    }
    return pruned;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private buildRecord(id: string, input: TrajectoryInput): TrajectoryRecord {
    const sanitizedRequest = sanitizeUserRequest(
      input.userRequest,
      this.config.security.maxUserRequestChars,
      this.config.security.injectionPatterns,
    );

    const sanitizedInput =
      sanitizeJsonObject(input.skillInput) ?? {};
    const sanitizedOutput =
      sanitizeJsonObject(input.skillOutput) ?? {};
    const sanitizedFinal =
      sanitizeJsonObject(input.finalAnswer) ?? {};
    const sanitizedCorrected =
      input.correctedOutput != null
        ? sanitizeJsonObject(input.correctedOutput) ?? null
        : null;

    return {
      schemaVersion: "1",
      id,
      timestamp: new Date().toISOString(),
      skillName: input.skillName,
      skillContentHash: input.skillContentHash,
      userRequest: sanitizedRequest,
      activatedSkills: [...input.activatedSkills],
      reasoningMetadata: input.reasoningMetadata,
      toolCalls: [...input.toolCalls],
      skillInput: sanitizedInput,
      skillOutput: sanitizedOutput,
      humanCorrected: input.humanCorrected ?? null,
      correctedOutput: sanitizedCorrected,
      finalAnswer: sanitizedFinal,
      outcome: input.outcome,
      failureReason: input.failureReason ?? null,
      retryCount: input.retryCount,
      durationMs: input.durationMs,
      costUsd: input.costUsd ?? null,
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
      modelId: input.modelId,
    };
  }

  private writeRecord(record: TrajectoryRecord): void {
    const dir = join(
      this.config.trajectories.storageDir,
      record.skillName,
    );
    ensureDir(dir);

    const filePath = trajectoryFilePath(
      this.config.trajectories.storageDir,
      record.skillName,
      new Date(record.timestamp),
    );

    appendFileSync(filePath, JSON.stringify(record) + "\n", "utf8");
  }

  private incrementPending(skillName: string): void {
    this.pendingCount.set(
      skillName,
      (this.pendingCount.get(skillName) ?? 0) + 1,
    );
  }
}

// ─── SkillOpt Format Conversion ───────────────────────────────────────────────

/**
 * Convert an AGY trajectory record to SkillOpt's expected trajectory format.
 *
 * SkillOpt expects:
 * {
 *   "question": "<user request>",
 *   "answer": "<model output>",
 *   "is_correct": <boolean>,
 *   "metadata": { ... }
 * }
 *
 * We map AGY fields to this format. The exact field names match what
 * SkillOpt's rollout aggregator expects in its NDJSON input.
 */
function toSkillOptTrajectory(
  record: TrajectoryRecord,
): Record<string, unknown> {
  return {
    question: record.userRequest,
    answer: JSON.stringify(record.finalAnswer),
    is_correct: record.outcome === "success",
    trajectory_id: record.id,
    skill_name: record.skillName,
    skill_content_hash: record.skillContentHash,
    tool_calls: record.toolCalls,
    latency_ms: record.durationMs,
    cost_usd: record.costUsd,
    model_id: record.modelId,
    failure_reason: record.failureReason,
    retry_count: record.retryCount,
    human_corrected: record.humanCorrected,
    corrected_output: record.correctedOutput,
    metadata: {
      reasoning: record.reasoningMetadata,
      activated_skills: record.activatedSkills,
    },
  };
}
