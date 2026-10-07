import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { processCss } from './css.js';
import { resolveReference } from './resources.js';
import { mapHtmlTags, getAttribute, setAttribute } from './tags.js';

export function createPreviewAssets(warnings) {
  const files = new Map();
  const watchPaths = new Set();

  function register(source) {
    watchPaths.add(source.path);
    if (!fs.existsSync(source.path) || !fs.statSync(source.path).isFile()) {
      warnings.push(`Missing asset: ${source.path}`);
      return null;
    }
    const canonical = fs.realpathSync(source.path);
    watchPaths.add(canonical);
    const id = crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 24);
    const name = path.basename(canonical);
    files.set(id, { path: canonical, name });
    return `/assets/${id}/${encodeURIComponent(name)}${source.suffix || ''}`;
  }

  function rewriteReference(reference, source) {
    if (!reference || /^(?:data:|#)/i.test(reference)) return reference;
    const resolved = resolveReference(reference, source);
    if (!resolved) {
      warnings.push(`Unable to resolve asset reference: ${reference}`);
      return null;
    }
    return resolved.type === 'remote' ? resolved.url + (resolved.suffix || '') : register(resolved);
  }

  return {
    files,
    watchPaths,
    rewriteHtml(html) {
      return mapHtmlTags(html, (tag, name) => {
        if (name !== 'img') return tag;
        const src = getAttribute(tag, 'src');
        if (src === null) return tag;
        const rewritten = rewriteReference(src);
        return rewritten ? setAttribute(tag, 'src', rewritten) : tag;
      });
    },
    async rewriteCss(css, source) {
      watchPaths.add(source.path);
      return processCss(css, source, {
        warnings,
        rewriteReference,
        async loadStylesheet(imported) {
          // Remote imports stay native browser imports in development.
          if (imported.type === 'remote') return null;
          watchPaths.add(imported.path);
          try {
            return { content: await fs.promises.readFile(imported.path, 'utf8'), source: imported };
          } catch (error) {
            warnings.push(`Missing CSS import: ${imported.path} (${error.message})`);
            return null;
          }
        },
      });
    },
  };
}
