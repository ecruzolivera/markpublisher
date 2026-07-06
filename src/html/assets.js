import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function createAssetBundler({ outputDir, warnings, fetchImpl = globalThis.fetch }) {
  const assetsDir = path.join(outputDir, 'assets');
  const sourceToAsset = new Map();
  const assetToSource = new Map();
  let assetsDirCreated = false;

  return {
    async bundleHtml(html) {
      return await replaceAsync(html, /<img\b([^>]*?)\ssrc="([^"]+)"([^>]*)>/gi, async (fullMatch, beforeSrc, src, afterSrc) => {
        const bundled = await bundleReference(src, null);
        if (!bundled) {
          return fullMatch;
        }

        return `<img${beforeSrc} src="${bundled}"${afterSrc}>`;
      });
    },

    async bundleCss(cssText, baseSource) {
      let bundledCss = await expandCssImports(cssText, baseSource);
      bundledCss = await replaceAsync(bundledCss, /url\(([^)]+)\)/gi, async (fullMatch, rawUrl) => {
        const cleaned = stripCssUrl(rawUrl);
        if (!cleaned || isDataOrAnchor(cleaned) || isBundledAssetPath(cleaned)) {
          return fullMatch;
        }

        const bundled = await bundleReference(cleaned, baseSource);
        if (!bundled) {
          return fullMatch;
        }

        return `url("${bundled}")`;
      });

      return bundledCss;
    },

    writeBundledCss(cssText, fileName = 'theme.css') {
      ensureAssetsDir();
      const cssPath = path.join(assetsDir, fileName);
      const rewrittenCss = cssText.replace(/url\("assets\//g, 'url("');
      fs.writeFileSync(cssPath, rewrittenCss);
      return `assets/${fileName}`;
    },
  };

  async function expandCssImports(cssText, baseSource) {
    return await replaceAsync(cssText, /@import\s+(?:url\(([^)]+)\)|"([^"]+)"|'([^']+)')\s*([^;]*);/gi, async (fullMatch, urlValue, doubleQuoted, singleQuoted, trailing) => {
      const reference = stripCssUrl(urlValue ?? doubleQuoted ?? singleQuoted ?? '');
      if (!reference || isDataOrAnchor(reference)) {
        return fullMatch;
      }

      const resolved = resolveReference(reference, baseSource);
      if (!resolved) {
        warnings.push(`Unable to resolve CSS import: ${reference}`);
        return fullMatch;
      }

      const importedCss = await loadTextResource(resolved);
      if (importedCss == null) {
        return fullMatch;
      }

      const nested = await expandCssImports(importedCss, resolved);
      const rewritten = await replaceAsync(nested, /url\(([^)]+)\)/gi, async (innerFull, innerRawUrl) => {
        const cleaned = stripCssUrl(innerRawUrl);
        if (!cleaned || isDataOrAnchor(cleaned) || isBundledAssetPath(cleaned)) {
          return innerFull;
        }

        const bundled = await bundleReference(cleaned, resolved);
        if (!bundled) {
          return innerFull;
        }

        return `url("${bundled}")`;
      });

      return `${rewritten}${trailing ? ` ${trailing.trim()}` : ''}`;
    });
  }

  async function bundleReference(reference, baseSource) {
    const resolved = resolveReference(reference, baseSource);
    if (!resolved) {
      warnings.push(`Unable to resolve asset reference: ${reference}`);
      return null;
    }

    if (resolved.type === 'local') {
      if (!fs.existsSync(resolved.path)) {
        warnings.push(`Missing asset: ${resolved.path}`);
        return null;
      }
      return copyLocalAsset(resolved.path);
    }

    return await downloadRemoteAsset(resolved.url);
  }

  function copyLocalAsset(sourcePath) {
    const normalizedPath = path.normalize(sourcePath);
    if (sourceToAsset.has(normalizedPath)) {
      return sourceToAsset.get(normalizedPath);
    }

    ensureAssetsDir();

    const parsed = path.parse(normalizedPath);
    const fileName = allocateFileName(parsed.base || 'asset', normalizedPath);
    const destinationPath = path.join(assetsDir, fileName);
    fs.copyFileSync(normalizedPath, destinationPath);

    const relativePath = `assets/${fileName}`;
    sourceToAsset.set(normalizedPath, relativePath);
    return relativePath;
  }

  async function downloadRemoteAsset(url) {
    if (sourceToAsset.has(url)) {
      return sourceToAsset.get(url);
    }

    if (typeof fetchImpl !== 'function') {
      warnings.push(`Cannot download remote asset without fetch support: ${url}`);
      return null;
    }

    ensureAssetsDir();

    let response;
    try {
      response = await fetchImpl(url);
    } catch (error) {
      warnings.push(`Failed to download remote asset: ${url} (${error.message})`);
      return null;
    }

    if (!response.ok) {
      warnings.push(`Failed to download remote asset: ${url} (HTTP ${response.status})`);
      return null;
    }

    const fileName = allocateRemoteFileName(url, response.headers.get('content-type'));
    const destinationPath = path.join(assetsDir, fileName);
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(destinationPath, Buffer.from(arrayBuffer));

    const relativePath = `assets/${fileName}`;
    sourceToAsset.set(url, relativePath);
    return relativePath;
  }

  async function loadTextResource(source) {
    if (source.type === 'local') {
      if (!fs.existsSync(source.path)) {
        warnings.push(`Missing CSS import: ${source.path}`);
        return null;
      }

      return fs.readFileSync(source.path, 'utf-8');
    }

    if (typeof fetchImpl !== 'function') {
      warnings.push(`Cannot download remote stylesheet without fetch support: ${source.url}`);
      return null;
    }

    let response;
    try {
      response = await fetchImpl(source.url);
    } catch (error) {
      warnings.push(`Failed to download remote stylesheet: ${source.url} (${error.message})`);
      return null;
    }

    if (!response.ok) {
      warnings.push(`Failed to download remote stylesheet: ${source.url} (HTTP ${response.status})`);
      return null;
    }

    return await response.text();
  }

  function allocateFileName(baseName, sourceKey) {
    const parsed = path.parse(baseName);
    let fileName = parsed.base || 'asset';
    if (!assetToSource.has(fileName)) {
      assetToSource.set(fileName, sourceKey);
      return fileName;
    }

    if (assetToSource.get(fileName) === sourceKey) {
      return fileName;
    }

    const hash = crypto.createHash('sha1').update(sourceKey).digest('hex').slice(0, 8);
    fileName = `${parsed.name || 'asset'}-${hash}${parsed.ext}`;
    assetToSource.set(fileName, sourceKey);
    return fileName;
  }

  function allocateRemoteFileName(url, contentType) {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname || '/asset';
    const parsed = path.parse(pathname);
    const hasUsefulName = parsed.base && parsed.base !== '/';
    const fallbackExt = extensionFromContentType(contentType);
    const ext = parsed.ext || fallbackExt;
    const name = parsed.name || 'remote-asset';
    return allocateFileName(`${name}${ext}`, url);
  }

  function ensureAssetsDir() {
    if (assetsDirCreated) return;
    fs.mkdirSync(assetsDir, { recursive: true });
    assetsDirCreated = true;
  }
}

function resolveReference(reference, baseSource) {
  if (isRemoteUrl(reference)) {
    return { type: 'remote', url: reference };
  }

  if (baseSource?.type === 'remote') {
    return {
      type: 'remote',
      url: new URL(reference, baseSource.url).href,
    };
  }

  const decodedReference = tryDecodeUri(reference);

  if (path.isAbsolute(decodedReference)) {
    return { type: 'local', path: path.normalize(decodedReference) };
  }

  if (!baseSource) {
    return null;
  }

  if (baseSource.type === 'local') {
    return {
      type: 'local',
      path: path.normalize(path.resolve(path.dirname(baseSource.path), decodedReference)),
    };
  }

  return null;
}

function tryDecodeUri(value) {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

function stripCssUrl(rawValue) {
  return String(rawValue).trim().replace(/^['"]|['"]$/g, '').trim();
}

function isRemoteUrl(value) {
  return /^(?:https?:)?\/\//i.test(value);
}

function isDataOrAnchor(value) {
  return value.startsWith('data:') || value.startsWith('#');
}

function isBundledAssetPath(value) {
  return value.startsWith('assets/');
}

function toCssAssetPath(bundledPath) {
  return bundledPath.replace(/^assets\//, '');
}

function extensionFromContentType(contentType) {
  const normalized = (contentType || '').split(';')[0].trim().toLowerCase();
  const map = {
    'text/css': '.css',
    'image/svg+xml': '.svg',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'font/woff': '.woff',
    'font/woff2': '.woff2',
    'font/ttf': '.ttf',
    'application/font-woff': '.woff',
    'application/font-woff2': '.woff2',
    'application/octet-stream': '',
  };
  return map[normalized] ?? '';
}

async function replaceAsync(input, regex, replacer) {
  const matches = [];
  input.replace(regex, (...args) => {
    matches.push(args);
    return args[0];
  });

  if (matches.length === 0) {
    return input;
  }

  const replacements = await Promise.all(matches.map(args => replacer(...args)));
  let index = 0;
  return input.replace(regex, () => replacements[index++]);
}
