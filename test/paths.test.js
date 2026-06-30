import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { resolveInclude, resolveWikiInclude, resolveImage, normalizePath } from '../src/paths/resolver.js';

const TEST_DIR = path.join(import.meta.dirname || '.', 'path-fixtures');

function cleanup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

describe('path resolver', () => {
  it('resolves include relative to source', () => {
    const result = resolveInclude('chapter1', '/book/volume.md');
    assert.ok(result.endsWith(path.normalize('/book/chapter1.md')));
  });

  it('appends .md if no extension', () => {
    const result = resolveInclude('chapter1', '/book/volume.md');
    assert.ok(result.endsWith('.md'));
  });

  it('keeps extension if provided', () => {
    const result = resolveInclude('data.json', '/book/volume.md');
    assert.ok(result.endsWith('.json'));
  });

  it('normalizes path separators', () => {
    const result = normalizePath('/foo\\bar/baz');
    assert.ok(!result.includes('\\'));
  });

  it('resolves image paths relative to source', () => {
    const result = resolveImage('img/photo.jpg', '/book/chapter.md');
    assert.ok(result.endsWith('/book/img/photo.jpg'));
  });

  it('resolveWikiInclude resolves from project root when file exists there', () => {
    cleanup();
    fs.mkdirSync(path.join(TEST_DIR, 'partials'), { recursive: true });
    fs.mkdirSync(path.join(TEST_DIR, 'chapters'), { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, 'partials', 'glossary.md'), 'glossary content');

    const result = resolveWikiInclude(
      'partials/glossary',
      TEST_DIR,
      path.join(TEST_DIR, 'chapters', 'chapter.md')
    );

    assert.ok(result.endsWith(`${path.sep}partials${path.sep}glossary.md`));
    cleanup();
  });

  it('resolveWikiInclude falls back to source-relative when not at project root', () => {
    cleanup();
    fs.mkdirSync(path.join(TEST_DIR, 'chapters'), { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, 'chapters', 'local.md'), 'local content');

    const result = resolveWikiInclude(
      'local',
      TEST_DIR,
      path.join(TEST_DIR, 'chapters', 'chapter.md')
    );

    assert.ok(result.endsWith(`${path.sep}chapters${path.sep}local.md`));
    cleanup();
  });

  it('resolveWikiInclude without projectRoot behaves like resolveInclude', () => {
    const result = resolveWikiInclude('chapter1', undefined, '/book/volume.md');
    assert.ok(result.endsWith(path.normalize('/book/chapter1.md')));
  });

  it('resolveWikiInclude does not duplicate extension', () => {
    cleanup();
    fs.mkdirSync(path.join(TEST_DIR, 'chapters'), { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, 'chapters', 'foo.md'), 'content');

    const result = resolveWikiInclude('chapters/foo.md', TEST_DIR, '/irrelevant');
    assert.ok(result.endsWith(`${path.sep}chapters${path.sep}foo.md`));
    assert.ok(!result.endsWith('.md.md'));
    cleanup();
  });

  it('resolveInclude appends .md for dotted stems', () => {
    const result = resolveInclude('02.1-reusable partials', '/book/volume.md');
    assert.ok(result.endsWith(path.normalize('/book/02.1-reusable partials.md')));
  });

  it('resolveWikiInclude resolves dotted stems from project root', () => {
    cleanup();
    fs.mkdirSync(path.join(TEST_DIR, 'chapters'), { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, 'chapters', '02.1-reusable partials.md'), 'content');

    const result = resolveWikiInclude(
      'chapters/02.1-reusable partials',
      TEST_DIR,
      path.join(TEST_DIR, 'chapters', 'chapter.md'),
    );

    assert.ok(result.endsWith(`${path.sep}chapters${path.sep}02.1-reusable partials.md`));
    cleanup();
  });
});
