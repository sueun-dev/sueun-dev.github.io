import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const url = process.env.COVERAGE_URL || 'http://localhost:8000/';
const outputDir = process.env.COVERAGE_OUTPUT || path.resolve(__dirname, '..', 'coverage');
const chromePath =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const mergeRanges = (ranges) => {
  if (!ranges.length) return [];
  const sorted = ranges.slice().sort((a, b) => a.start - b.start);
  const merged = [sorted[0]];
  for (const range of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ start: range.start, end: range.end });
    }
  }
  return merged;
};

const calculateUsedBytes = (ranges) =>
  mergeRanges(ranges).reduce((sum, range) => sum + (range.end - range.start), 0);

const scrollPage = async (page) => {
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const total = document.body.scrollHeight;
    const step = Math.max(200, Math.floor(window.innerHeight * 0.6));

    for (let y = 0; y < total; y += step) {
      window.scrollTo(0, y);
      await sleep(80);
    }

    window.scrollTo(0, 0);
  });
};

const hoverSelectors = [
  '.nav-link',
  '.btn',
  '.hero-link',
  '.card-style',
  '.project-card',
  '.timeline-content',
  '.project-links a',
  '.contact-item',
];

const hoverAll = async (page, selectors) => {
  for (const selector of selectors) {
    const elements = await page.$$(selector);
    for (const el of elements.slice(0, 1)) {
      const box = await el.boundingBox();
      if (!box) continue;
      await el.evaluate((node) =>
        node.scrollIntoView({ block: 'center', inline: 'center' })
      );
      try {
        await el.hover();
        await sleep(40);
      } catch {
        // Ignore elements that cannot be hovered (hidden or covered).
      }
    }
  }
};

const clickIfExists = async (page, selector) => {
  const element = await page.$(selector);
  if (!element) return false;
  await element.click();
  return true;
};

const exercisePage = async (page, { openMenu }) => {
  await page.waitForSelector('body');
  await sleep(200);

  if (openMenu) {
    const opened = await clickIfExists(page, '.hamburger');
    if (opened) {
      await sleep(150);
      await hoverAll(page, ['.nav-link']);
      await page.keyboard.press('Escape');
      await sleep(120);
    }
  }

  await hoverAll(page, hoverSelectors);
  await scrollPage(page);
  await sleep(120);
};

const run = async () => {
  await fs.access(chromePath);
  await fs.mkdir(outputDir, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
  });

  const page = await browser.newPage();
  await page.coverage.startCSSCoverage();

  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await exercisePage(page, { openMenu: false });

  await page.setViewport({ width: 375, height: 800 });
  await page.reload({ waitUntil: 'networkidle0' });
  await exercisePage(page, { openMenu: true });

  const cssCoverage = await page.coverage.stopCSSCoverage();
  await browser.close();

  const summary = cssCoverage.map((entry) => {
    const usedBytes = calculateUsedBytes(entry.ranges);
    const totalBytes = entry.text.length;
    const unusedBytes = totalBytes - usedBytes;
    const percentUsed = totalBytes === 0 ? 0 : (usedBytes / totalBytes) * 100;

    return {
      url: entry.url,
      totalBytes,
      usedBytes,
      unusedBytes,
      percentUsed: Number(percentUsed.toFixed(2)),
    };
  });

  const summaryPath = path.join(outputDir, 'css-coverage-summary.json');
  const rawPath = path.join(outputDir, 'css-coverage.json');

  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
  await fs.writeFile(rawPath, JSON.stringify(cssCoverage, null, 2));

  const total = summary.reduce(
    (acc, item) => {
      acc.totalBytes += item.totalBytes;
      acc.usedBytes += item.usedBytes;
      acc.unusedBytes += item.unusedBytes;
      return acc;
    },
    { totalBytes: 0, usedBytes: 0, unusedBytes: 0 }
  );

  const percentUsed =
    total.totalBytes === 0 ? 0 : (total.usedBytes / total.totalBytes) * 100;

  console.log('CSS coverage summary');
  console.log(`Total bytes: ${total.totalBytes}`);
  console.log(`Used bytes: ${total.usedBytes}`);
  console.log(`Unused bytes: ${total.unusedBytes}`);
  console.log(`Used %: ${percentUsed.toFixed(2)}%`);
  console.log(`Report: ${summaryPath}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
