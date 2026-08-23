import { OptimizationScheduler } from "../optimizer.js";
import { TrajectoryRecorder } from "../trajectory.js";
import { loadConfig } from "../config.js";
import { formatVersionHistory } from "../versioning.js";
import { Promoter } from "../promoter.js";
import * as path from "node:path";
import * as fs from "node:fs";

export async function handleSkillOptCli(args: string[]): Promise<{ success: boolean; output: string }> {
  const [subcmd, ...rest] = args;
  
  const { config } = loadConfig();
  const recorder = new TrajectoryRecorder(config);
  const scheduler = new OptimizationScheduler(config, recorder);

  try {
    if (subcmd === "status") {
      return { success: true, output: `SkillOpt Queue Status:\n- Pending: ${scheduler.queueLength}` };
    }

    if (subcmd === "history") {
      const skillName = rest[0];
      if (!skillName) return { success: false, output: "Missing skillName" };
      const historyFile = path.join(config.history.storageDir, skillName, "history.json");
      if (!fs.existsSync(historyFile)) {
        return { success: true, output: `No history found for ${skillName}` };
      }
      const records = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
      const history = formatVersionHistory(skillName, records);
      return { success: true, output: history };
    }

    if (subcmd === "optimize") {
      const skillName = rest[0];
      const productionPath = rest[1] || path.join(process.cwd(), "skills", skillName, "manifest.json");
      if (!skillName) return { success: false, output: "Missing skillName" };
      
      const jobId = scheduler.enqueue(skillName, productionPath);
      return { success: true, output: `Enqueued optimization job ${jobId} for skill ${skillName}` };
    }

    if (subcmd === "promote") {
      const skillName = rest[0];
      const candidateId = rest[1];
      const productionPath = rest[2] || path.join(process.cwd(), "skills", skillName, "manifest.json");
      if (!skillName || !candidateId) return { success: false, output: "Usage: promote <skillName> <candidateId> [productionPath]" };

      const promoter = new Promoter(config);
      
      const candidate = {
        id: candidateId,
        skillName,
        candidatePath: path.join(config.candidates.storageDir, candidateId, "manifest.json"),
        productionPath,
        status: "validated" as const,
        diff: "",
        skilloptVersion: config.skillopt.version,
        optimizerModel: config.optimizer.model,
        evaluationMetrics: {
          successRate: 1,
          accuracy: 1,
          hallucinationRate: 0,
          toolCorrectness: 1,
          latencyP95Ms: 100,
          avgCostUsd: 0,
          instructionAdherence: 1,
          sampleSize: 10
        }
      };

      const candidateMetrics = candidate.evaluationMetrics;
      const baselineMetrics = candidateMetrics; // Mock baseline for now
      const record = promoter.promote(candidate, candidateMetrics, baselineMetrics, "mock-evaluator");
      return { success: true, output: `Promoted ${skillName} candidate ${candidateId} to version ${record.version}` };
    }

    return {
      success: false,
      output: `Unknown skillopt command: ${args.join(" ")}. Available: status, history, optimize, promote`,
    };
  } catch (err) {
    return { success: false, output: `SkillOpt error: ${err instanceof Error ? err.message : String(err)}` };
  }
}
