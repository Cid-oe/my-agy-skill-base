"use strict";
/**
 * Test fixtures, fake sandboxes, and synthetic manifest generators for test suites and scale benchmarks.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSyntheticManifest = generateSyntheticManifest;
exports.generateSyntheticCatalog = generateSyntheticCatalog;
function generateSyntheticManifest(id, options = {}) {
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
function generateSyntheticCatalog(count) {
    const list = [];
    for (let i = 0; i < count; i++) {
        const id = `skill-${i}`;
        const requires = i > 0 && i % 3 === 0 ? [`skill-${i - 1}`] : [];
        list.push(generateSyntheticManifest(id, {
            requires,
            produces: [`Artifact-${i}`],
        }));
    }
    return list;
}
//# sourceMappingURL=fixtures.js.map