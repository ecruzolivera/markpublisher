import fs from 'node:fs';
import path from 'node:path';
import toml from 'toml';
import { validateConfig } from './validate/config.js';

export class ConfigurationError extends Error {
  constructor(message, configPath) {
    super(message);
    this.name = 'ConfigurationError';
    this.exitCode = 2;
    this.configPath = configPath;
  }
}

export function loadConfig(cwd) {
  const warnings = [];
  const startDir = path.resolve(cwd || process.cwd());
  let currentDir = startDir;
  const searchedPaths = [];

  while (true) {
    const configPath = path.join(currentDir, 'markpublisher.toml');
    searchedPaths.push(configPath);
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      let parsed;
      try {
        parsed = toml.parse(raw);
      } catch (error) {
        throw new ConfigurationError(`[${configPath}] Invalid TOML: ${error.message}`, configPath);
      }
      const result = validateConfig(parsed, configPath);
      warnings.push(...result.warnings);

      if (result.errors.length) {
        throw new ConfigurationError(result.errors.join('\n'), configPath);
      }

      result.data._configDir = path.dirname(configPath);
      return { config: result.data, warnings, configPath, searchedPaths };
    }

    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }

  const result = validateConfig({}, 'markpublisher.toml');
  result.data._configDir = startDir;
  return { config: result.data, warnings: result.warnings, configPath: null, searchedPaths };
}
