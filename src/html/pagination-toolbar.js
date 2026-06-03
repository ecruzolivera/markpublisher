import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toolbarHtml = fs.readFileSync(path.join(__dirname, 'pagination-toolbar.html'), 'utf-8');
const toolbarScript = fs.readFileSync(path.join(__dirname, 'pagination-toolbar-script.js'), 'utf-8');

export function generatePaginationToolbar() {
  return toolbarHtml + '\n<script>\n' + toolbarScript + '\n</script>';
}
