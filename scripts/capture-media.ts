/**
 * Captures README screenshots and an animated GIF from the demo mode.
 * Start a production preview first (npm run build && npm run preview), then:
 *   BASE_URL=http://localhost:4173 npx tsx scripts/capture-media.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, type Page } from '@playwright/test';
import gifenc from 'gifenc';
import { PNG } from 'pngjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT = 'docs/media';
const { GIFEncoder, applyPalette, quantize } = gifenc;

async function openDemo(page: Page) {
  await page.goto(`${BASE}/`);
  await page.getByRole('button', { name: 'Try the demo' }).first().click();
  await page.waitForURL(/\/app$/);
  await page.getByText('Safe to spend today').first().waitFor();
  await page.waitForTimeout(600);
}

async function settle(page: Page, ms = 700) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(ms);
}

async function screenshots() {
  const browser = await chromium.launch();
  for (const scheme of ['light', 'dark'] as const) {
    const context = await browser.newContext({
      viewport: { width: 1360, height: 860 },
      deviceScaleFactor: 2,
      locale: 'en-US',
      colorScheme: scheme,
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await openDemo(page);
    await page.screenshot({ path: `${OUT}/overview-${scheme}.png` });
    if (scheme === 'light') {
      for (const [path, name] of [
        ['/app/transactions', 'transactions'],
        ['/app/cards', 'cards'],
        ['/app/budgets', 'budgets'],
        ['/app/reports', 'reports'],
      ] as const) {
        await page.goto(`${BASE}${path}`);
        await settle(page, name === 'reports' ? 1800 : 700);
        await page.screenshot({ path: `${OUT}/${name}.png` });
      }
    }
    await context.close();
  }

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'pt-BR',
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  const page = await phone.newPage();
  await page.goto(`${BASE}/`);
  await page.getByRole('button', { name: 'Ver demonstração' }).first().click();
  await page.waitForURL(/\/app$/);
  await settle(page);
  await page.screenshot({ path: `${OUT}/overview-mobile.png` });
  await phone.close();
  await browser.close();
}

async function gif() {
  const width = 1000;
  const height = 640;
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width, height },
    locale: 'en-US',
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const encoder = GIFEncoder();
  const frame = async (delay: number) => {
    const png = PNG.sync.read(await page.screenshot());
    const palette = quantize(png.data, 256);
    encoder.writeFrame(applyPalette(png.data, palette), png.width, png.height, { palette, delay });
  };

  await page.goto(`${BASE}/`);
  await settle(page);
  await frame(1800);
  await page.getByRole('button', { name: 'Try the demo' }).first().click();
  await page.waitForURL(/\/app$/);
  await settle(page);
  await frame(2200);

  await page.getByText('Safe to spend today').first().click();
  await settle(page, 400);
  await frame(2200);
  await page.keyboard.press('Escape');
  await settle(page, 300);

  await page.keyboard.press('n');
  const input = page.getByTestId('quick-entry-input');
  await input.waitFor();
  const text = 'sneakers 600 in 3x card inter';
  for (let i = 1; i <= text.length; i += 4) {
    await input.fill(text.slice(0, i));
    await frame(120);
  }
  await input.fill(text);
  await page.waitForTimeout(200);
  await frame(2400);
  await input.press('Enter');
  await settle(page, 500);

  await page.goto(`${BASE}/app/cards`);
  await settle(page);
  await frame(2200);
  await page.goto(`${BASE}/app/reports`);
  await settle(page, 1800);
  await frame(2400);
  await page.goto(`${BASE}/app/budgets`);
  await settle(page);
  await frame(2000);

  encoder.finish();
  writeFileSync(`${OUT}/demo.gif`, encoder.bytes());
  await browser.close();
}

mkdirSync(OUT, { recursive: true });
await screenshots();
await gif();
console.log('media written to', OUT);
