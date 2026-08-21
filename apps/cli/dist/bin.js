#!/usr/bin/env node
"use strict";
/**
 * Binary entry point for AGY CLI (`agy`).
 */
Object.defineProperty(exports, "__esModule", { value: true });
const cli_js_1 = require("./cli.js");
const args = process.argv.slice(2);
(0, cli_js_1.handleCliCommand)(args)
    .then((result) => {
    console.log(result.output);
    process.exit(result.success ? 0 : 1);
})
    .catch((err) => {
    console.error('CLI Fatal Error:', err);
    process.exit(1);
});
//# sourceMappingURL=bin.js.map