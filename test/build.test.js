import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildCommand } from '../src/commands/build.js';

function fixture(t, output = 'html = false\npdf = true') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markpublisher-build-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'themes/default'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'output'));
  fs.writeFileSync(path.join(dir, 'themes/default/theme.css'), '.page { height:9in; padding:0; width:6in }');
  fs.writeFileSync(path.join(dir, 'book.md'), '# Book');
  fs.writeFileSync(path.join(dir, 'markpublisher.toml'), `[output]\n${output}`);
  return dir;
}

describe('build output safety', () => {
  for (const fail of [false, true]) {
    it(`preserves previous HTML and cleans temporary input after PDF ${fail ? 'failure' : 'success'}`, async t => {
      const dir = fixture(t);
      const previous = path.join(dir, 'output/output.html');
      fs.writeFileSync(previous, 'sentinel HTML');
      let temporary;
      const execute = () => buildCommand({ cwd: dir, pdfGenerator: async (input, size, pdfPath) => {
        temporary = input;
        assert.notEqual(input, previous);
        assert.equal(path.dirname(input), path.dirname(previous));
        assert.match(fs.readFileSync(input, 'utf8'), /assets\/theme.css/);
        assert.deepEqual(size, { width: '6in', height: '9in' });
        if (fail) throw new Error('injected PDF failure');
        fs.writeFileSync(pdfPath, 'test PDF');
      } });
      if (fail) await assert.rejects(execute, /injected PDF failure/);
      else {
        const result = await execute();
        assert.ok(fs.existsSync(result.pdfPath));
      }
      assert.equal(fs.readFileSync(previous, 'utf8'), 'sentinel HTML');
      assert.equal(fs.existsSync(temporary), false);
      assert.deepEqual(fs.readdirSync(path.join(dir, 'output')).filter(name => name.startsWith('.markpublisher-')), []);
    });
  }

  it('supports HTML-only and combined output configurations', async t => {
    for (const pdf of [false, true]) {
      const dir = fixture(t, `html = true\npdf = ${pdf}`);
      let called = false;
      const result = await buildCommand({ cwd: dir, pdfGenerator: async (input, _, output) => {
        called = true;
        assert.equal(input, path.join(dir, 'output/output.html'));
        fs.writeFileSync(output, 'test PDF');
      } });
      assert.ok(fs.existsSync(result.htmlPath));
      assert.equal(called, pdf);
    }
  });

  it('validates dimensions after expanding imports in strict builds', async t => {
    const dir = fixture(t, 'html = true\npdf = false');
    fs.writeFileSync(path.join(dir, 'themes/default/base.css'), '.page { height:9in }');
    fs.writeFileSync(path.join(dir, 'themes/default/theme.css'), '@import "base.css"; .page { width:6in }');
    fs.appendFileSync(path.join(dir, 'markpublisher.toml'), '\n[build]\nfailOnWarning = true');
    const result = await buildCommand({ cwd: dir });
    assert.deepEqual(result.warnings, []);
    assert.ok(fs.existsSync(result.htmlPath));
  });
});
