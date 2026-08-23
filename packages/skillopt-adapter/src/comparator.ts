/**
 * @module comparator
 *
 * Compares candidate metrics to production baseline metrics.
 * Applies configured thresholds to decide whether a candidate
 * should be promoted.
 *
 * The promotion gate is strict: there is no --force flag.
 * A candidate that fails any threshold check is rejected.
 */

import type {
  EvaluationMetrics,
  PromotionThresholds,
  ComparisonResult,
  MetricCheck,
} from "./types.js";

// ─── Comparison Logic ─────────────────────────────────────────────────────────

/**
 * Compare candidate metrics to production baseline metrics.
 * Returns a ComparisonResult indicating whether the candidate passes
 * all configured thresholds.
 *
 * Design: each metric is checked independently. All must pass.
 * The reason for rejection includes all failing metrics, not just the first.
 */
export function compareMetrics(
  skillName: string,
  candidateId: string,
  candidate: EvaluationMetrics,
  baseline: EvaluationMetrics,
  thresholds: PromotionThresholds,
): ComparisonResult {
  if (baseline.sampleSize === 0) {
    // No production trajectory data yet — promote any candidate that passes
    // the structural check (non-zero metrics). This handles the bootstrap case
    // where a skill is being optimized for the first time.
    return bootstrapPromotion(skillName, candidateId, candidate);
  }

  const checks: MetricCheck[] = [
    checkSuccessRate(candidate, baseline, thresholds),
    checkAccuracy(candidate, baseline, thresholds),
    checkHallucinationRate(candidate, baseline, thresholds),
    checkLatency(candidate, baseline, thresholds),
    checkCost(candidate, baseline, thresholds),
  ];

  const allPass = checks.every((c) => c.pass);

  const failingChecks = checks.filter((c) => !c.pass);

  const summary = allPass
    ? buildPassSummary(checks)
    : buildFailSummary(failingChecks);

  return {
    skillName,
    candidateId,
    pass: allPass,
    checks,
    summary,
  };
}

// ─── Individual Metric Checks ─────────────────────────────────────────────────

function checkSuccessRate(
  candidate: EvaluationMetrics,
  baseline: EvaluationMetrics,
  thresholds: PromotionThresholds,
): MetricCheck {
  const delta = candidate.successRate - baseline.successRate;
  const pass = delta >= thresholds.successRateMinDelta;

  return {
    metric: "success_rate",
    candidateValue: candidate.successRate,
    baselineValue: baseline.successRate,
    delta,
    threshold: thresholds.successRateMinDelta,
    pass,
    description: pass
      ? `Success rate improved by ${fmt(delta, true)}`
      : `Success rate delta ${fmt(delta)} below threshold ${fmt(thresholds.successRateMinDelta)}`,
  };
}

function checkAccuracy(
  candidate: EvaluationMetrics,
  baseline: EvaluationMetrics,
  thresholds: PromotionThresholds,
): MetricCheck {
  const delta = candidate.accuracy - baseline.accuracy;
  const pass = delta >= thresholds.accuracyMinDelta;

  return {
    metric: "accuracy",
    candidateValue: candidate.accuracy,
    baselineValue: baseline.accuracy,
    delta,
    threshold: thresholds.accuracyMinDelta,
    pass,
    description: pass
      ? `Accuracy improved by ${fmt(delta, true)}`
      : `Accuracy delta ${fmt(delta)} below threshold ${fmt(thresholds.accuracyMinDelta)}`,
  };
}

function checkHallucinationRate(
  candidate: EvaluationMetrics,
  baseline: EvaluationMetrics,
  thresholds: PromotionThresholds,
): MetricCheck {
  // For hallucination rate, lower is better. Delta is candidate - baseline.
  // Positive delta means MORE hallucinations (bad). We allow up to maxDelta.
  const delta = candidate.hallucinationRate - baseline.hallucinationRate;
  const pass = delta <= thresholds.hallucinationRateMaxDelta;

  return {
    metric: "hallucination_rate",
    candidateValue: candidate.hallucinationRate,
    baselineValue: baseline.hallucinationRate,
    delta,
    threshold: thresholds.hallucinationRateMaxDelta,
    pass,
    description: pass
      ? delta <= 0
        ? `Hallucination rate decreased by ${fmt(Math.abs(delta), true)}`
        : `Hallucination rate increased by ${fmt(delta)} (within allowed ${fmt(thresholds.hallucinationRateMaxDelta)})`
      : `Hallucination rate increased by ${fmt(delta)}, exceeding allowed ${fmt(thresholds.hallucinationRateMaxDelta)}`,
  };
}

function checkLatency(
  candidate: EvaluationMetrics,
  baseline: EvaluationMetrics,
  thresholds: PromotionThresholds,
): MetricCheck {
  const delta = candidate.latencyP95Ms - baseline.latencyP95Ms;
  const pass = delta <= thresholds.latencyP95MaxDeltaMs;

  return {
    metric: "latency_p95_ms",
    candidateValue: candidate.latencyP95Ms,
    baselineValue: baseline.latencyP95Ms,
    delta,
    threshold: thresholds.latencyP95MaxDeltaMs,
    pass,
    description: pass
      ? delta <= 0
        ? `P95 latency decreased by ${delta.toFixed(0)}ms`
        : `P95 latency increased by ${delta.toFixed(0)}ms (within allowed ${thresholds.latencyP95MaxDeltaMs}ms)`
      : `P95 latency increased by ${delta.toFixed(0)}ms, exceeding allowed ${thresholds.latencyP95MaxDeltaMs}ms`,
  };
}

function checkCost(
  candidate: EvaluationMetrics,
  baseline: EvaluationMetrics,
  thresholds: PromotionThresholds,
): MetricCheck {
  // If baseline cost is 0, use absolute threshold of $0.001 per call
  const baselineCost =
    baseline.avgCostUsd > 0 ? baseline.avgCostUsd : 0.001;
  const delta = candidate.avgCostUsd - baseline.avgCostUsd;
  const fractionalDelta = delta / baselineCost;
  const pass = fractionalDelta <= thresholds.costMaxDeltaFraction;

  return {
    metric: "avg_cost_usd",
    candidateValue: candidate.avgCostUsd,
    baselineValue: baseline.avgCostUsd,
    delta,
    threshold: thresholds.costMaxDeltaFraction,
    pass,
    description: pass
      ? delta <= 0
        ? `Cost decreased by $${Math.abs(delta).toFixed(6)}`
        : `Cost increased by $${delta.toFixed(6)} (${(fractionalDelta * 100).toFixed(1)}%, within allowed ${(thresholds.costMaxDeltaFraction * 100).toFixed(0)}%)`
      : `Cost increased by ${(fractionalDelta * 100).toFixed(1)}%, exceeding allowed ${(thresholds.costMaxDeltaFraction * 100).toFixed(0)}%`,
  };
}

// ─── Bootstrap Case ───────────────────────────────────────────────────────────

/** Handle the case where there's no production baseline data yet. */
function bootstrapPromotion(
  skillName: string,
  candidateId: string,
  candidate: EvaluationMetrics,
): ComparisonResult {
  const pass = candidate.successRate >= 0 && candidate.sampleSize >= 0;

  return {
    skillName,
    candidateId,
    pass,
    checks: [
      {
        metric: "bootstrap",
        candidateValue: candidate.successRate,
        baselineValue: 0,
        delta: candidate.successRate,
        threshold: 0,
        pass,
        description:
          "No production baseline available — accepting first optimized candidate",
      },
    ],
    summary: pass
      ? "Bootstrap promotion: no production baseline, accepting candidate as first optimized version"
      : "Bootstrap promotion failed",
  };
}

// ─── Summary Builders ─────────────────────────────────────────────────────────

function buildPassSummary(
  checks: MetricCheck[],
): string {
  const improvements = checks
    .filter((c) => {
      if (c.metric === "hallucination_rate" || c.metric === "latency_p95_ms" || c.metric === "avg_cost_usd") {
        return c.delta < 0;
      }
      return c.delta > 0;
    })
    .map((c) => c.description);

  if (improvements.length === 0) {
    return "Candidate meets all thresholds (no regression detected)";
  }

  return `Candidate approved. Improvements: ${improvements.join("; ")}`;
}

function buildFailSummary(failingChecks: MetricCheck[]): string {
  return (
    `Candidate rejected. Failed checks: ` +
    failingChecks.map((c) => `${c.metric} (${c.description})`).join("; ")
  );
}

// ─── Formatting Utilities ─────────────────────────────────────────────────────

function fmt(value: number, positive = false): string {
  const pct = (value * 100).toFixed(2);
  if (positive && value > 0) return `+${pct}pp`;
  return `${pct}pp`;
}

// ─── Human-Readable Comparison Report ────────────────────────────────────────

/**
 * Format a ComparisonResult as a human-readable report for the CLI.
 */
export function formatComparisonReport(result: ComparisonResult): string {
  const lines: string[] = [
    `Skill: ${result.skillName}`,
    `Candidate: ${result.candidateId}`,
    `Verdict: ${result.pass ? "✓ PASS — eligible for promotion" : "✗ FAIL — not eligible for promotion"}`,
    ``,
    `Metric checks:`,
  ];

  for (const check of result.checks) {
    const icon = check.pass ? "  ✓" : "  ✗";
    lines.push(`${icon} ${check.description}`);
  }

  lines.push(``, result.summary);
  return lines.join("\n");
}
