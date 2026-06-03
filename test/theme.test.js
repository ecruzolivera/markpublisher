import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { parseThemeCss, discoverTheme } from '../src/themes/loader.js';

describe('theme CSS parsing', () => {
  it('parses @page size to format', () => {
    const result = parseThemeCss('@page { size: A4; margin: 0; }');
    assert.equal(result.format, 'A4');
  });

  it('parses .page dimensions for custom sizes', () => {
    const result = parseThemeCss('.page { width: 6in; height: 9in; }');
    assert.equal(result.width, '6in');
    assert.equal(result.height, '9in');
  });

  it('returns A4 as default when neither @page nor .page found', () => {
    const result = parseThemeCss('body { color: red; }');
    assert.equal(result.format, 'A4');
  });

  it('@page wins over .page when both present', () => {
    const result = parseThemeCss('@page { size: A5; } .page { width: 6in; height: 9in; }');
    assert.equal(result.format, 'A5');
  });

  it('parses @page with A5 size', () => {
    const result = parseThemeCss('@page { size: A5; margin: 0; }');
    assert.equal(result.format, 'A5');
  });
});

describe('theme loading', () => {
  it('loads default theme from project', () => {
    const fixtureDir = path.join(import.meta.dirname || '.', 'fixtures-theme');
    const themeDir = path.join(fixtureDir, 'themes', 'default');
    fs.mkdirSync(themeDir, { recursive: true });
    fs.writeFileSync(path.join(themeDir, 'theme.css'), '@page { size: A4; margin: 0; } .page { width: 210mm; height: 297mm; }');
    try {
      const result = discoverTheme('default', [], fixtureDir);
      assert.equal(result.name, 'default');
      assert.ok(result.css.length > 0);
      assert.ok(result.pdfSize.format || result.pdfSize.width);
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
});
