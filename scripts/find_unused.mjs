import { Project } from "ts-morph";
import fs from "fs";

const project = new Project({
    tsConfigFilePath: "tsconfig.json",
});
project.addSourceFilesAtPaths("packages/**/src/**/*.ts");
project.addSourceFilesAtPaths("apps/**/src/**/*.ts");

const sourceFiles = project.getSourceFiles();

console.log("Analyzing " + sourceFiles.length + " files...");

const unusedFiles = [];
const unusedExports = [];

for (const sourceFile of sourceFiles) {
    const filePath = sourceFile.getFilePath();
    if (filePath.includes("node_modules")) continue;
    if (filePath.includes("dist")) continue;
    
    // Check if the file is imported anywhere
    const referencingNodes = sourceFile.getReferencingNodesInOtherSourceFiles();
    const isTest = filePath.includes(".test.ts") || filePath.includes("tests/src");
    const isCli = filePath.includes("cli/src/bin.ts") || filePath.includes("cli/src/index.ts") || filePath.includes("playground/src/index.ts");
    
    if (referencingNodes.length === 0 && !isTest && !isCli) {
        unusedFiles.push(filePath);
    }

    // Check exports
    const exportedDeclarations = sourceFile.getExportedDeclarations();
    for (const [name, declarations] of exportedDeclarations) {
        if (name === "default") continue;
        for (const dec of declarations) {
            try {
                if (dec.findReferencesAsNodes) {
                    const refs = dec.findReferencesAsNodes();
                    const externalRefs = refs.filter(r => r.getSourceFile().getFilePath() !== filePath);
                    if (externalRefs.length === 0 && !isTest && !isCli && !filePath.includes("src/index.ts")) {
                        unusedExports.push({ file: filePath, name: name });
                    }
                }
            } catch(e) {}
        }
    }
}

fs.writeFileSync("unused_report.json", JSON.stringify({ unusedFiles, unusedExports }, null, 2));
console.log("Done");
