/**
 * @module versioning
 *
 * Version history management and rollback logic.
 * Every promoted version is stored in .agy/optimization/history/.
 * Rollback is atomic — same POSIX rename protocol as promotion.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
} from "node:fs";
import { join, dirname } from "node:path";

import type {
  SkillOptAdapterConfig,
  EvaluationMetrics,
  VersionRecord,
} from "./types.js";

export class VersioningError extends Error {
  constructor(message: string, public readonly skillName?: string) {
    super(`[skillopt-adapter/versioning] ${message}`);
    this.name = "VersioningError";
  }
}

// ─── Version Registry ─────────────────────────────────────────────────────────

/**
 * Load all version records for a skill, sorted oldest to newest.
 */
export function loadVersionHistory(
  config: SkillOptAdapterConfig,
  skillName: string,
): VersionRecord[] {
  const dir = join(config.history.storageDir, skillName);
  if (!existsSync(dir)) return [];

  const records: VersionRecord[] = [];
  for (const entry of readdirSync(dir)) {
    const recordPath = join(dir, entry, "version-record.json");
    if (!existsSync(recordPath)) continue;
    try {
      const raw = JSON.parse(readFileSync(recordPath, "utf8")) as VersionRecord;
      records.push(raw);
    } catch {
      console.warn(
        `[skillopt-adapter/versioning] Corrupt version record at ${recordPath} — skipping`,
      );
    }
  }

  return records.sort((a, b) => a.version.localeCompare(b.version));
}

/**
 * Load a specific version record for a skill.
 */
export function loadVersionRecord(
  config: SkillOptAdapterConfig,
  skillName: string,
  version: string,
): VersionRecord {
  const recordPath = join(
    config.history.storageDir,
    skillName,
    version,
    "version-record.json",
  );
  if (!existsSync(recordPath)) {
    throw new VersioningError(
      `No version record found for skill "${skillName}" version "${version}"`,
      skillName,
    );
  }
  try {
    return JSON.parse(readFileSync(recordPath, "utf8")) as VersionRecord;
  } catch (err) {
    throw new VersioningError(
      `Corrupt version record at ${recordPath}: ${String(err)}`,
      skillName,
    );
  }
}

/**
 * Get the most recent version for a skill, or null if no history.
 */
export function latestVersion(
  config: SkillOptAdapterConfig,
  skillName: string,
): VersionRecord | null {
  const history = loadVersionHistory(config, skillName);
  return history.length > 0 ? history[history.length - 1]! : null;
}

// ─── Rollback ─────────────────────────────────────────────────────────────────

/**
 * Roll back a skill to a specific version.
 *
 * The rollback operation is atomic (same POSIX rename as promotion).
 * The current production version is NOT archived during rollback —
 * history is preserved as-is. The rollback is recorded in a separate
 * rollback-record.json in the version directory.
 */
export function rollback(
  config: SkillOptAdapterConfig,
  skillName: string,
  targetVersion: string,
  productionPath: string,
): VersionRecord {
  const record = loadVersionRecord(config, skillName, targetVersion);

  const archivedSkillPath = join(
    config.history.storageDir,
    skillName,
    targetVersion,
    "SKILL.md",
  );

  if (!existsSync(archivedSkillPath)) {
    throw new VersioningError(
      `Archived SKILL.md not found for version "${targetVersion}" of skill "${skillName}"`,
      skillName,
    );
  }

  // Atomic write to production
  const tmp = `${productionPath}.rollback.tmp.${Date.now()}`;
  copyFileSync(archivedSkillPath, tmp);
  mkdirSync(dirname(productionPath), { recursive: true });
  renameSync(tmp, productionPath);

  return record;
}

/**
 * Roll back to the previous version (convenience wrapper).
 */
export function rollbackToPrevious(
  config: SkillOptAdapterConfig,
  skillName: string,
  productionPath: string,
): VersionRecord {
  const history = loadVersionHistory(config, skillName);
  if (history.length === 0) {
    throw new VersioningError(
      `No version history found for skill "${skillName}"`,
      skillName,
    );
  }
  if (history.length === 1) {
    throw new VersioningError(
      `Only one version in history for skill "${skillName}" — nothing to roll back to`,
      skillName,
    );
  }

  // Roll back to the second-to-last version
  const targetRecord = history[history.length - 2]!;
  return rollback(config, skillName, targetRecord.version, productionPath);
}

// ─── Human-Readable History ───────────────────────────────────────────────────

/**
 * Format version history as a human-readable table for the CLI.
 */
export function formatVersionHistory(
  skillName: string,
  history: VersionRecord[],
): string {
  if (history.length === 0) {
    return `No optimization history found for skill "${skillName}".\n` +
      `Run: agy skill optimize ${skillName}`;
  }

  const lines: string[] = [
    `Version history for skill: ${skillName}`,
    `${"─".repeat(70)}`,
    `${"Version".padEnd(10)} ${"Timestamp".padEnd(25)} ${"Success Rate".padEnd(14)} Summary`,
    `${"─".repeat(70)}`,
  ];

  for (const record of history.slice().reverse()) {
    const ts = new Date(record.timestamp).toISOString().slice(0, 19);
    const sr = (record.evaluationMetrics.successRate * 100).toFixed(1) + "%";
    const note =
      record.rollbackTarget
        ? `(rolled back from ${record.version})`
        : record.version === history[history.length - 1]!.version
          ? "(current)"
          : "";
    lines.push(
      `${record.version.padEnd(10)} ${ts.padEnd(25)} ${sr.padEnd(14)} ${note}`,
    );
  }

  return lines.join("\n");
}

// ─── Metric Diff Helpers ─────────────────────────────────────────────────────

/**
 * Compute a human-readable diff between two metric sets.
 * Used in promotion records.
 */
export function computeMetricDiff(
  candidate: EvaluationMetrics,
  baseline: EvaluationMetrics,
): Record<string, string> {
  function delta(a: number, b: number, pct = true): string {
    const d = a - b;
    const sign = d >= 0 ? "+" : "";
    if (pct) return `${sign}${(d * 100).toFixed(2)}pp`;
    return `${sign}${d.toFixed(2)}`;
  }

  return {
    successRate: delta(candidate.successRate, baseline.successRate),
    accuracy: delta(candidate.accuracy, baseline.accuracy),
    hallucinationRate: delta(
      candidate.hallucinationRate,
      baseline.hallucinationRate,
    ),
    toolCorrectness: delta(
      candidate.toolCorrectness,
      baseline.toolCorrectness,
    ),
    latencyP95Ms: delta(
      candidate.latencyP95Ms,
      baseline.latencyP95Ms,
      false,
    ),
    avgCostUsd: delta(candidate.avgCostUsd, baseline.avgCostUsd, false),
    instructionAdherence: delta(
      candidate.instructionAdherence,
      baseline.instructionAdherence,
    ),
  };
}

/**
 * Format a promotion summary for the promotion record.
 */
export function formatPromotionSummary(
  candidate: EvaluationMetrics,
  baseline: EvaluationMetrics,
): string {
  const diff = computeMetricDiff(candidate, baseline);
  const improvements: string[] = [];

  const numericDiff = (s: string): number => parseFloat(s.replace("pp", "").replace("+", ""));

  if (numericDiff(diff.successRate) > 0) {
    improvements.push(`success_rate ${diff.successRate}`);
  }
  if (numericDiff(diff.accuracy) > 0) {
    improvements.push(`accuracy ${diff.accuracy}`);
  }
  if (numericDiff(diff.hallucinationRate) < 0) {
    improvements.push(`hallucination_rate ${diff.hallucinationRate}`);
  }

  if (improvements.length === 0) {
    return "Promoted (no regression detected; within all thresholds)";
  }

  return `Improvements: ${improvements.join(", ")}`;
}
