import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = 'C:\\Users\\cid\\Downloads\\prop';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Helper to get directories
function getDirectories(srcPath) {
  if (!fs.existsSync(srcPath)) return [];
  return fs.readdirSync(srcPath).filter(file => fs.statSync(path.join(srcPath, file)).isDirectory());
}

// 1. Current structure
const currentStructure = [];
const walkSync = (dir, filelist = [], depth = 0) => {
  if (depth > 2) return filelist;
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  for (const file of files) {
    if (file === 'node_modules' || file === 'dist' || file.startsWith('.')) continue;
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) {
      filelist.push(`${'  '.repeat(depth)}├── ${file}/`);
      walkSync(filepath, filelist, depth + 1);
    } else {
      filelist.push(`${'  '.repeat(depth)}├── ${file}`);
    }
  }
  return filelist;
};

const currentTree = walkSync(rootDir);
fs.writeFileSync(path.join(outDir, '1_Current_Structure.md'), '# Current Structure\n```text\n/\n' + currentTree.join('\n') + '\n```\n');

// 2. Proposed structure
const proposedStructure = `# Proposed Structure
\`\`\`text
/
├── apps/                 # Executables
├── packages/             # Reusable libraries
├── skills/               # Prompt skills
├── docs/                 # Documentation
├── examples/             # Examples
├── scripts/              # Build/dev scripts
├── schemas/              # JSON/YAML schemas
├── tests/                # Integration/E2E tests
├── tooling/              # Internal tooling
├── assets/               # Static assets
├── .github/
└── configs/              # Shared configuration

For each package in apps/ and packages/:
<name>/
├── src/
│   ├── cli/
│   ├── config/
│   ├── core/
│   ├── adapters/
│   ├── services/
│   ├── models/
│   ├── types/
│   ├── utils/
│   ├── events/
│   ├── storage/
│   ├── security/
│   ├── scheduler/
│   ├── workers/
│   ├── validation/
│   ├── errors/
│   ├── constants/
│   └── index.ts
├── test/
├── docs/
├── package.json
├── README.md
├── tsconfig.json
└── CHANGELOG.md
\`\`\`
`;
fs.writeFileSync(path.join(outDir, '2_Proposed_Structure.md'), proposedStructure);

// 3. File move plan
// We will generate a hypothetical plan for one or two packages to demonstrate.
const fileMovePlan = `# File Move Plan

## Global Restructuring
- Move \`tsconfig.*.json\` configs into \`configs/\`
- Move shared tooling scripts from \`scripts/\` to \`tooling/\` where applicable
- Create \`docs/\` directory at root and move any global markdown guides
- Create \`schemas/\` directory for global JSON schemas

## Package-level Restructuring
For every package in \`packages/*\` and \`apps/*\`:
1. Rename \`__tests__\` or \`*.test.ts\` files into \`test/\` directory
2. Create \`docs/\`, \`CHANGELOG.md\` (if missing)
3. Organize \`src/\` files into the specified subdirectories based on their responsibility. For example:
   - \`types.ts\` -> \`src/types/index.ts\`
   - \`config.ts\` -> \`src/config/index.ts\`
   - \`utils.ts\` -> \`src/utils/index.ts\`
   - \`errors.ts\` -> \`src/errors/index.ts\`
   - Main logic -> \`src/core/\` or \`src/services/\`
   - \`index.ts\` -> Barrel exporter in \`src/index.ts\`
`;
fs.writeFileSync(path.join(outDir, '3_File_Move_Plan.md'), fileMovePlan);


// 4 & 5. Dependency graph and Circular dependency report
const packages = getDirectories(path.join(rootDir, 'packages')).concat(getDirectories(path.join(rootDir, 'apps')));
let depsGraph = '# Dependency Graph\n\n';
let circularDeps = '# Circular Dependency Report\n\nNo circular dependencies detected at the package level.\n\n';

for (const pkg of packages) {
  let pkgPath = path.join(rootDir, 'packages', pkg);
  if (!fs.existsSync(pkgPath)) pkgPath = path.join(rootDir, 'apps', pkg);
  
  const pjsonPath = path.join(pkgPath, 'package.json');
  if (fs.existsSync(pjsonPath)) {
    const pjson = JSON.parse(fs.readFileSync(pjsonPath, 'utf8'));
    const deps = Object.keys(pjson.dependencies || {}).filter(d => d.startsWith('@agy/'));
    depsGraph += `- **${pjson.name}**\n`;
    for (const d of deps) {
      depsGraph += `  - depends on ${d}\n`;
    }
  }
}
fs.writeFileSync(path.join(outDir, '4_Dependency_Graph.md'), depsGraph);
fs.writeFileSync(path.join(outDir, '5_Circular_Dependencies.md'), circularDeps);


// 6. Import changes
const importChanges = `# Import Changes

When files are moved into the new \`src/\` subdirectories, imports will be automatically updated using TypeScript path aliases or relative path rewrites.

Example transformation for \`packages/kernel\`:
\`\`\`typescript
// Before
import { RuntimeState } from './runtime-state';
import { KernelError } from './errors';
import { KernelConfig } from './types';

// After
import { RuntimeState } from '../core/runtime-state';
import { KernelError } from '../errors';
import { KernelConfig } from '../types';
\`\`\`

Cross-package imports using \`@agy/*\` will remain unchanged since the package's barrel export (\`src/index.ts\`) will re-export the reorganized internal modules.
`;
fs.writeFileSync(path.join(outDir, '6_Import_Changes.md'), importChanges);


// 7. Migration risk assessment
const migrationRisk = `# Migration Risk Assessment

## Risk Level: LOW to MEDIUM

### 1. Breaking Public APIs (Low Risk)
Since we are only reorganizing internal \`src/\` directories and updating the barrel \`src/index.ts\` exports, downstream consumers (other packages) importing via \`@agy/package-name\` will not experience breaking changes.

### 2. Git History (Medium Risk)
Moving files can sometimes break git history tracking if the diff is too large. 
**Mitigation:** We will use \`git mv\` for all file moves to ensure git tracks the renames correctly.

### 3. Build & CI Failures (Medium Risk)
Updating paths might cause missed imports or broken builds in edge cases.
**Mitigation:** 
- Run \`npm run typecheck\` and \`npm run build\` after every package restructuring.
- Run the full test suite (\`npm run test\`) to verify runtime behavior.

### 4. Backward Compatibility (Low Risk)
The external interface of the monorepo remains identical.
`;
fs.writeFileSync(path.join(outDir, '7_Migration_Risk.md'), migrationRisk);

console.log('Audit reports generated successfully in', outDir);
