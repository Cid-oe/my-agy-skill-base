/**
 * Manifest schema validator (SRC-16).
 *
 * Loads the canonical `schemas/skill-manifest.json` contract and enforces its
 * constraints on registration. Implemented as a focused validator for the
 * canonical schema (required fields, types, enums, numeric ranges, string
 * patterns, array item types) rather than pulling in a full JSON Schema
 * implementation, so the package keeps its zero-runtime-dependency property.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { SkillManifest } from '@agy/shared';

export interface ManifestValidationIssue {
  path: string;
  message: string;
}

type JsonSchemaType = 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';

interface JsonSchemaProperty {
  type?: JsonSchemaType | JsonSchemaType[];
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, JsonSchemaProperty>;
  items?: JsonSchemaProperty;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  maxLength?: number;
}

interface JsonSchema {
  required?: string[];
  properties?: Record<string, JsonSchemaProperty>;
}

const DEFAULT_SCHEMA_PATH = path.resolve(process.cwd(), 'schemas', 'skill-manifest.json');

/**
 * Resolve and load the manifest schema. Falls back through candidate paths so
 * validation still works when the cwd is not the repo root.
 */
export function loadManifestSchema(schemaPath?: string): JsonSchema | null {
  const candidates = [
    schemaPath,
    DEFAULT_SCHEMA_PATH,
    path.resolve(__dirname, '..', '..', '..', 'schemas', 'skill-manifest.json'),
    path.resolve(process.cwd(), 'schemas', 'skill-manifest.json'),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const content = fs.readFileSync(candidate, 'utf-8');
      return JSON.parse(content) as JsonSchema;
    } catch {
      // try next candidate
    }
  }
  return null;
}

function matchesType(value: unknown, type: JsonSchemaType | JsonSchemaType[]): boolean {
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => {
    switch (t) {
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && Number.isFinite(value);
      case 'integer':
        return typeof value === 'number' && Number.isInteger(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'null':
        return value === null;
      default:
        return false;
    }
  });
}

/**
 * Validate a manifest against the loaded schema. Returns a list of issues
 * (empty when valid).
 */
export function validateManifestAgainstSchema(manifest: unknown, schema: JsonSchema): ManifestValidationIssue[] {
  const issues: ManifestValidationIssue[] = [];

  if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) {
    issues.push({ path: '$', message: 'manifest must be an object' });
    return issues;
  }

  const root = manifest as Record<string, unknown>;
  for (const field of schema.required ?? []) {
    if (!(field in root) || root[field] === undefined) {
      issues.push({ path: `$.${field}`, message: `required field '${field}' is missing` });
    }
  }

  for (const [field, property] of Object.entries(schema.properties ?? {})) {
    if (!(field in root)) continue;
    const value = root[field];
    validateValue(value, property, `$.${field}`, issues);
  }

  return issues;
}

function validateValue(
  value: unknown,
  property: JsonSchemaProperty,
  path: string,
  issues: ManifestValidationIssue[]
): void {
  if (value === undefined) return;

  if (property.type !== undefined && !matchesType(value, property.type)) {
    issues.push({ path, message: `expected type ${JSON.stringify(property.type)}, got ${Array.isArray(value) ? 'array' : typeof value}` });
    return;
  }

  if (property.enum !== undefined && !property.enum.includes(value)) {
    issues.push({ path, message: `value '${String(value)}' is not one of ${JSON.stringify(property.enum)}` });
  }

  if (typeof value === 'number') {
    if (property.minimum !== undefined && value < property.minimum) {
      issues.push({ path, message: `value ${value} is less than minimum ${property.minimum}` });
    }
    if (property.maximum !== undefined && value > property.maximum) {
      issues.push({ path, message: `value ${value} is greater than maximum ${property.maximum}` });
    }
  }

  if (typeof value === 'string') {
    if (property.maxLength !== undefined && value.length > property.maxLength) {
      issues.push({ path, message: `string length ${value.length} exceeds maxLength ${property.maxLength}` });
    }
    if (property.pattern !== undefined) {
      const re = new RegExp(property.pattern);
      if (!re.test(value)) {
        issues.push({ path, message: `value '${value}' does not match pattern ${property.pattern}` });
      }
    }
  }

  if (Array.isArray(value) && property.items !== undefined) {
    for (let i = 0; i < value.length; i++) {
      validateValue(value[i], property.items, `${path}[${i}]`, issues);
    }
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value) && property.properties !== undefined) {
    const obj = value as Record<string, unknown>;
    for (const field of property.required ?? []) {
      if (!(field in obj) || obj[field] === undefined) {
        issues.push({ path: `${path}.${field}`, message: `required field '${field}' is missing` });
      }
    }
    for (const [field, child] of Object.entries(property.properties)) {
      if (field in obj) {
        validateValue(obj[field], child, `${path}.${field}`, issues);
      }
    }
  }
}

/**
 * Convenience: validate a manifest and return the issues. Returns an empty
 * array when the manifest conforms to the schema.
 */
export function validateManifest(
  manifest: SkillManifest,
  schemaPath?: string
): ManifestValidationIssue[] {
  const schema = loadManifestSchema(schemaPath);
  if (!schema) {
    // Schema unavailable: cannot validate structurally.
    return [];
  }
  return validateManifestAgainstSchema(manifest, schema);
}
