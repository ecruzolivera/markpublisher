import fs from 'node:fs';
import path from 'node:path';
import { resolveThemePath } from '../paths/resolver.js';
import postcss from 'postcss';

const PAGE_SIZES = {
  A4: { width: '210mm', height: '297mm' },
  A5: { width: '148mm', height: '210mm' },
  Letter: { width: '8.5in', height: '11in' },
  Legal: { width: '8.5in', height: '14in' },
};

export function parseThemeCss(css, warnings = []) {
  const root = postcss.parse(css);
  let pageSize;
  const dimensions = {};
  root.walkAtRules(/^page$/i, rule => {
    if (rule.params) return;
    rule.walkDecls(/^size$/i, declaration => {
      if (!pageSize?.important || declaration.important) pageSize = declaration;
    });
  });
  if (pageSize) {
    const size = pageSize.value.trim();
    const [name, orientation] = size.split(/\s+/);
    const canonical = Object.keys(PAGE_SIZES).find(k => k.toLowerCase() === name.toLowerCase());
    if (canonical && (!orientation || ['landscape', 'portrait'].includes(orientation))) {
      return { format: canonical, ...(orientation === 'landscape' ? { landscape: true } : {}) };
    }
    const [width, height] = size.split(/\s+/).map(absoluteDimension);
    if (width && height) return { width, height };
    if (size !== 'auto') warnings.push(`Unsupported @page size: ${size}`);
  }
  root.walkRules(rule => {
    if (!rule.selector.split(',').some(selector => selector.trim() === '.page')) return;
    rule.nodes.forEach(declaration => {
      if (declaration.type !== 'decl') return;
      const property = declaration.prop.toLowerCase();
      if (!['width', 'height'].includes(property)) return;
      const previous = dimensions[property];
      if (!previous?.important || declaration.important) dimensions[property] = declaration;
    });
  });
  if (dimensions.width || dimensions.height) {
    const width = absoluteDimension(dimensions.width?.value);
    const height = absoluteDimension(dimensions.height?.value);
    if (width && height) return { width, height };
    warnings.push(`Unsupported .page dimensions: ${dimensions.width?.value || '(missing width)'} / ${dimensions.height?.value || '(missing height)'}`);
  }
  return { format: 'A4' };
}

function absoluteDimension(value) {
  const match = value?.trim().match(/^(\d+(?:\.\d+)?)(mm|cm|in|px|pt|pc)$/i);
  if (!match || Number(match[1]) <= 0) return null;
  const unit = match[2].toLowerCase();
  if (unit === 'pt' || unit === 'pc') return `${Number(match[1]) / (unit === 'pt' ? 72 : 6)}in`;
  return match[1] + unit;
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

  // Discovery cannot validate dimensions split across imports. The build
  // validates the expanded stylesheet before selecting PDF options.
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
