import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');

export function resolveInclude(target, sourceFile) {
  const base = path.dirname(sourceFile);
  let resolved = path.resolve(base, target);
  if (!path.extname(resolved)) {
    resolved += '.md';
  }
  return path.normalize(resolved);
}

export function resolveWikiInclude(target, projectRoot, sourceFile) {
  if (projectRoot) {
    let projectResolved = path.resolve(projectRoot, target);
    if (!path.extname(projectResolved)) {
      projectResolved += '.md';
    }
    projectResolved = path.normalize(projectResolved);
    if (fs.existsSync(projectResolved)) {
      return projectResolved;
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
