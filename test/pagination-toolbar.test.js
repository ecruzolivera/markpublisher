import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generatePaginationToolbar } from '../src/html/pagination-toolbar.js';

describe('pagination toolbar', () => {
  it('generates toolbar with zoom controls', () => {
    const html = generatePaginationToolbar();
    assert.ok(html.includes('id="pagination-toolbar"'));
    assert.ok(html.includes('id="tb-fit-width"'));
    assert.ok(html.includes('id="tb-fit-page"'));
    assert.ok(html.includes('id="tb-zoom-out"'));
    assert.ok(html.includes('id="tb-zoom-slider"'));
    assert.ok(html.includes('id="tb-zoom-in"'));
  });

  it('generates toolbar with spread controls', () => {
    const html = generatePaginationToolbar();
    assert.ok(html.includes('id="tb-spread-single"'));
    assert.ok(html.includes('id="tb-spread-facing"'));
  });

  it('generates toolbar with settings controls', () => {
    const html = generatePaginationToolbar();
    assert.ok(html.includes('id="tb-col-gap"'));
    assert.ok(html.includes('id="tb-row-gap"'));
    assert.ok(html.includes('id="tb-shadows"'));
    assert.ok(html.includes('id="tb-start-right"'));
  });

  it('generates toolbar with navigation controls', () => {
    const html = generatePaginationToolbar();
    assert.ok(html.includes('id="tb-prev"'));
    assert.ok(html.includes('id="tb-next"'));
    assert.ok(html.includes('id="tb-page-input"'));
    assert.ok(html.includes('id="tb-page-count"'));
  });

  it('generates inline client-side controller script', () => {
    const html = generatePaginationToolbar();
    assert.ok(html.includes('<script>'));
    assert.ok(html.includes('fit-width'));
    assert.ok(html.includes('IntersectionObserver'));
    assert.ok(html.includes('scrollIntoView'));
  });

  it('generates accessible toolbar with roles', () => {
    const html = generatePaginationToolbar();
    assert.ok(html.includes('role="toolbar"'));
    assert.ok(html.includes('aria-label="Zoom"'));
    assert.ok(html.includes('aria-label="Spread"'));
    assert.ok(html.includes('aria-label="Navigation"'));
  });

  it('toolbar HTML contains toolbar before its own controller script', () => {
    const html = generatePaginationToolbar();
    const toolbarPos = html.indexOf('id="pagination-toolbar"');
    const scriptPos = html.indexOf('<script>');
    assert.ok(toolbarPos < scriptPos, 'toolbar div should appear before its controller <script>');
  });

});
