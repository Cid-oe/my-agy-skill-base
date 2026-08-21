#!/usr/bin/env node
/**
 * Binary entry point for AGY CLI (`agy`).
 */

import { handleCliCommand } from './cli.js';

const args = process.argv.slice(2);

handleCliCommand(args)
  .then((result) => {
    console.log(result.output);
    process.exit(result.success ? 0 : 1);
  })
  .catch((err) => {
    console.error('CLI Fatal Error:', err);
    process.exit(1);
  });
