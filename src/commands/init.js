import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const templateDir = path.join(projectRoot, 'samples', 'sample-book');

export async function initCommand(name) {
  if (!name) {
    console.error('Usage: markpublisher init <name>');
    process.exit(1);
  }

  const projectDir = path.resolve(name);
  if (fs.existsSync(projectDir)) {
    console.error(`Directory already exists: ${projectDir}`);
    process.exit(1);
  }

  // Copy template files, excluding sample-specific and build artifacts
  fs.cpSync(templateDir, projectDir, {
    recursive: true,
    filter: (src) => {
      const relative = path.relative(templateDir, src);
      if (relative === '') return true;
      if (relative === 'output') return false;
      return true;
    },
  });

  // Replace date in book.md front matter with today
  const bookMdPath = path.join(projectDir, 'book.md');
  if (fs.existsSync(bookMdPath)) {
    let content = fs.readFileSync(bookMdPath, 'utf-8');
    content = content.replace(/^date:.*$/m, `date: ${new Date().toISOString().split('T')[0]}`);
    fs.writeFileSync(bookMdPath, content);
  }

  console.log(`Created ${path.relative(process.cwd(), projectDir)}/`);
  console.log(`  book.md`);
  console.log(`  markpublisher.toml`);
  console.log(`  chapters/\n  partials/\n  images/`);
  console.log('');
  console.log(`Next steps:`);
  console.log(`  cd ${name}`);
  console.log(`  markpublisher serve`);
}
