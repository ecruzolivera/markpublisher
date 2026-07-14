import puppeteer from 'puppeteer';
import { pathToFileURL } from 'node:url';

export async function generatePdf(htmlPath, pdfSize, outputPath) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(htmlPath).href, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    await page.evaluate(async () => {
      await document.fonts.ready;
      await window.__tocReady;
    });

    const pdfOptions = {
      printBackground: true,
      outline: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    };

    if (pdfSize.format) {
      pdfOptions.format = pdfSize.format;
    } else if (pdfSize.width && pdfSize.height) {
      pdfOptions.width = pdfSize.width;
      pdfOptions.height = pdfSize.height;
    } else {
      pdfOptions.format = 'A4';
    }

    const pdfBuffer = await page.pdf(pdfOptions);

    if (outputPath) {
      const fs = await import('node:fs');
      fs.writeFileSync(outputPath, pdfBuffer);
    }

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}
