import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import chokidar from 'chokidar';
import { loadConfig } from '../config.js';
import { discoverTheme } from '../themes/loader.js';
import { preprocess } from '../renderer/preprocessor.js';
import { renderDocument } from '../renderer/document.js';
import { buildHtmlDocument } from '../html/template.js';
import { generatePageChrome } from '../html/page-chrome.js';
import { createPreviewAssets } from '../html/preview-assets.js';
import { addPreviewControls } from '../html/preview.js';
import { escapeHtml } from '../html/tags.js';
import { resolveThemePath } from '../paths/resolver.js';

const sseScript = fs.readFileSync(new URL('../html/sse-reload-script.js', import.meta.url), 'utf8');
const liveHtml = `<script>\n${sseScript}\n</script>`;

export async function serveCommand() {
  const server = await startPreviewServer();
  console.log(`Dev server: ${server.url}`);
  for (const warning of server.warnings) console.warn(warning);
  const stop = async () => {
    await server.close();
    process.exitCode = 0;
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

export async function startPreviewServer({ cwd = process.cwd(), portOverride } = {}) {
  cwd = path.resolve(cwd);
  if (portOverride !== undefined && (!Number.isInteger(portOverride) || portOverride < 0 || portOverride > 65535)) {
    throw new Error('Internal port override must be an integer from 0 to 65535');
  }
  const initial = loadConfig(cwd);
  const configuredPort = initial.config.serve.port;
  const port = portOverride ?? configuredPort;
  const bootId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const clients = new Set();
  let snapshot;
  let errorHtml = null;
  let closed = false;
  let timer;
  let pending = Promise.resolve();
  let watchPaths = new Set(initial.searchedPaths);
  const parentWatchers = new Map();

  function showError(error) {
    errorHtml = `<!DOCTYPE html><html><body><h1>Preview error</h1><pre>${escapeHtml(error.message)}</pre>${liveHtml}</body></html>`;
  }

  function scheduleRebuild() {
    if (closed) return;
    clearTimeout(timer);
    timer = setTimeout(() => { pending = pending.then(rebuild).catch(showError); }, 40);
  }

  function isDependencyChange(changed) {
    if (watchPaths.has(changed)) return true;
    return [...watchPaths].some(file => {
      const relative = path.relative(changed, file);
      return relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
    });
  }

  function syncParentWatchers() {
    const directories = new Set();
    for (const file of watchPaths) {
      let directory = path.dirname(file);
      while (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
        const parent = path.dirname(directory);
        if (parent === directory) break;
        directory = parent;
      }
      directories.add(directory);
    }
    for (const directory of directories) {
      if (parentWatchers.has(directory)) continue;
      // Native parent observers have no asynchronous initial file scan. They
      // catch creations/atomic replacements while Chokidar registers files.
      const observer = fs.watch(directory, (event, filename) => {
        if (!filename || isDependencyChange(path.resolve(directory, String(filename)))) scheduleRebuild();
      });
      observer.on('error', showError);
      parentWatchers.set(directory, observer);
    }
    for (const [directory, observer] of parentWatchers) {
      if (directories.has(directory)) continue;
      observer.close();
      parentWatchers.delete(directory);
    }
  }

  async function buildSnapshot(loaded, attempted) {
    const { config, warnings } = loaded;
    loaded.searchedPaths.forEach(file => attempted.add(file));
    const input = path.resolve(config._configDir, config.input || 'book.md');
    attempted.add(input);
    if (!fs.existsSync(input)) throw Object.assign(new Error(`Input file not found: ${input}`), { exitCode: 1 });
    const result = preprocess(input, warnings, config._configDir);
    for (const file of [...(result.includedFiles || []), ...(result.referencedIncludeFiles || [])]) attempted.add(file);
    if (!result.success) throw new Error(result.errors.join('\n'));
    // Register discovery candidates before parsing: invalid global themes and
    // not-yet-created higher-priority files must remain recoverable too.
    for (const name of [config.theme, 'default']) {
      let found = false;
      for (const directory of resolveThemePath(name, config._configDir)) {
        const cssPath = path.join(directory, 'theme.css');
        attempted.add(cssPath);
        if (fs.existsSync(cssPath)) { found = true; break; }
      }
      if (found) break;
    }
    const theme = discoverTheme(config.theme, warnings, config._configDir);
    attempted.add(theme.cssPath);
    const assets = createPreviewAssets(warnings);
    let css;
    let pages;
    try {
      css = await assets.rewriteCss(theme.css, { type: 'local', path: theme.cssPath });
      pages = await renderDocument(result, html => assets.rewriteHtml(html), warnings);
    } finally {
      assets.watchPaths.forEach(file => attempted.add(file));
    }
    if (config.serve.port !== configuredPort) warnings.push(`Preview port changed to ${config.serve.port}; restart the server to apply the new port.`);
    const html = addPreviewControls(buildHtmlDocument(pages, '/theme.css', result.frontMatter, generatePageChrome()), liveHtml);
    return { html, css, assets, warnings };
  }

  snapshot = await buildSnapshot(initial, watchPaths);
  const app = express();
  app.get('/', (req, res) => res.set('Cache-Control', 'no-store').send(errorHtml || snapshot.html));
  app.get('/theme.css', (req, res) => res.set('Cache-Control', 'no-store').type('css').send(snapshot.css));
  app.get('/assets/:id/:name', (req, res) => {
    const file = snapshot.assets.files.get(req.params.id);
    if (!file || file.name !== req.params.name) return res.sendStatus(404);
    res.set('Cache-Control', 'no-store').sendFile(file.path);
  });
  app.get('/live', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`retry: 1000\nevent: hello\ndata: ${bootId}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
  });

  const watcher = chokidar.watch([...watchPaths], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 },
  });
  let http;
  try {
    syncParentWatchers();
    await new Promise((resolve, reject) => {
      watcher.once('ready', resolve);
      watcher.once('error', reject);
    });
    http = await new Promise((resolve, reject) => {
      const listener = app.listen(port, '127.0.0.1', () => resolve(listener));
      listener.once('error', reject);
    });
  } catch (error) {
    for (const observer of parentWatchers.values()) observer.close();
    await watcher.close();
    throw error;
  }

  async function rebuild() {
    if (closed) return;
    const attempted = new Set();
    try {
      const loaded = loadConfig(cwd);
      const next = await buildSnapshot(loaded, attempted);
      for (const warning of next.warnings) {
        if (!snapshot.warnings.includes(warning)) console.warn(warning);
      }
      snapshot = next;
      errorHtml = null;
    } catch (error) {
      if (error.configPath) attempted.add(error.configPath);
      watchPaths.forEach(file => attempted.add(file));
      showError(error);
    }
    if (closed) return;
    const added = [...attempted].filter(file => !watchPaths.has(file));
    const removed = [...watchPaths].filter(file => !attempted.has(file));
    watchPaths = attempted;
    syncParentWatchers();
    if (added.length) watcher.add(added);
    if (removed.length) await watcher.unwatch(removed);
    for (const client of clients) client.write('data: reload\n\n');
  }

  watcher.on('all', (event, changedPath) => {
    if (isDependencyChange(path.resolve(changedPath))) scheduleRebuild();
  });
  watcher.on('error', error => {
    showError(error);
  });
  const actualPort = http.address().port;
  let closing;
  return {
    url: `http://127.0.0.1:${actualPort}`,
    port: actualPort,
    get warnings() { return snapshot.warnings; },
    close() {
      if (closing) return closing;
      closed = true;
      clearTimeout(timer);
      for (const observer of parentWatchers.values()) observer.close();
      parentWatchers.clear();
      closing = (async () => {
        for (const client of clients) client.end();
        clients.clear();
        await watcher.close();
        await pending;
        const stopped = new Promise((resolve, reject) => http.close(error => error ? reject(error) : resolve()));
        http.closeAllConnections();
        await stopped;
      })();
      return closing;
    },
  };
}
