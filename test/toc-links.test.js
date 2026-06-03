import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generatePageChrome } from '../src/html/page-chrome.js';

describe('TOC fallback CSS', () => {
  it('contains .toc-link flex layout rules', () => {
    const css = generatePageChrome();
    assert.ok(css.includes('.toc-link'));
    assert.ok(css.includes('display: flex'));
    assert.ok(css.includes('width: 100%'));
    assert.ok(css.includes('min-width: 0'));
  });

  it('contains .toc-leader rules with border-bottom', () => {
    const css = generatePageChrome();
    assert.ok(css.includes('.toc-leader'));
    assert.ok(css.includes('flex: 1'));
    assert.ok(css.includes('min-width: 1.5em'));
    assert.ok(css.includes('border-bottom'));
  });

  it('contains .toc-text and .toc-page-num rules', () => {
    const css = generatePageChrome();
    assert.ok(css.includes('.toc-text'));
    assert.ok(css.includes('white-space: normal'));
    assert.ok(css.includes('overflow-wrap: anywhere'));
    assert.ok(css.includes('flex-shrink: 1'));
    assert.ok(css.includes('white-space: nowrap'));
    assert.ok(css.includes('.toc-page-num'));
  });

  it('TOC fallback CSS is present outside @media blocks', () => {
    const css = generatePageChrome();
    assert.ok(css.includes('.toc-link'));
    assert.ok(css.includes('.toc-leader'));
    assert.ok(css.includes('.toc-text'));
  });
});
