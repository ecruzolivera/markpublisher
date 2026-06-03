import fs from 'node:fs';
import path from 'node:path';
import toml from 'toml';
import { validateConfig } from './validate/config.js';

export function loadConfig(cwd) {
  const warnings = [];
  let currentDir = cwd || process.cwd();

  while (true) {
    const configPath = path.join(currentDir, 'markpublisher.toml');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = toml.parse(raw);
      const result = validateConfig(parsed, configPath);
      warnings.push(...result.warnings);

      if (result.errors.length) {
        console.error('Configuration errors:');
        result.errors.forEach(e => console.error(`  ${e}`));
        process.exit(2);
      }

      result.data._configDir = path.dirname(configPath);
      return { config: result.data, warnings };
    }

    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }

  const result = validateConfig({}, 'markpublisher.toml');
  return { config: result.data, warnings: result.warnings };
}
