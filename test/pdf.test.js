import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { buildCommand } from '../src/commands/build.js';

it('generates a real custom-size PDF using relative bundled assets and print CSS', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markpublisher-pdf-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'themes/default'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'themes/default/theme.css'), '* { box-sizing:border-box } @page { size:6in 9in; margin:0 } .page { height:9in; padding:0; width:6in; overflow:hidden }');
  fs.writeFileSync(path.join(dir, 'cover.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>');
  fs.writeFileSync(path.join(dir, 'book.md'), '# Printed Book\n\n![Cover](cover.svg "Cover title")');
  fs.writeFileSync(path.join(dir, 'markpublisher.toml'), '[output]\nhtml = false\npdf = true');
  const built = await buildCommand({ cwd: dir });
  const pdf = await PDFDocument.load(fs.readFileSync(built.pdfPath));
  assert.equal(pdf.getPageCount(), 1);
  const size = pdf.getPage(0).getSize();
  assert.ok(Math.abs(size.width - 432) < 1);
  assert.ok(Math.abs(size.height - 648) < 1);
  assert.ok(fs.existsSync(path.join(dir, 'output/assets/cover.svg')));
  assert.equal(fs.existsSync(path.join(dir, 'output/output.html')), false);
  assert.equal(fs.readdirSync(path.join(dir, 'output')).some(name => name.startsWith('.markpublisher-')), false);
});
