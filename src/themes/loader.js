import fs from 'node:fs';
import path from 'node:path';
import { resolveThemePath } from '../paths/resolver.js';

const PAGE_SIZES = {
  A4: { width: '210mm', height: '297mm' },
  A5: { width: '148mm', height: '210mm' },
  Letter: { width: '8.5in', height: '11in' },
  Legal: { width: '8.5in', height: '14in' },
};

export function parseThemeCss(css) {
  const pageMatch = css.match(/@page\s*\{[^}]*size\s*:\s*([A-Za-z0-9]+)/);
  if (pageMatch) {
    const sizeName = pageMatch[1];
    const canonical = Object.keys(PAGE_SIZES).find(k => k.toLowerCase() === sizeName.toLowerCase());
    if (canonical) {
      return { format: canonical };
    }
  }

  const dimMatch = css.match(/\.page\s*\{[^}]*width\s*:\s*([^;]+);\s*height\s*:\s*([^;}]+)/);
  if (dimMatch) {
    return { width: dimMatch[1].trim(), height: dimMatch[2].trim() };
  }

  return { format: 'A4' };
}

export function discoverTheme(themeName, warnings = [], configDir) {
  const searchPaths = resolveThemePath(themeName, configDir);

  for (const dir of searchPaths) {
    const cssPath = path.join(dir, 'theme.css');
    if (fs.existsSync(cssPath)) {
      return loadTheme(dir, themeName, warnings);
    }
  }

  warnings.push(`Theme "${themeName}" not found, falling back to "default"`);
  const defaultPaths = resolveThemePath('default', configDir);
  for (const dir of defaultPaths) {
    const cssPath = path.join(dir, 'theme.css');
    if (fs.existsSync(cssPath)) {
      return loadTheme(dir, 'default', warnings);
    }
  }

  throw new Error('Theme not found. Please create a themes/<name>/theme.css file in your project.');
}

function loadTheme(dir, name, warnings) {
  const cssPath = path.join(dir, 'theme.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  const cssEntries = [{ path: cssPath, content: css }];

  const pdfSize = parseThemeCss(css);
  checkRemoteFonts(css, name, warnings);

  return { name, css, cssEntries, pdfSize, cssPath, dir };
}

function checkRemoteFonts(css, themeName, warnings) {
  const fontImportPattern = /@import\s+(?:url\(['"]?)?(https?:\/\/[^\s)'"]+)/gi;
  const fontFaceUrlPattern = /@font-face\s*\{[^}]*url\(['"]?(https?:\/\/[^\s)'"]+)/gi;

  let match;
  const remoteUrls = new Set();

  while ((match = fontImportPattern.exec(css)) !== null) {
    remoteUrls.add(match[1]);
  }
  while ((match = fontFaceUrlPattern.exec(css)) !== null) {
    remoteUrls.add(match[1]);
  }

  for (const url of remoteUrls) {
    warnings.push(`[theme:${themeName}] Remote font detected: ${url} — output depends on network availability`);
  }
}

export function getThemeCss(themeResult) {
  return themeResult.css;
}
