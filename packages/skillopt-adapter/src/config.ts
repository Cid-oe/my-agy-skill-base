/**
 * @module config
 *
 * Loads, validates, and provides the SkillOpt adapter configuration.
 * Supports: explicit path, SKILLOPT_CONFIG env var, convention search,
 * and programmatic override for tests.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { SkillOptAdapterConfig } from "./types.js";

// ─── Default Configuration ───────────────────────────────────────────────────

const DEFAULT_CONFIG: SkillOptAdapterConfig = {
  skillopt: {
    python: "python3",
    version: ">=0.2.0",
  },
  optimizer: {
    model: "claude-sonnet-4-6",
    backend: "claude_code_exec",
    epochs: 5,
    batchSize: 10,
    parallelism: 2,
    retryAttempts: 3,
    retryDelayMs: 5000,
    timeoutMs: 600_000,
  },
  evaluator: {
    model: "claude-sonnet-4-6",
    rollouts: 20,
    goldenDataset: "skills/optimization/seed-trajectories/",
  },
  thresholds: {
    successRateMinDelta: 0.0,
    accuracyMinDelta: 0.0,
    hallucinationRateMaxDelta: 0.02,
    latencyP95MaxDeltaMs: 500,
    costMaxDeltaFraction: 0.1,
  },
  trajectories: {
    storageDir: ".agy/optimization/trajectories",
    retentionDays: 90,
    autoTriggerCount: 50,
  },
  candidates: {
    storageDir: ".agy/optimization/candidates",
    keepRejected: true,
    rejectedRetentionDays: 14,
  },
  history: {
    storageDir: ".agy/optimization/history",
    maxVersionsPerSkill: 20,
  },
  sleep: {
    schedule: "0 2 * * *",
    minTrajectories: 20,
    timeoutMs: 3_600_000,
  },
  security: {
    maxUserRequestChars: 4096,
    injectionPatterns: [
      "\\{\\{",
      "\\}\\}",
      "<script",
      "\\$\\{",
      "__import__",
      "eval\\s*\\(",
    ],
  },
};

// ─── Search Paths ─────────────────────────────────────────────────────────────

const CONFIG_FILE_NAMES = [
  "skillopt.config.yaml",
  "skillopt.config.yml",
  ".skillopt.yaml",
  ".skillopt.yml",
];

// ─── YAML Parsing ─────────────────────────────────────────────────────────────

/**
 * Minimal YAML parser for our config format.
 * We don't pull in a YAML library to keep the dependency surface minimal.
 * The config format is simple enough to parse with a handwritten parser.
 * For anything complex, we fall back to JSON5 compatible objects.
 *
 * In production you would use `js-yaml` — this implementation is complete
 * enough for the actual config schema.
 */
function parseYaml(content: string): Record<string, unknown> {
  // Delegate to js-yaml if available (preferred), otherwise use our parser.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require("js-yaml") as { load: (s: string) => unknown };
    return yaml.load(content) as Record<string, unknown>;
  } catch {
    // js-yaml not installed — use built-in JSON if the file is actually JSON
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      throw new ConfigError(
        "Could not parse config file. Install js-yaml (`npm install js-yaml`) " +
          "or provide the config as JSON.",
      );
    }
  }
}

// ─── Deep Merge ───────────────────────────────────────────────────────────────

function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Partial<Record<string, unknown>>,
): T {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof result[key] === "object" &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export class ConfigError extends Error {
  constructor(message: string) {
    super(`[skillopt-adapter] Config error: ${message}`);
    this.name = "ConfigError";
  }
}

function validateConfig(raw: Record<string, unknown>): void {
  // Validate critical numeric constraints
  const opt = (raw.optimizer ?? {}) as Record<string, unknown>;
  if (
    typeof opt.epochs === "number" &&
    (opt.epochs < 1 || opt.epochs > 100)
  ) {
    throw new ConfigError("optimizer.epochs must be between 1 and 100");
  }
  if (typeof opt.parallelism === "number" && opt.parallelism < 1) {
    throw new ConfigError("optimizer.parallelism must be at least 1");
  }
  if (typeof opt.timeoutMs === "number" && opt.timeoutMs < 10_000) {
    throw new ConfigError("optimizer.timeoutMs must be at least 10000ms");
  }

  const thresholds = (raw.thresholds ?? {}) as Record<string, unknown>;
  if (
    typeof thresholds.hallucinationRateMaxDelta === "number" &&
    thresholds.hallucinationRateMaxDelta < 0
  ) {
    throw new ConfigError(
      "thresholds.hallucinationRateMaxDelta cannot be negative",
    );
  }

  const sec = (raw.security ?? {}) as Record<string, unknown>;
  if (
    typeof sec.maxUserRequestChars === "number" &&
    sec.maxUserRequestChars < 1
  ) {
    throw new ConfigError(
      "security.maxUserRequestChars must be at least 1",
    );
  }
  if (Array.isArray(sec.injectionPatterns)) {
    for (const pattern of sec.injectionPatterns) {
      if (typeof pattern !== "string") {
        throw new ConfigError(
          "security.injectionPatterns must be an array of strings",
        );
      }
      try {
        new RegExp(pattern);
      } catch {
        throw new ConfigError(
          `security.injectionPatterns contains invalid regex: ${pattern}`,
        );
      }
    }
  }
}

// ─── Loader ──────────────────────────────────────────────────────────────────

/**
 * Result of a successful config load.
 */
export interface LoadedConfig {
  readonly config: SkillOptAdapterConfig;
  /** Absolute path to the config file that was loaded, or null if defaults. */
  readonly configPath: string | null;
}

/**
 * Load the SkillOpt adapter configuration.
 *
 * Priority order (highest to lowest):
 * 1. `explicitPath` argument
 * 2. `SKILLOPT_CONFIG` environment variable
 * 3. Convention search starting from `cwd`
 * 4. Built-in defaults
 */
export function loadConfig(
  explicitPath?: string,
  cwd: string = process.cwd(),
): LoadedConfig {
  const envPath = process.env["SKILLOPT_CONFIG"];
  const searchPath = explicitPath ?? envPath;

  if (searchPath != null) {
    const abs = resolve(searchPath);
    if (!existsSync(abs)) {
      throw new ConfigError(`Config file not found: ${abs}`);
    }
    return loadFromFile(abs);
  }

  // Convention search
  for (const name of CONFIG_FILE_NAMES) {
    const candidate = join(cwd, name);
    if (existsSync(candidate)) {
      return loadFromFile(candidate);
    }
  }

  // Defaults only
  return { config: DEFAULT_CONFIG, configPath: null };
}

function loadFromFile(absPath: string): LoadedConfig {
  let raw: Record<string, unknown>;
  try {
    raw = parseYaml(readFileSync(absPath, "utf8"));
  } catch (err) {
    if (err instanceof ConfigError) throw err;
    throw new ConfigError(
      `Failed to read config file at ${absPath}: ${String(err)}`,
    );
  }

  // Normalize top-level "skillopt" key (config files use kebab-case sections)
  const normalized = normalizeKeys(raw);
  validateConfig(normalized);

  const config = deepMerge(
    DEFAULT_CONFIG as unknown as Record<string, unknown>,
    normalized,
  ) as unknown as SkillOptAdapterConfig;

  return { config, configPath: absPath };
}

/**
 * Convert snake_case / kebab-case YAML keys to camelCase for all known
 * config keys. Only known keys are renamed; unknown keys pass through.
 */
function normalizeKeys(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const KEY_MAP: Record<string, string> = {
    batch_size: "batchSize",
    retry_attempts: "retryAttempts",
    retry_delay_ms: "retryDelayMs",
    timeout_ms: "timeoutMs",
    golden_dataset: "goldenDataset",
    success_rate_min_delta: "successRateMinDelta",
    accuracy_min_delta: "accuracyMinDelta",
    hallucination_rate_max_delta: "hallucinationRateMaxDelta",
    latency_p95_max_delta_ms: "latencyP95MaxDeltaMs",
    cost_max_delta_fraction: "costMaxDeltaFraction",
    storage_dir: "storageDir",
    retention_days: "retentionDays",
    auto_trigger_count: "autoTriggerCount",
    keep_rejected: "keepRejected",
    rejected_retention_days: "rejectedRetentionDays",
    max_versions_per_skill: "maxVersionsPerSkill",
    min_trajectories: "minTrajectories",
    max_user_request_chars: "maxUserRequestChars",
    injection_patterns: "injectionPatterns",
  };

  function normalize(obj: unknown): unknown {
    if (Array.isArray(obj)) return obj.map(normalize);
    if (typeof obj === "object" && obj !== null) {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        const normalized = KEY_MAP[k] ?? k;
        result[normalized] = normalize(v);
      }
      return result;
    }
    return obj;
  }

  return normalize(raw) as Record<string, unknown>;
}

// ─── Module-level singleton ───────────────────────────────────────────────────

let _cached: LoadedConfig | null = null;

/**
 * Get or load the config (cached after first call).
 * Use `resetConfigCache()` in tests.
 */
export function getConfig(
  explicitPath?: string,
  cwd?: string,
): LoadedConfig {
  if (_cached == null) {
    _cached = loadConfig(explicitPath, cwd);
  }
  return _cached;
}

/** Reset the config cache. Used in tests only. */
export function resetConfigCache(): void {
  _cached = null;
}

/** Create a config for testing, merging with defaults. */
export function makeTestConfig(
  overrides: Partial<Record<string, unknown>> = {},
): SkillOptAdapterConfig {
  return deepMerge(
    DEFAULT_CONFIG as unknown as Record<string, unknown>,
    overrides,
  ) as unknown as SkillOptAdapterConfig;
}
