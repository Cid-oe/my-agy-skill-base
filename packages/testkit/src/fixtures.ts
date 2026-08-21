/**
 * Test fixtures, fake sandboxes, and synthetic manifest generators for test suites and scale benchmarks.
 */

import { SkillManifest } from '@agy/shared';

export function generateSyntheticManifest(id: string, options: Partial<SkillManifest> = {}): SkillManifest {
  return {
    id,
    name: `Skill ${id}`,
    version: '1.0.0',
    description: `Synthetic skill ${id} for scale testing`,
    priority: options.priority || 'medium',
    requires: options.requires || [],
    optional: options.optional || [],
    consumes: options.consumes || [],
    produces: options.produces || [`Artifact-${id}`],
    exclusiveWith: options.exclusiveWith || [],
    confidenceThreshold: options.confidenceThreshold || 0.8,
    triggerPredicates: options.triggerPredicates || [],
    permissions: options.permissions || [],
    capabilities: options.capabilities || ['testing'],
    entryPoint: 'index.ts',
    ...options,
  };
}

export function generateSyntheticCatalog(count: number): SkillManifest[] {
  const list: SkillManifest[] = [];
  for (let i = 0; i < count; i++) {
    const id = `skill-${i}`;
    const requires = i > 0 && i % 3 === 0 ? [`skill-${i - 1}`] : [];
    list.push(
      generateSyntheticManifest(id, {
        requires,
        produces: [`Artifact-${i}`],
      })
    );
  }
  return list;
}
