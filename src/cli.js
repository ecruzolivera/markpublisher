#!/usr/bin/env node

import path from 'node:path';
import { buildCommand } from './commands/build.js';
import { serveCommand } from './commands/serve.js';
import { initCommand } from './commands/init.js';

const binName = path.basename(process.argv[1]);
const isCreateCommand = binName === 'create-markpublisher-book';
const command = isCreateCommand ? 'init' : process.argv[2];

async function main() {
  switch (command) {
    case 'build':
      await buildCommand();
      break;
    case 'serve':
      await serveCommand();
      break;
    case 'init':
      await initCommand(isCreateCommand ? process.argv[2] : process.argv[3]);
      break;
    default:
      console.log(`markpublisher — Professional book publishing from Markdown

Usage:
  markpublisher build      Build using markpublisher.toml
  markpublisher serve      Start live-reload dev server
  markpublisher init <name> Scaffold new project
`);
      process.exit(0);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(err.exitCode || 3);
});
