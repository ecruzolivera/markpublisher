import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import { processCss } from './css.js';
import { createResourceLoader, resolveReference, sourceKey } from './resources.js';
import { mapHtmlTagsAsync, getAttribute, setAttribute } from './tags.js';

export function createAssetBundler({ outputDir, warnings = [], fetchImpl = globalThis.fetch, timeoutMs, concurrency }) {
  const assetsDir = path.join(outputDir, 'assets');
  const loader = createResourceLoader({ warnings, fetchImpl, timeoutMs, concurrency });
  const sourceToAsset = new Map();
  const assetToSource = new Map([['theme.css', 'bundled theme']]);

  function allocateFileName(base, key) {
    const parsed = path.parse(base || 'asset');
    let name = parsed.base;
    if (assetToSource.has(name) && assetToSource.get(name) !== key) {
      const hash = crypto.createHash('sha1').update(key).digest('hex').slice(0, 8);
      name = `${parsed.name}-${hash}${parsed.ext}`;
    }
    assetToSource.set(name, key);
    return name;
  }

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
        const base = source.type === 'local' ? path.basename(source.path)
          : path.basename(new URL(source.url).pathname) || 'remote-asset';
        const extension = path.extname(base) ? '' : extensionFromContentType(resource.contentType);
        const fileName = allocateFileName(base + extension, key);
        fs.mkdirSync(assetsDir, { recursive: true });
        const destination = path.join(assetsDir, fileName);
        try {
          fs.writeFileSync(destination, resource.buffer);
        } catch (error) {
          fs.rmSync(destination, { force: true });
          sourceToAsset.delete(key);
          throw error;
        }
        return `assets/${encodeURIComponent(fileName)}`;
      })();
      sourceToAsset.set(key, pending);
    }
    const bundled = await sourceToAsset.get(key);
    return bundled ? bundled + (source.suffix || '') : null;
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
    writeBundledCss(css, fileName = 'theme.css') {
      fs.mkdirSync(assetsDir, { recursive: true });
      const root = postcss.parse(css);
      root.walkDecls(declaration => {
        const parsed = valueParser(declaration.value);
        parsed.walk(node => {
          if (node.type === 'function' && node.value.toLowerCase() === 'url' && node.nodes[0]?.value.startsWith('assets/')) {
            node.nodes[0].value = node.nodes[0].value.slice(7);
          }
        });
        declaration.value = parsed.toString();
      });
      fs.writeFileSync(path.join(assetsDir, fileName), root.toString());
      return `assets/${fileName}`;
    },
  };
}

function extensionFromContentType(contentType) {
  return {
    'text/css': '.css', 'image/svg+xml': '.svg', 'image/png': '.png',
    'image/jpeg': '.jpg', 'image/webp': '.webp', 'font/woff': '.woff',
    'font/woff2': '.woff2', 'font/ttf': '.ttf', 'application/font-woff': '.woff',
    'application/font-woff2': '.woff2',
  }[(contentType || '').split(';')[0].trim().toLowerCase()] || '';
}
