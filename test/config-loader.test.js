import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadConfig, ConfigurationError } from '../src/config.js';
import { validateConfig } from '../src/validate/config.js';

const cli = path.resolve(import.meta.dirname, '../src/cli.js');

describe('configuration boundaries', () => {
  it('rejects invalid nested types and accepts port boundaries', () => {
    for (const table of ['output', 'build', 'serve']) {
      for (const value of [null, [], true, 'false', new Date()]) {
        assert.ok(validateConfig({ [table]: value }, 'test.toml').errors.length);
      }
    }
    for (const raw of [{ output: { html: 'false' } }, { build: { failOnWarning: 1 } },
      ...[0, 65536, 3.5, '3000'].map(port => ({ serve: { port } }))]) {
      assert.ok(validateConfig(raw, 'test.toml').errors.length);
    }
    for (const port of [1, 65535]) {
      assert.equal(validateConfig({ serve: { port } }, 'test.toml').errors.length, 0);
    }
    assert.match(validateConfig({ output: { typo: true } }, 'test.toml').warnings[0], /output.typo/);
  });

  it('returns independent defaults', () => {
    const first = validateConfig({}, 'test.toml');
    first.data.output.html = false;
    assert.equal(validateConfig({}, 'test.toml').data.output.html, true);
  });

  it('resolves fallback context, parent configs and typed failures', t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markpublisher-config-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const child = path.join(dir, 'chapters');
    fs.mkdirSync(child);
    assert.equal(loadConfig(child).config._configDir, child);
    const configPath = path.join(dir, 'markpublisher.toml');
    fs.writeFileSync(configPath, 'input = "book.md"');
    const loaded = loadConfig(child);
    assert.equal(loaded.config._configDir, dir);
    assert.equal(loaded.configPath, configPath);
    assert.ok(loaded.searchedPaths.includes(path.join(child, 'markpublisher.toml')));
    for (const invalid of ['input = [', '[serve]\nport = "abc"']) {
      fs.writeFileSync(configPath, invalid);
      assert.throws(() => loadConfig(child), ConfigurationError);
      const command = spawnSync(process.execPath, [cli, 'build'], { cwd: child, encoding: 'utf8' });
      assert.equal(command.status, 2);
      assert.ok(command.stderr.includes(configPath));
    }
  });
});
