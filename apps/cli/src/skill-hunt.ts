import * as fs from 'node:fs';
import * as path from 'node:path';
import { SkillManifest } from '@agy/shared';

export interface SkillValidationResult {
  score: number;
  lines: string[];
  manifest?: SkillManifest;
}

export interface RankedSkill {
  manifest: SkillManifest;
  score: number;
  reasons: string[];
}

export interface ArtifactPathStep {
  skillId: string;
  outputArtifact: string;
}

export function searchSkills(skills: SkillManifest[], query: string): SkillManifest[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return skills.filter((skill) => [
    skill.id,
    skill.name,
    skill.description,
    ...skill.consumes,
    ...skill.produces,
    ...skill.capabilities,
  ].some((value) => value.toLowerCase().includes(needle)));
}

export function validateSkillDirectory(directory: string): SkillValidationResult {
  const lines: string[] = [];
  let score = 100;
  const manifestPath = path.join(directory, 'manifest.json');
  const readmePath = path.join(directory, 'README.md');

  if (!fs.existsSync(manifestPath)) {
    return { score: 0, lines: ['FAIL manifest.json is missing'] };
  }

  let manifest: SkillManifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as SkillManifest;
  } catch (error) {
    return { score: 0, lines: [`FAIL manifest.json is invalid JSON: ${error instanceof Error ? error.message : String(error)}`] };
  }

  const requiredIdentity = ['id', 'name', 'version', 'description', 'entryPoint'];
  const missing = requiredIdentity.filter((field) => !manifest[field as keyof SkillManifest]);
  if (missing.length > 0) {
    lines.push(`FAIL manifest is missing required fields: ${missing.join(', ')}`);
    score -= 60;
  } else {
    lines.push(`PASS manifest ${manifest.id}@${manifest.version} is readable`);
  }

  if (!Array.isArray(manifest.produces) || manifest.produces.length === 0) {
    lines.push('FAIL produces must declare at least one artifact type');
    score -= 30;
  } else {
    lines.push(`PASS produces: ${manifest.produces.join(', ')}`);
  }

  if (!Array.isArray(manifest.permissions)) {
    lines.push('FAIL permissions must be declared as an array');
    score -= 20;
  } else {
    lines.push(`PASS permissions declared (${manifest.permissions.length})`);
  }

  if (typeof manifest.entryPoint === 'string' && fs.existsSync(path.join(directory, manifest.entryPoint))) {
    lines.push(`PASS entry point exists: ${manifest.entryPoint}`);
  } else {
    lines.push(`FAIL entry point is missing: ${String(manifest.entryPoint)}`);
    score -= 20;
  }

  if (fs.existsSync(readmePath)) {
    lines.push('PASS README.md exists');
  } else {
    lines.push('WARN README.md is missing');
    score -= 10;
  }

  return { score: Math.max(0, score), lines, manifest };
}

export function rankSkills(
  skills: SkillManifest[],
  artifactType: string,
  sourcePaths = new Map<string, string>()
): RankedSkill[] {
  return skills
    .filter((skill) => skill.produces.includes(artifactType))
    .map((manifest) => {
      let score = 50 + Math.round(manifest.confidenceThreshold * 10);
      const reasons = [`+50 produces ${artifactType}`, `+${Math.round(manifest.confidenceThreshold * 10)} confidence`];
      const sourcePath = sourcePaths.get(manifest.id);
      if (sourcePath && fs.existsSync(path.join(sourcePath, 'README.md'))) {
        score += 10;
        reasons.push('+10 README exists');
      }
      if (sourcePath && fs.existsSync(path.join(sourcePath, manifest.entryPoint))) {
        score += 10;
        reasons.push('+10 entry point exists');
      }
      if (manifest.permissions.length === 0) {
        score += 20;
        reasons.push('+20 no permissions required');
      } else if (manifest.permissions.some((permission) => permission.scope === '*')) {
        score -= 10;
        reasons.push('-10 wildcard permission');
      }
      return { manifest, score, reasons };
    })
    .sort((left, right) => right.score - left.score || left.manifest.id.localeCompare(right.manifest.id));
}

export function findArtifactPaths(
  skills: SkillManifest[],
  fromArtifact: string,
  toArtifact: string
): ArtifactPathStep[][] {
  if (fromArtifact === toArtifact) return [[]];
  const results: ArtifactPathStep[][] = [];
  const queue: Array<{ artifact: string; steps: ArtifactPathStep[]; visited: Set<string> }> = [
    { artifact: fromArtifact, steps: [], visited: new Set([fromArtifact]) },
  ];

  while (queue.length > 0 && results.length < 10) {
    const current = queue.shift()!;
    for (const skill of skills) {
      if (!skill.consumes.includes(current.artifact)) continue;
      for (const produced of skill.produces) {
        const steps = [...current.steps, { skillId: skill.id, outputArtifact: produced }];
        if (produced === toArtifact) {
          results.push(steps);
        } else if (!current.visited.has(produced)) {
          queue.push({ artifact: produced, steps, visited: new Set([...current.visited, produced]) });
        }
      }
    }
  }
  return results;
}
