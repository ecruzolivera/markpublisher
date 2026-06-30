import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');

function hasExplicitExtension(p) {
  const ext = path.extname(p);
  if (!ext) return false;
  const suffix = ext.slice(1);
  return suffix.length <= 8 && /^[a-zA-Z][a-zA-Z0-9+.-]*$/.test(suffix);
}

export function resolveInclude(target, sourceFile) {
  const base = path.dirname(sourceFile);
  const resolved = path.normalize(path.resolve(base, target));
  if (hasExplicitExtension(resolved)) return resolved;
  return resolved + '.md';
}

export function resolveWikiInclude(target, projectRoot, sourceFile) {
  if (projectRoot) {
    const baseCandidate = path.normalize(path.resolve(projectRoot, target));
    if (fs.existsSync(baseCandidate)) return baseCandidate;
    if (!hasExplicitExtension(target)) {
      const mdCandidate = path.normalize(path.resolve(projectRoot, target) + '.md');
      if (fs.existsSync(mdCandidate)) return mdCandidate;
    }
  }
  return resolveInclude(target, sourceFile);
}

export function resolveImage(imagePath, sourceFile) {
  const base = path.dirname(sourceFile);
  return path.normalize(path.resolve(base, imagePath));
}

export function resolveProjectImage(imagePath, sourceFile, projectRoot) {
  if (path.isAbsolute(imagePath)) {
    return path.normalize(imagePath);
  }

  if (projectRoot) {
    const projectResolved = path.normalize(path.resolve(projectRoot, imagePath));
    if (fs.existsSync(projectResolved)) {
      return projectResolved;
    }
  }

  return resolveImage(imagePath, sourceFile);
}

export function normalizePath(p) {
  return path.normalize(p).replace(/\\/g, '/');
}

export function resolveThemePath(themeName, cwd) {
  const searchPaths = [];
  if (cwd) {
    searchPaths.push(path.join(cwd, 'themes', themeName));
  }
  searchPaths.push(path.join(process.cwd(), 'themes', themeName));
  searchPaths.push(path.join(process.env.HOME || '~', '.config', 'markpublisher', 'themes', themeName));
  return searchPaths.map(p => path.normalize(p));
}

export { projectRoot };
