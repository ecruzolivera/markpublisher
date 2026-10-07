import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const execute = promisify(execFile);

it('packs required runtime files and smoke-tests both bins and preview', { timeout: 30000 }, async t => {
  const root = path.resolve(import.meta.dirname, '..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markpublisher-package-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const packed = await execute('npm', ['pack', '--json', '--pack-destination', dir], { cwd: root });
  const [metadata] = JSON.parse(packed.stdout);
  const names = metadata.files.map(file => file.path);
  for (const file of ['src/cli.js', 'src/html/toc-script.js', 'src/html/pagination-toolbar.html', 'src/html/pagination-toolbar-script.js',
    'src/html/image-wait-script.js', 'src/html/sse-reload-script.js', 'samples/sample-book/book.md', 'samples/sample-book/.marksman.toml']) {
    assert.ok(names.includes(file), `${file} must be packed`);
  }
  assert.equal(names.some(file => file.startsWith('samples/sample-book/output/')), false);
  await execute('tar', ['-xzf', path.join(dir, metadata.filename), '-C', dir]);
  const extracted = path.join(dir, 'package');
  // Runtime dependencies are already installed by npm ci. Link that exact
  // set to exercise the packed source without a second network installation.
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(extracted, 'node_modules'), 'dir');
  const pkg = JSON.parse(fs.readFileSync(path.join(extracted, 'package.json'), 'utf8'));
  assert.equal(pkg.main, undefined);
  for (const bin of Object.keys(pkg.bin)) fs.symlinkSync(path.join(extracted, pkg.bin[bin]), path.join(dir, bin));
  const created = path.join(dir, 'created');
  await execute(process.execPath, [path.join(dir, 'create-markpublisher-book'), created]);
  assert.ok(fs.existsSync(path.join(created, '.marksman.toml')));
  assert.ok(fs.existsSync(path.join(created, 'themes/default/theme.css')));
  const offline = path.join(dir, 'offline');
  fs.mkdirSync(path.join(offline, 'themes/default'), { recursive: true });
  fs.writeFileSync(path.join(offline, 'themes/default/theme.css'), '.page { width:210mm; height:297mm }');
  fs.writeFileSync(path.join(offline, 'book.md'), '# Packed book');
  fs.writeFileSync(path.join(offline, 'markpublisher.toml'), '[output]\npdf = false');
  const built = await execute(process.execPath, [path.join(dir, 'markpublisher'), 'build'], { cwd: offline });
  assert.match(built.stdout, /Done\./);
  assert.ok(fs.existsSync(path.join(offline, 'output/output.html')));
  const { startPreviewServer } = await import(pathToFileURL(path.join(extracted, 'src/commands/serve.js')).href);
  const server = await startPreviewServer({ cwd: offline, portOverride: 0 });
  t.after(() => server.close());
  assert.match(await fetch(server.url).then(r => r.text()), /Packed book<\/h1>/);
});
