/**
 * @module promoter
 *
 * Handles atomic promotion of a validated candidate skill to production.
 *
 * Promotion protocol:
 * 1. Acquire advisory lock (prevents concurrent promotions of same skill)
 * 2. Read current production SKILL.md
 * 3. Compute next version number
 * 4. Archive current production to history
 * 5. Copy candidate to production path (atomic on POSIX via rename)
 * 6. Write promotion record
 * 7. Release lock
 *
 * If any step fails after archiving but before writing to production,
 * the archive is moved back. If the rename to production fails,
 * production is untouched and the error surfaces to the caller.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";

import type {
  SkillOptAdapterConfig,
  CandidateSkill,
  EvaluationMetrics,
  PromotionRecord,
  VersionRecord,
} from "./types.js";
import { formatPromotionSummary } from "./versioning.js";

export class PromoterError extends Error {
  constructor(message: string, public readonly skillName?: string) {
    super(`[skillopt-adapter/promoter] ${message}`);
    this.name = "PromoterError";
  }
}

// ─── Lock Files ───────────────────────────────────────────────────────────────

const LOCK_DIR = ".agy/optimization/locks";

function lockPath(skillName: string): string {
  return join(LOCK_DIR, `${skillName}.lock`);
}

function acquireLock(skillName: string): void {
  mkdirSync(LOCK_DIR, { recursive: true });
  const lp = lockPath(skillName);
  if (existsSync(lp)) {
    const content = readFileSync(lp, "utf8").trim();
    throw new PromoterError(
      `Skill "${skillName}" is already being promoted (lock: ${lp}, pid: ${content}). ` +
        `If this is stale, delete ${lp} and retry.`,
      skillName,
    );
  }
  writeFileSync(lp, String(process.pid), "utf8");
}

function releaseLock(skillName: string): void {
  const lp = lockPath(skillName);
  if (existsSync(lp)) {
    try {
      unlinkSync(lp);
    } catch {
      // Lock release failure is non-fatal; log and continue
      console.warn(
        `[skillopt-adapter/promoter] Failed to release lock ${lp}`,
      );
    }
  }
}

// ─── Version Numbering ────────────────────────────────────────────────────────

function nextVersionString(
  historyDir: string,
  skillName: string,
): string {
  const skillHistoryDir = join(historyDir, skillName);
  if (!existsSync(skillHistoryDir)) return "v001";

  const versions = readdirSync(skillHistoryDir)
    .filter((d) => /^v\d{3,}$/.test(d))
    .sort();

  if (versions.length === 0) return "v001";

  const lastVersion = versions[versions.length - 1]!;
  const n = parseInt(lastVersion.replace("v", ""), 10);
  return `v${String(n + 1).padStart(3, "0")}`;
}

// ─── Git Commit Hash ─────────────────────────────────────────────────────────

function currentGitCommit(): string | null {
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

// ─── Diff Computation ─────────────────────────────────────────────────────────

function computeDiff(productionPath: string, candidatePath: string): string {
  try {
    const result = execSync(
      `git diff --no-index -- "${productionPath}" "${candidatePath}"`,
      { stdio: ["ignore", "pipe", "ignore"] },
    ).toString();
    return result;
  } catch (err) {
    // git diff exits non-zero when files differ (that's normal)
    const output = (err as { stdout?: Buffer }).stdout;
    if (output) return output.toString();
    // Fall back to a simple label if git is not available
    return "(diff unavailable — git not found)";
  }
}

// ─── Promoter ─────────────────────────────────────────────────────────────────

export class Promoter {
  private readonly config: SkillOptAdapterConfig;

  constructor(config: SkillOptAdapterConfig) {
    this.config = config;
  }

  /**
   * Promote a validated candidate to production.
   *
   * @throws PromoterError if the candidate has not been validated,
   *   if a lock is held, or if filesystem operations fail.
   */
  promote(
    candidate: CandidateSkill,
    candidateMetrics: EvaluationMetrics,
    baselineMetrics: EvaluationMetrics,
    evaluatorModel: string,
  ): PromotionRecord {
    if (candidate.status !== "validated") {
      throw new PromoterError(
        `Cannot promote candidate ${candidate.id} with status "${candidate.status}". ` +
          `Candidate must have status "validated".`,
        candidate.skillName,
      );
    }

    acquireLock(candidate.skillName);
    try {
      return this.doPromotion(
        candidate,
        candidateMetrics,
        baselineMetrics,
        evaluatorModel,
      );
    } finally {
      releaseLock(candidate.skillName);
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private doPromotion(
    candidate: CandidateSkill,
    candidateMetrics: EvaluationMetrics,
    baselineMetrics: EvaluationMetrics,
    evaluatorModel: string,
  ): PromotionRecord {
    const { skillName, candidatePath, productionPath } = candidate;
    const { history } = this.config;

    // Resolve absolute paths
    const absProductionPath = resolve(productionPath);
    const absCandidatePath = resolve(candidatePath);

    // Validate production path exists (or parent directory if skill is new)
    const productionExists = existsSync(absProductionPath);
    if (!productionExists) {
      mkdirSync(dirname(absProductionPath), { recursive: true });
    }

    // Compute diff before archiving
    const diff = productionExists
      ? computeDiff(absProductionPath, absCandidatePath)
      : "(new skill — no previous production version)";

    // Compute next version
    const version = nextVersionString(history.storageDir, skillName);
    const gitCommit = currentGitCommit();

    // Archive current production
    let archivedPath = "";
    if (productionExists) {
      archivedPath = this.archiveProduction(
        skillName,
        version,
        absProductionPath,
        candidateMetrics,
        diff,
        candidate,
        gitCommit,
        evaluatorModel,
      );
    }

    // Atomic promotion: rename candidate to production
    try {
      this.atomicWrite(absCandidatePath, absProductionPath);
    } catch (err) {
      // Restore from archive if we already archived
      if (archivedPath && existsSync(archivedPath)) {
        try {
          copyFileSync(archivedPath, absProductionPath);
        } catch (restoreErr) {
          throw new PromoterError(
            `CRITICAL: Promotion failed AND restore from archive failed. ` +
              `Production path: ${absProductionPath}. ` +
              `Archive path: ${archivedPath}. ` +
              `Restore error: ${String(restoreErr)}. ` +
              `Original error: ${String(err)}`,
            skillName,
          );
        }
      }
      throw new PromoterError(
        `Atomic write to production failed: ${String(err)}`,
        skillName,
      );
    }

    // Build and write promotion record
    const promotionSummary = formatPromotionSummary(
      candidateMetrics,
      baselineMetrics,
    );

    const record: PromotionRecord = {
      schemaVersion: "1",
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      skillName,
      version,
      candidateId: candidate.id,
      gitCommit,
      candidateMetrics,
      baselineMetrics,
      diff,
      skilloptVersion: candidate.skilloptVersion,
      optimizerModel: candidate.optimizerModel,
      evaluatorModel,
      promotionSummary,
      archivedPath,
    };

    const recordPath = join(
      history.storageDir,
      skillName,
      version,
      "promotion-record.json",
    );
    mkdirSync(dirname(recordPath), { recursive: true });
    writeFileSync(recordPath, JSON.stringify(record, null, 2), "utf8");

    // Update candidate status
    candidate.status = "promoted";

    // Enforce history retention
    this.pruneHistory(skillName);

    return record;
  }

  private archiveProduction(
    skillName: string,
    version: string,
    productionPath: string,
    candidateMetrics: EvaluationMetrics,
    diff: string,
    candidate: CandidateSkill,
    gitCommit: string | null,
    evaluatorModel: string,
  ): string {
    const versionDir = join(
      this.config.history.storageDir,
      skillName,
      version,
    );
    mkdirSync(versionDir, { recursive: true });

    const archivePath = join(versionDir, "skill_archive");
    require("node:fs").cpSync(productionPath, archivePath, { recursive: true });

    // Determine rollback target (previous version)
    const allVersions = this.listVersions(skillName);
    const rollbackTarget =
      allVersions.length > 0
        ? allVersions[allVersions.length - 1]!.version
        : null;

    const versionRecord: VersionRecord = {
      schemaVersion: "1",
      version,
      skillName,
      skillPath: archivePath,
      timestamp: new Date().toISOString(),
      gitCommit,
      promotedFromCandidateId: candidate.id,
      evaluationMetrics: candidateMetrics,
      diff,
      optimizerVersion: candidate.skilloptVersion,
      optimizerModel: candidate.optimizerModel,
      evaluatorModel,
      rollbackTarget,
    };

    writeFileSync(
      join(versionDir, "version-record.json"),
      JSON.stringify(versionRecord, null, 2),
      "utf8",
    );

    return archivePath;
  }

  private atomicWrite(src: string, dst: string): void {
    // On POSIX, rename() is atomic. Copy to a temp file/dir first,
    // then rename to destination.
    const tmp = `${dst}.tmp.${Date.now()}`;
    const fs = require("node:fs");
    if (fs.statSync(src).isDirectory()) {
      fs.cpSync(src, tmp, { recursive: true });
    } else {
      fs.copyFileSync(src, tmp);
    }
    
    // Windows doesn't allow renaming over an existing directory with renameSync.
    // If it's a directory, we remove the destination first. (This breaks strict POSIX atomicity on Windows, but is needed).
    if (fs.existsSync(dst)) {
      if (fs.statSync(dst).isDirectory()) {
        fs.rmSync(dst, { recursive: true, force: true });
      }
    }
    fs.renameSync(tmp, dst);
  }

  private listVersions(skillName: string): VersionRecord[] {
    const dir = join(this.config.history.storageDir, skillName);
    if (!existsSync(dir)) return [];

    const records: VersionRecord[] = [];
    for (const entry of readdirSync(dir)) {
      const recordPath = join(dir, entry, "version-record.json");
      if (existsSync(recordPath)) {
        try {
          records.push(
            JSON.parse(
              readFileSync(recordPath, "utf8"),
            ) as VersionRecord,
          );
        } catch {
          // Corrupt record — skip
        }
      }
    }
    return records.sort((a, b) => a.version.localeCompare(b.version));
  }

  private pruneHistory(skillName: string): void {
    const { maxVersionsPerSkill } = this.config.history;
    const versions = this.listVersions(skillName);
    if (versions.length <= maxVersionsPerSkill) return;

    const toRemove = versions.slice(0, versions.length - maxVersionsPerSkill);
    for (const record of toRemove) {
      const versionDir = join(
        this.config.history.storageDir,
        skillName,
        record.version,
      );
      // Remove version files (non-recursive for safety)
      for (const f of readdirSync(versionDir)) {
        unlinkSync(join(versionDir, f));
      }
      try {
        // Remove directory itself (only if empty)
        readdirSync(versionDir).length === 0 &&
          require("node:fs").rmdirSync(versionDir);
      } catch {
        // Non-fatal
      }
    }
  }
}
