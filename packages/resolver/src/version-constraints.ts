import { SemVer } from '@agy/shared';

/** Small dependency-free SemVer constraint evaluator for resolver requirements. */
export function satisfiesVersion(version: SemVer, constraint: string, dependencyId?: string): boolean {
  let range = constraint.trim();
  if (dependencyId) {
    const marker = range.indexOf('@');
    if (marker >= 0 && range.slice(0, marker) === dependencyId) range = range.slice(marker + 1);
  }
  if (!range || range === '*' || range === 'latest') return true;
  return range.split('||').some((part) => satisfiesAnd(version, part.trim()));
}

function satisfiesAnd(version: string, expression: string): boolean {
  const actual = parse(version);
  if (!actual) return false;
  const terms = expression.split(/\s+/).filter(Boolean);
  return terms.every((term) => {
    const match = term.match(/^(\^|~|>=|<=|>|<|=)?\s*(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
    if (!match) return false;
    const wanted = { major: Number(match[2]), minor: Number(match[3]), patch: Number(match[4]), pre: match[5] };
    const op = match[1] ?? '=';
    const cmp = compare(actual, wanted);
    if (op === '^') return actual.major === wanted.major && cmp >= 0;
    if (op === '~') return actual.major === wanted.major && actual.minor === wanted.minor && cmp >= 0;
    if (op === '>=') return cmp >= 0;
    if (op === '<=') return cmp <= 0;
    if (op === '>') return cmp > 0;
    if (op === '<') return cmp < 0;
    return cmp === 0;
  });
}

function parse(value: string): { major: number; minor: number; patch: number; pre?: string } | null {
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  return match ? { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), pre: match[4] } : null;
}

function compare(a: { major: number; minor: number; patch: number; pre?: string }, b: { major: number; minor: number; patch: number; pre?: string }): number {
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (a[key] !== b[key]) return a[key] > b[key] ? 1 : -1;
  }
  if (a.pre === b.pre) return 0;
  if (!a.pre) return 1;
  if (!b.pre) return -1;
  return a.pre > b.pre ? 1 : -1;
}
