/**
 * @module security
 *
 * Input sanitization, injection protection, and path validation for
 * all data that touches the SkillOpt subprocess or the production
 * skills directory.
 *
 * Nothing from user-provided content reaches the optimizer without
 * passing through this module first.
 */

import { resolve, normalize, relative } from "node:path";
import { existsSync } from "node:fs";

// ─── Public Types ─────────────────────────────────────────────────────────────

export class SecurityError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(`[skillopt-adapter/security] ${message}`);
    this.name = "SecurityError";
  }
}

// ─── HTML Entity Escaping ─────────────────────────────────────────────────────

const HTML_ENTITY_MAP: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function htmlEscape(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => HTML_ENTITY_MAP[ch] ?? ch);
}

// ─── Injection Pattern Detection ─────────────────────────────────────────────

/**
 * Scan a string for known prompt-injection / template-injection patterns.
 * Returns the first matching pattern, or null if clean.
 */
export function detectInjection(
  input: string,
  patterns: readonly string[],
): string | null {
  for (const patternStr of patterns) {
    const re = new RegExp(patternStr, "i");
    if (re.test(input)) {
      return patternStr;
    }
  }
  return null;
}

// ─── User Request Sanitization ────────────────────────────────────────────────

/**
 * Sanitize a user request string before storing in a trajectory.
 *
 * - Truncates to maxChars
 * - HTML-escapes dangerous characters
 * - Checks for injection patterns
 *
 * @throws SecurityError if injection patterns are detected
 */
export function sanitizeUserRequest(
  raw: string,
  maxChars: number,
  injectionPatterns: readonly string[],
): string {
  if (typeof raw !== "string") {
    throw new SecurityError("userRequest must be a string", "userRequest");
  }

  // Truncate before escape to avoid wasted work on giant strings
  const truncated =
    raw.length > maxChars ? raw.slice(0, maxChars) + "…" : raw;

  const escaped = htmlEscape(truncated);

  const matchedPattern = detectInjection(escaped, injectionPatterns);
  if (matchedPattern != null) {
    throw new SecurityError(
      `userRequest contains injection pattern: ${matchedPattern}`,
      "userRequest",
    );
  }

  return escaped;
}

// ─── Candidate Content Validation ─────────────────────────────────────────────

/**
 * Validate the content of a candidate SKILL.md before evaluation.
 *
 * Rejects candidates that contain:
 * - Template injection markers ({{, }})
 * - Script tags
 * - Python eval/exec calls
 * - Other known dangerous patterns
 *
 * @throws SecurityError if candidate content is unsafe
 */
export function validateCandidateContent(
  content: string,
  injectionPatterns: readonly string[],
): void {
  if (typeof content !== "string") {
    throw new SecurityError("Candidate content must be a string");
  }
  if (content.trim().length === 0) {
    throw new SecurityError("Candidate content is empty");
  }
  if (content.length > 200_000) {
    throw new SecurityError(
      `Candidate content exceeds 200,000 characters (got ${content.length})`,
    );
  }

  const matched = detectInjection(content, injectionPatterns);
  if (matched != null) {
    throw new SecurityError(
      `Candidate SKILL.md contains injection pattern: ${matched}`,
    );
  }
}

// ─── Path Validation ─────────────────────────────────────────────────────────

/**
 * Validate that `skillPath` is inside `allowedRoot` and exists.
 * Prevents path-traversal attacks on production skill files.
 *
 * @throws SecurityError if the path is outside the allowed root
 */
export function validateSkillPath(
  skillPath: string,
  allowedRoot: string,
): string {
  const abs = resolve(skillPath);
  const absRoot = resolve(allowedRoot);

  // normalize resolves .. segments; relative() will tell us if it escapes
  const rel = relative(absRoot, abs);
  if (rel.startsWith("..") || normalize(rel).startsWith("..")) {
    throw new SecurityError(
      `Skill path escapes allowed root. ` +
        `Path: ${abs}, Root: ${absRoot}`,
      "skillPath",
    );
  }

  if (!existsSync(abs)) {
    throw new SecurityError(`Skill file does not exist: ${abs}`, "skillPath");
  }

  return abs;
}

/**
 * Validate that `candidatePath` is inside the candidates directory.
 *
 * @throws SecurityError if the path escapes the candidates directory
 */
export function validateCandidatePath(
  candidatePath: string,
  candidatesDir: string,
): string {
  const abs = resolve(candidatePath);
  const absDir = resolve(candidatesDir);

  const rel = relative(absDir, abs);
  if (rel.startsWith("..") || normalize(rel).startsWith("..")) {
    throw new SecurityError(
      `Candidate path escapes candidates directory. ` +
        `Path: ${abs}, Dir: ${absDir}`,
      "candidatePath",
    );
  }

  return abs;
}

// ─── JSON-Safe Object Sanitization ───────────────────────────────────────────

/**
 * Recursively remove non-JSON-safe values from an object.
 * undefined → omitted, functions → omitted, Infinity/NaN → null.
 */
export function sanitizeJsonObject(
  obj: unknown,
  depth = 0,
): Record<string, unknown> | null {
  if (depth > 20) return null; // prevent stack overflow on deep objects

  if (obj === null || obj === undefined) return null;
  if (typeof obj !== "object") return null;
  if (Array.isArray(obj)) return null; // not an object

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(
    obj as Record<string, unknown>,
  )) {
    result[key] = sanitizeValue(value, depth + 1);
  }
  return result;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "function") return null;
  if (typeof value === "number") {
    if (!isFinite(value)) return null;
    return value;
  }
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    return sanitizeJsonObject(value, depth + 1) ?? null;
  }
  return null;
}

// ─── Trajectory Record Validation ────────────────────────────────────────────

/**
 * Validate a raw parsed trajectory record before storing.
 * Confirms required fields are present and correctly typed.
 *
 * Returns a list of validation error messages (empty = valid).
 */
export function validateTrajectoryRecord(
  record: Record<string, unknown>,
): string[] {
  const errors: string[] = [];

  function requireString(field: string): void {
    if (typeof record[field] !== "string" || !record[field]) {
      errors.push(`${field} must be a non-empty string`);
    }
  }

  function requireNumber(field: string): void {
    if (typeof record[field] !== "number" || !isFinite(record[field] as number)) {
      errors.push(`${field} must be a finite number`);
    }
  }

  requireString("schemaVersion");
  requireString("id");
  requireString("timestamp");
  requireString("skillName");
  requireString("skillContentHash");
  requireString("userRequest");

  if (!Array.isArray(record["activatedSkills"])) {
    errors.push("activatedSkills must be an array");
  }
  if (!Array.isArray(record["toolCalls"])) {
    errors.push("toolCalls must be an array");
  }

  requireString("outcome");
  const validOutcomes = ["success", "failure", "partial", "rejected"];
  if (!validOutcomes.includes(record["outcome"] as string)) {
    errors.push(`outcome must be one of: ${validOutcomes.join(", ")}`);
  }

  requireNumber("retryCount");
  requireNumber("durationMs");

  if ((record["schemaVersion"] as string) !== "1") {
    errors.push("schemaVersion must be '1'");
  }

  return errors;
}
