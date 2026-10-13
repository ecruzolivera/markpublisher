import path from 'node:path';
import { processCss } from './css.js';
import { createResourceLoader, resolveReference, sourceKey } from './resources.js';
import { mapHtmlTagsAsync, getAttribute, setAttribute } from './tags.js';

const MIME_BY_EXT = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.jfif': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.apng': 'image/apng',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.css': 'text/css',
};

// Headers that give no useful type information and should defer to the extension.
const GENERIC_CONTENT_TYPES = new Set(['', 'application/octet-stream', 'text/plain']);

function mimeFromSource(source, contentType) {
  const fromHeader = (contentType || '').split(';')[0].trim().toLowerCase();
  const ext = path.extname(source.type === 'local' ? source.path : new URL(source.url).pathname).toLowerCase();
  const fromExt = MIME_BY_EXT[ext];
  // A known file extension is the most reliable signal and matches the previous
  // (file-based) behavior; fall back to a meaningful header, then to octet-stream.
  if (fromExt) return fromExt;
  if (fromHeader && !GENERIC_CONTENT_TYPES.has(fromHeader)) return fromHeader;
  return 'application/octet-stream';
}

function toDataUri(buffer, mime) {
  return `data:${mime};base64,${Buffer.from(buffer).toString('base64')}`;
}

function fragmentOf(suffix) {
  if (!suffix) return '';
  const index = suffix.indexOf('#');
  return index >= 0 ? suffix.slice(index) : '';
}

export function createAssetBundler({ warnings = [], fetchImpl = globalThis.fetch, timeoutMs, concurrency }) {
  const loader = createResourceLoader({ warnings, fetchImpl, timeoutMs, concurrency });
  const sourceToAsset = new Map();

  async function bundleReference(reference, baseSource) {
    if (!reference || /^(?:data:|#)/i.test(reference)) return reference;
    const source = resolveReference(reference, baseSource);
    if (!source) {
      warnings.push(`Unable to resolve asset reference: ${reference}`);
      return null;
    }
    const key = sourceKey(source);
    if (!sourceToAsset.has(key)) {
      const pending = (async () => {
        const resource = await loader.load(source);
        if (!resource) {
          if (source.type === 'local') warnings.push(`Missing asset: ${source.path}`);
          sourceToAsset.delete(key);
          return null;
        }
        return toDataUri(resource.buffer, mimeFromSource(source, resource.contentType));
      })();
      sourceToAsset.set(key, pending);
    }
    const bundled = await sourceToAsset.get(key);
    // Preserve a fragment suffix (e.g. an SVG view reference) on the data URI;
    // query strings are dropped since they are meaningless for inlined data.
    return bundled ? bundled + fragmentOf(source.suffix) : null;
  }

  return {
    async bundleHtml(html) {
      return mapHtmlTagsAsync(html, async (tag, name) => {
        if (name !== 'img') return tag;
        const src = getAttribute(tag, 'src');
        if (src === null) return tag;
        const bundled = await bundleReference(src);
        return bundled ? setAttribute(tag, 'src', bundled) : tag;
      });
    },
    async bundleCss(css, source) {
      return processCss(css, source, {
        warnings,
        rewriteReference: bundleReference,
        async loadStylesheet(imported) {
          const resource = await loader.load(imported);
          return resource ? {
            content: resource.buffer.toString('utf8'),
            source: imported.type === 'local' ? imported : resource.source,
          } : null;
        },
      });
    },
  };
}
