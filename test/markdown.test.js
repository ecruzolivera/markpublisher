import { describe, it } from 'node:test';
import assert from 'node:assert';
import { renderMarkdown } from '../src/renderer/markdown.js';

describe('markdown-it renderer', () => {
  it('renders basic markdown', () => {
    const html = renderMarkdown('# Hello\n\nWorld');
    assert.ok(html.includes('<h1') && html.includes('Hello</h1>'));
    assert.ok(html.includes('<p>World</p>'));
  });

  it('renders footnotes', () => {
    const html = renderMarkdown('text[^1]\n\n[^1]: footnote');
    assert.ok(html.includes('footnote'));
  });

  it('renders definition lists', () => {
    const html = renderMarkdown('Term\n: Definition');
    assert.ok(html.includes('<dl>'));
    assert.ok(html.includes('<dd>'));
  });

  it('renders abbreviations', () => {
    const html = renderMarkdown('*[HTML]: HyperText Markup Language\n\nHTML');
    assert.ok(html.includes('<abbr'));
  });

  it('renders subscript and superscript', () => {
    const html = renderMarkdown('H~2~O and x^2^');
    assert.ok(html.includes('<sub>'));
    assert.ok(html.includes('<sup>'));
  });

  it('renders attributes', () => {
    const html = renderMarkdown('text {.myclass}');
    assert.ok(html.includes('myclass'));
  });

  it('renders tables', () => {
    const html = renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |');
    assert.ok(html.includes('<table>'));
  });

  it('generates heading ids', () => {
    const html = renderMarkdown('# Hello World');
    assert.ok(html.includes('id="hello-world"'));
  });

  it('generates unique ids for duplicate headings', () => {
    const html = renderMarkdown('# Test\n# Test');
    assert.ok(html.includes('id="test"'));
    assert.ok(html.includes('id="test-1"'));
  });
});
