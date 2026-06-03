import { describe, it } from 'node:test';
import assert from 'node:assert';
import { transformPageContent } from '../src/renderer/index.js';

describe('renderer directives', () => {
  it('image directive styles next image and preserves src/alt', () => {
    const pageContent = [
      '<!-- image: width: 80%; border: 1px solid red -->',
      '![Cover](cover.png)',
      '![Plain](plain.png)',
    ].join('\n');

    const { html } = transformPageContent(pageContent, { layout: 'twocol' });

    assert.ok(html.includes('src="cover.png"'));
    assert.ok(html.includes('alt="Cover"'));
    assert.ok(html.includes('style="width: 80%; border: 1px solid red"'));
    assert.ok(html.includes('marker="image-css"'));
    assert.ok(html.includes('src="plain.png"'));
    assert.ok(html.includes('alt="Plain"'));
  });

  it('apply-next applies class and id to next block element', () => {
    const pageContent = [
      '<!-- apply-next:.lede #intro -->',
      'Hello world',
    ].join('\n');

    const { html } = transformPageContent(pageContent, { layout: 'twocol' });
    assert.ok(html.includes('<p id="intro" class="lede">Hello world</p>'));
    assert.ok(!html.includes('<apply-next'));
    assert.ok(!html.includes('APPLY_NEXT'));
  });

  it('does not treat free-form html comments as container directives', () => {
    const pageContent = [
      '<!-- intentional white page -->',
      'After comment',
    ].join('\n');

    const { html } = transformPageContent(pageContent, { layout: 'twocol' });

    assert.ok(html.includes('After comment'));
    assert.ok(!html.includes('<div class="intentional">'));
  });
});
