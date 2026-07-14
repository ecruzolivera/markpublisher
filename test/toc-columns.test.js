import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import { buildHtmlDocument } from '../src/html/template.js';
import { generatePageChrome } from '../src/html/page-chrome.js';

const headings = Array.from({ length: 30 }, (_, index) => `Section ${String(index + 1).padStart(2, '0')}`);

function page(html, pageRole) {
  return {
    html,
    layout: 'singlecol',
    pageRole,
    headerText: null,
    headerVisible: false,
    numbering: 'none',
    pageNumber: null,
  };
}

function createFixture({ columns, tocPages, direction = 'ltr', scale = 1 }) {
  const tocHtml = Array.from({ length: tocPages }, (_, index) => {
    const title = index === 0 ? '<div class="wide"><h2>Table of contents</h2></div>' : '';
    return page(`${title}<nav class="toc-placeholder"></nav>`, 'toc');
  });
  const bodyHtml = headings.map((heading, index) => (
    page(`<h1 id="section-${index + 1}">${heading}</h1>`, 'body')
  ));
  const themeCss = `
    * { box-sizing: border-box; }
    body { margin: 0; font: 12px/1.2 Arial, sans-serif; }
    .page {
      width: 240px;
      height: 180px;
      padding: 12px;
      position: relative;
      overflow: hidden;
      column-gap: 12px;
      transform: scale(${scale});
      transform-origin: top left;
    }
    .page.toc { column-count: ${columns}; column-fill: auto; direction: ${direction}; }
    .page.body { column-count: 1; }
    .wide { column-span: all; }
    h1, h2 { font: inherit; font-weight: bold; margin: 0 0 8px; }
    .page-number { display: none; }
    .toc-list { list-style: none; margin: 0; padding: 0; }
    .toc-entry { height: 18px; margin: 0; }
  `;

  return buildHtmlDocument([...tocHtml, ...bodyHtml], themeCss, {}, generatePageChrome());
}

async function renderFixture(browser, options) {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markpublisher-toc-columns-'));
  const htmlPath = path.join(fixtureDir, 'toc.html');
  fs.writeFileSync(htmlPath, createFixture(options));

  const browserPage = await browser.newPage();
  await browserPage.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
  await browserPage.evaluate(async () => {
    await window.__tocReady;
  });

  return { browserPage, fixtureDir };
}

async function readTocLayout(browserPage) {
  return browserPage.evaluate(() => {
    function contentBounds(page) {
      const style = getComputedStyle(page);
      const rect = page.getBoundingClientRect();
      const scaleX = page.offsetWidth ? rect.width / page.offsetWidth : 1;
      const scaleY = page.offsetHeight ? rect.height / page.offsetHeight : 1;
      return {
        left: rect.left + (parseFloat(style.paddingLeft) || 0) * scaleX,
        right: rect.right - (parseFloat(style.paddingRight) || 0) * scaleX,
        bottom: rect.bottom - (parseFloat(style.paddingBottom) || 0) * scaleY,
        scaleY,
      };
    }

    return Array.from(document.querySelectorAll('.toc-placeholder')).map((placeholder) => {
      const page = placeholder.closest('.page');
      return {
        bounds: contentBounds(page),
        entries: Array.from(placeholder.querySelectorAll('.toc-entry')).map((entry) => {
          const rect = entry.getBoundingClientRect();
          return {
            text: entry.querySelector('.toc-text').textContent,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
          };
        }),
      };
    });
  });
}

async function overflowWarningCount(browserPage) {
  return browserPage.evaluate(() => document.querySelectorAll('.toc-overflow-warning').length);
}

function assertEntriesFit(layout) {
  const epsilon = 0.5;
  const verticalSafetyGap = 2;
  for (const { bounds, entries } of layout) {
    for (const entry of entries) {
      assert.ok(entry.left >= bounds.left - epsilon, `${entry.text} extends past the left content edge`);
      assert.ok(entry.right <= bounds.right + epsilon, `${entry.text} extends past the right content edge`);
      assert.ok(entry.bottom + verticalSafetyGap * bounds.scaleY <= bounds.bottom, `${entry.text} extends below the content edge`);
    }
  }
}

describe('multi-column TOC pagination', () => {
  it('moves LTR overflow onto later TOC pages without hiding entries', async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    let fixture;
    try {
      fixture = await renderFixture(browser, { columns: 2, tocPages: 4, scale: 0.75 });
      const layout = await readTocLayout(fixture.browserPage);
      const rendered = layout.flatMap(({ entries }) => entries.map(({ text }) => text));

      assert.ok(layout[0].entries.length > 0);
      assert.ok(layout[1].entries.length > 0);
      assert.ok(layout[2].entries.length > 0);
      assert.deepEqual(rendered, headings);
      assertEntriesFit(layout);
      assert.equal(await overflowWarningCount(fixture.browserPage), 0);
    } finally {
      if (fixture) {
        await fixture.browserPage.close();
        fs.rmSync(fixture.fixtureDir, { recursive: true, force: true });
      }
      await browser.close();
    }
  });

  it('uses both content edges for RTL multi-column TOCs', async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    let fixture;
    try {
      fixture = await renderFixture(browser, { columns: 2, tocPages: 4, direction: 'rtl' });
      const layout = await readTocLayout(fixture.browserPage);
      const rendered = layout.flatMap(({ entries }) => entries.map(({ text }) => text));

      assert.ok(layout[2].entries.length > 0);
      assert.deepEqual(rendered, headings);
      assertEntriesFit(layout);
    } finally {
      if (fixture) {
        await fixture.browserPage.close();
        fs.rmSync(fixture.fixtureDir, { recursive: true, force: true });
      }
      await browser.close();
    }
  });

  it('keeps one-column vertical pagination working', async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    let fixture;
    try {
      fixture = await renderFixture(browser, { columns: 1, tocPages: 5 });
      const layout = await readTocLayout(fixture.browserPage);
      const rendered = layout.flatMap(({ entries }) => entries.map(({ text }) => text));

      assert.ok(layout[1].entries.length > 0);
      assert.deepEqual(rendered, headings);
      assertEntriesFit(layout);
    } finally {
      if (fixture) {
        await fixture.browserPage.close();
        fs.rmSync(fixture.fixtureDir, { recursive: true, force: true });
      }
      await browser.close();
    }
  });

  it('warns when the reserved TOC pages cannot contain all entries', async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    let fixture;
    try {
      fixture = await renderFixture(browser, { columns: 2, tocPages: 1 });
      const rendered = await fixture.browserPage.evaluate(() => (
        Array.from(document.querySelectorAll('.toc-entry'), (entry) => entry.textContent)
      ));

      assert.ok(rendered.length < headings.length);
      assert.equal(await overflowWarningCount(fixture.browserPage), 1);
    } finally {
      if (fixture) {
        await fixture.browserPage.close();
        fs.rmSync(fixture.fixtureDir, { recursive: true, force: true });
      }
      await browser.close();
    }
  });
});
