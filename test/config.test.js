import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateConfig } from '../src/validate/config.js';

describe('config validation', () => {
  it('returns defaults for empty config', () => {
    const result = validateConfig({}, 'test.toml');
    assert.ok(result.data);
    assert.equal(result.data.theme, 'default');
    assert.equal(result.data.outputDir, './output');
    assert.ok(result.data.output.html);
    assert.ok(result.data.output.pdf);
  });

  it('rejects theme keys in config', () => {
    const result = validateConfig({
      page_size: 'A4',
    }, 'test.toml');
    assert.ok(result.errors.some(e => e.includes('theme.css')));
  });

  it('accepts valid config keys', () => {
    const result = validateConfig({
      input: 'my-book.md',
      theme: 'custom-theme',
      outputDir: './dist',
    }, 'test.toml');
    assert.equal(result.data.input, 'my-book.md');
    assert.equal(result.data.theme, 'custom-theme');
    assert.equal(result.data.outputDir, './dist');
  });

  it('warns on unknown keys', () => {
    const result = validateConfig({
      some_key: 'value',
    }, 'test.toml');
    assert.ok(result.warnings.some(w => w.includes('Unknown config key')));
  });
});
