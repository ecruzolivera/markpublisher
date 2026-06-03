import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generatePageChrome } from '../src/html/page-chrome.js';

describe('page chrome generator', () => {
  it('generates screen media block with body background', () => {
    const css = generatePageChrome();
    assert.ok(css.includes('@media screen'));
    assert.ok(css.includes('background: #e8e8e8'));
  });

  it('generates print media block with resets', () => {
    const css = generatePageChrome();
    assert.ok(css.includes('@media print'));
    assert.ok(css.includes('background: transparent'));
    assert.ok(css.includes('box-shadow: none'));
  });

  it('uses CSS grid for screen layout with custom properties', () => {
    const css = generatePageChrome();
    assert.ok(css.includes('--preview-col-gap'));
    assert.ok(css.includes('--preview-row-gap'));
    assert.ok(css.includes('--preview-page-shadow'));
    assert.ok(css.includes('--toolbar-height'));
    assert.ok(css.includes('display: grid'));
  });

  it('has spread mode classes', () => {
    const css = generatePageChrome();
    assert.ok(css.includes('.spread-single'));
    assert.ok(css.includes('.spread-facing'));
    assert.ok(css.includes('grid-template-columns: auto;') || css.includes('grid-template-columns: auto auto;'));
  });

  it('does not contain typography or component selectors', () => {
    const css = generatePageChrome();
    assert.ok(!css.includes('font-family'));
    assert.ok(!css.includes('h1'));
    assert.ok(!css.includes('.note'));
    assert.ok(!css.includes('.footnotes'));
    assert.ok(!css.includes('.page-number'));
    assert.ok(!css.includes('.running-header'));
  });
});
