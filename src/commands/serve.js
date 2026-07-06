import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config.js';
import { discoverTheme, getThemeCss } from '../themes/loader.js';
import { preprocess } from '../renderer/preprocessor.js';
import { transformPageContent, extractHeadingContext } from '../renderer/index.js';
import { buildHtmlDocument } from '../html/template.js';
import { generatePageChrome } from '../html/page-chrome.js';
import { generatePaginationToolbar } from '../html/pagination-toolbar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sseScript = fs.readFileSync(path.join(__dirname, '..', 'html', 'sse-reload-script.js'), 'utf-8');

export async function serveCommand() {
  const { config, warnings: configWarnings } = loadConfig();
  const bootId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const inputPath = config.input || 'book.md';
  const absInput = path.resolve(config._configDir || process.cwd(), inputPath);

  if (!fs.existsSync(absInput)) {
    console.error(`Input file not found: ${absInput}`);
    process.exit(1);
  }

  const port = config.serve?.port || 3000;
  const app = express();

  app.use('/files', express.static(config._configDir));

  let clients = [];

  function notifyClients() {
    clients.forEach(res => {
      res.write('data: reload\n\n');
    });
  }

  function buildHtml() {
    const warnAll = [...configWarnings];
    const result = preprocess(absInput, warnAll, config._configDir);
    if (!result.success) {
      return `<html><body><h1>Error</h1><pre>${result.errors.join('\n')}</pre></body></html>`;
    }

    const themeResult = discoverTheme(config.theme || 'default', warnAll, config._configDir);
    const themeCss = getThemeCss(themeResult);

    function rewriteImagePaths(html) {
      return html.replace(/<img\b([^>]*?)\ssrc="([^"]+)"([^>]*)>/gi, (full, before, src, after) => {
        if (!path.isAbsolute(src) || src.startsWith('/files/')) {
          return full;
        }
        const decodedSrc = (() => { try { return decodeURI(src); } catch { return src; } })();
        const relative = path.relative(config._configDir, decodedSrc);
        if (relative.startsWith('..')) {
          return full;
        }
        return `<img${before} src="/files/${relative}"${after}>`;
      });
    }

    const pages = [];
    let headingContext = null;

    for (let i = 0; i < result.pages.length; i++) {
      const pageMeta = result.pages[i];
      const content = pageMeta.lines.join('\n');

      if (content.trim() === '') {
        const isToc = pageMeta.tocPages > 0;
        pages.push({
          html: '',
          layout: pageMeta.layout,
          pageRole: isToc ? 'toc' : 'body',
          headerText: null,
          headerVisible: pageMeta.headerVisible,
          numbering: pageMeta.numbering,
          pageNumber: null,
        });
        continue;
      }

      const { html: rawHtml, warnings } = transformPageContent(content, pageMeta);
      warnAll.push(...warnings);
      const html = rewriteImagePaths(rawHtml);

      const heading = extractHeadingContext(content);
      if (heading) headingContext = heading;

      const isToc = pageMeta.tocPages > 0;
      const pageNumber = pageMeta.numbering === 'arabic'
        ? pageMeta.numberStart + pageMeta.numberCounter
        : null;

      pages.push({
        html,
        layout: pageMeta.layout,
        pageRole: isToc ? 'toc' : 'body',
        headerText: headingContext,
        headerVisible: pageMeta.headerVisible,
        numbering: pageMeta.numbering,
        pageNumber,
      });
    }

    const fullHtml = buildHtmlDocument(pages, themeCss, result.frontMatter, generatePageChrome());

    const paddingFix = `<style>@media screen { html { scroll-padding-top: calc(var(--toolbar-height) + 40px); } #pages-container { padding-top: calc(var(--toolbar-height) + 40px); } }</style>`;

    const sseHtml = '<script>\n' + sseScript + '\n</script>';

    const toolbarHtml = generatePaginationToolbar();

    return fullHtml
      .replace('</head>', paddingFix + '</head>')
      .replace('</body>', sseHtml + toolbarHtml + '</body>');
  }

  app.get('/', (req, res) => {
    res.send(buildHtml());
  });

  app.get('/live', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('retry: 1000\n');
    res.write(`event: hello\ndata: ${bootId}\n\n`);

    clients.push(res);

    req.on('close', () => {
      clients = clients.filter(c => c !== res);
    });
  });

  app.listen(port, async () => {
    console.log(`Dev server: http://localhost:${port}`);
    console.log(`Serving: ${absInput}`);

    const { default: chokidar } = await import('chokidar');

    const configDir = config._configDir || process.cwd();
    const configPath = path.join(configDir, 'markpublisher.toml');

    function getWatchPaths() {
      const result = preprocess(absInput, [], configDir);
      const { config: updatedConfig } = loadConfig();
      const themeResult = discoverTheme(updatedConfig.theme || 'default', [], configDir);

      const paths = [
        absInput,
        ...(result.includedFiles || []),
        ...(result.referencedIncludeFiles || []),
        themeResult.cssPath,
      ];

      if (fs.existsSync(configPath)) {
        paths.push(configPath);
      }

      return [...new Set(paths)];
    }

    let watchPaths = getWatchPaths();

    const watcher = chokidar.watch(watchPaths, {
      persistent: true,
      ignoreInitial: true,
    });

    function refreshWatchPaths() {
      const nextPaths = getWatchPaths();
      const current = new Set(watchPaths);
      const incoming = new Set(nextPaths);

      const toAdd = nextPaths.filter(p => !current.has(p));
      const toRemove = watchPaths.filter(p => !incoming.has(p));

      if (toAdd.length) watcher.add(toAdd);
      if (toRemove.length) watcher.unwatch(toRemove);

      watchPaths = nextPaths;
    }

    watcher.on('change', (changedPath) => {
      console.log(`File changed: ${changedPath} — reloading...`);
      refreshWatchPaths();
      notifyClients();
    });

    watcher.on('add', () => {
      refreshWatchPaths();
      notifyClients();
    });

    watcher.on('unlink', (changedPath) => {
      console.log(`File removed: ${changedPath} — reloading...`);
      refreshWatchPaths();
      notifyClients();
    });
  });
}
