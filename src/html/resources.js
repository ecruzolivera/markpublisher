import fs from 'node:fs';
import path from 'node:path';

export function resolveReference(reference, baseSource) {
  if (!reference || /^(?:data:|#)/i.test(reference)) return null;
  try {
    if (/^(?:https?:)?\/\//i.test(reference) || baseSource?.type === 'remote') {
      const url = new URL(reference, baseSource?.url || 'https://localhost/');
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      const suffix = url.hash;
      url.hash = '';
      return { type: 'remote', url: url.href, suffix };
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(reference) && !path.isAbsolute(reference)) return null;
    const [pathname] = reference.split(/(?=[?#])/, 2);
    const decoded = decodeURIComponent(pathname);
    if (!path.isAbsolute(decoded) && !baseSource) return null;
    return {
      type: 'local',
      path: path.resolve(baseSource?.path ? path.dirname(baseSource.path) : '/', decoded),
      suffix: reference.slice(pathname.length),
    };
  } catch {
    return null;
  }
}

export function sourceKey(source) {
  if (source.type === 'remote') return source.url;
  return fs.existsSync(source.path) ? fs.realpathSync(source.path) : path.resolve(source.path);
}

export function createResourceLoader({ warnings, fetchImpl = globalThis.fetch, timeoutMs = 30000, concurrency = 6 }) {
  const cache = new Map();
  const queue = [];
  let active = 0;

  async function fetchResource(source) {
    if (active >= concurrency) await new Promise(resolve => queue.push(resolve));
    else active++;
    const controller = new AbortController();
    let timer;
    try {
      const work = async () => {
        if (typeof fetchImpl !== 'function') throw new Error('fetch support is unavailable');
        const response = await fetchImpl(source.url, { signal: controller.signal });
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error(`HTTP ${response.status}`);
        }
        return {
          buffer: Buffer.from(await response.arrayBuffer()),
          contentType: response.headers.get('content-type'),
          source: { ...source, url: response.url || source.url },
        };
      };
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(`resource deadline exceeded (${timeoutMs}ms)`));
        }, timeoutMs);
      });
      return await Promise.race([work(), timeout]);
    } finally {
      clearTimeout(timer);
      const next = queue.shift();
      if (next) next();
      else active--;
    }
  }

  return {
    async load(source) {
      const key = sourceKey(source);
      if (cache.has(key)) return cache.get(key);
      const pending = (async () => {
        try {
          if (source.type === 'local') return { buffer: await fs.promises.readFile(source.path), source };
          return await fetchResource(source);
        } catch (error) {
          warnings.push(`Failed to load resource: ${key} (${error.message})`);
          cache.delete(key);
          return null;
        }
      })();
      cache.set(key, pending);
      return pending;
    },
  };
}
