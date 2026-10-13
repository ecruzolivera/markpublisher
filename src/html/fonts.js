import postcss from 'postcss';
import puppeteer from 'puppeteer';
import { pathToFileURL } from 'node:url';

function normalizeFamily(value) {
  return String(value || '').trim().toLowerCase().replace(/^['"]|['"]$/g, '').replace(/\s+/g, ' ');
}

function normalizeWeight(value) {
  const v = String(value || 'normal').trim().toLowerCase().replace(/\s+/g, ' ');
  if (v === 'normal') return '400';
  if (v === 'bold') return '700';
  return v;
}

function normalizeStyle(value) {
  const v = String(value || 'normal').trim().toLowerCase();
  if (v.startsWith('oblique')) return 'oblique';
  if (v === 'italic') return 'italic';
  return 'normal';
}

function faceKey(face) {
  return `${normalizeFamily(face.family)}|${normalizeWeight(face.weight)}|${normalizeStyle(face.style)}`;
}

function readFontFace(rule) {
  let family = '';
  let weight = 'normal';
  let style = 'normal';
  rule.walkDecls(declaration => {
    if (declaration.prop === 'font-family') family = declaration.value;
    else if (declaration.prop === 'font-weight') weight = declaration.value;
    else if (declaration.prop === 'font-style') style = declaration.value;
  });
  return { family: normalizeFamily(family), weight: normalizeWeight(weight), style: normalizeStyle(style) };
}

// At-rules whose contents only apply under conditions the detection render may
// not reproduce (viewport size, feature support, container size).
const CONDITIONAL_AT_RULES = new Set(['media', 'supports', 'container', 'starting-style']);

// Pseudo-classes that only apply on interaction, which a passive detection
// render never triggers.
const INTERACTIVE_PSEUDO = /:(hover|focus|focus-within|focus-visible|active|target|checked|disabled|enabled)\b/i;

function inConditionalContext(declaration) {
  let parent = declaration.parent;
  while (parent && parent.type !== 'root') {
    if (parent.type === 'atrule' && (CONDITIONAL_AT_RULES.has(parent.name.toLowerCase()) || /(?:^|-)keyframes$/i.test(parent.name))) return true;
    if (parent.type === 'rule' && INTERACTIVE_PSEUDO.test(parent.selector || '')) return true;
    parent = parent.parent;
  }
  return false;
}

// Passive renders cannot establish every family/weight/style that may be used
// through inheritance, variables or a different viewport/interaction. Keep all
// faces in these cases instead of guessing family names from CSS tokens.
function hasDynamicFontSelection(root) {
  let dynamic = false;
  root.walkDecls(declaration => {
    const property = declaration.prop.toLowerCase();
    const fontProperty = property === 'font' || property.startsWith('font-') || property === 'all';
    const variableProperty = property.startsWith('--');
    if (!fontProperty && !variableProperty) return;
    if (inConditionalContext(declaration)
      || (fontProperty && /\b(?:var|env|attr)\s*\(/i.test(declaration.value))) {
      dynamic = true;
      return false;
    }
  });
  return dynamic;
}

export function hasFontFaces(css) {
  let found = false;
  postcss.parse(css).walkAtRules('font-face', () => { found = true; return false; });
  return found;
}

// Renders the self-contained HTML in a headless browser and reports which
// @font-face rules actually loaded (browsers only load fonts that are used).
// Faces are collected at both screen and print media so print-only fonts survive.
export async function detectUsedFontFaces(htmlPath) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0', timeout: 30000 });

    const collect = () => page.evaluate(async () => {
      await document.fonts.ready;
      await window.__allImagesLoaded;
      await window.__tocReady;
      return Array.from(document.fonts).map(face => ({
        family: face.family,
        weight: face.weight,
        style: face.style,
        status: face.status,
      }));
    });

    const screen = await collect();
    await page.emulateMediaType('print');
    const print = await collect();

    return { screen, print };
  } finally {
    await browser.close();
  }
}

// Removes @font-face rules the browser reported as never loaded. Faces are
// index-aligned with document.fonts (CSS rule order) so unicode-range subsets
// — which share family/weight/style — are trimmed individually. This precise
// path is only safe when every @font-face rule is top-level and both media
// reported the same face count; otherwise the rules are kept intact, since
// media-dependent @font-face registration makes index alignment unreliable.
export function trimUnusedFontFaces(css, screenFaces = [], printFaces = []) {
  const root = postcss.parse(css);
  const rules = [];
  root.walkAtRules('font-face', rule => rules.push(rule));
  if (rules.length === 0) return { css, removed: 0, kept: 0 };

  const flat = rules.every(rule => rule.parent.type === 'root');
  const countsMatch = screenFaces.length === rules.length && printFaces.length === rules.length;
  if (!flat || !countsMatch || hasDynamicFontSelection(root)) {
    return { css, removed: 0, kept: rules.length };
  }

  let removed = 0;
  let kept = 0;
  rules.forEach((rule, index) => {
    const descriptor = readFontFace(rule);
    const target = faceKey(descriptor);
    let matched = 0;
    let loaded = 0;
    for (const faces of [screenFaces, printFaces]) {
      const face = faces[index];
      if (face && faceKey(face) === target) {
        matched++;
        if (face.status === 'loaded') loaded++;
      }
    }
    if (matched === 2 && loaded === 0) {
      rule.remove();
      removed++;
    } else {
      kept++;
    }
  });

  return { css: root.toString(), removed, kept };
}
