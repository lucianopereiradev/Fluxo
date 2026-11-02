/**
 * Renders the PWA icons and the Open Graph image from HTML with Playwright's Chromium.
 * Run with: npx tsx scripts/generate-assets.ts
 */
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const font = (path: string) => `data:font/woff2;base64,${readFileSync(path).toString('base64')}`;
const FRAUNCES = font(
  'node_modules/@fontsource-variable/fraunces/files/fraunces-latin-soft-normal.woff2',
);
const GEIST = font('node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2');

const ACCENT = '#a84c26';
const PAPER = '#f4f1ea';
const INK = '#1d1c1a';

const mark = (size: number, radius: number) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">
  <rect width="32" height="32" rx="${radius}" fill="${ACCENT}"/>
  <g fill="none" stroke="#fffaf5" stroke-width="2.6" stroke-linecap="round">
    <path d="M7 10.5c6 0 7.5 5.5 13 5.5h5"/>
    <path d="M7 16h18" stroke-opacity=".7"/>
    <path d="M7 21.5c6 0 7.5-5.5 13-5.5" stroke-opacity=".45"/>
  </g>
</svg>`;

const page = (body: string, width: number, height: number) => `<!doctype html><html><head><style>
@font-face { font-family: Fraunces; src: url(${FRAUNCES}); font-weight: 100 900; }
@font-face { font-family: Geist; src: url(${GEIST}); font-weight: 100 900; }
html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; }
body { font-family: Geist, sans-serif; color: ${INK}; }
</style></head><body>${body}</body></html>`;

const og = `
<div style="position:relative;width:1200px;height:630px;background:${PAPER};overflow:hidden">
  <svg width="1200" height="630" style="position:absolute;inset:0" aria-hidden="true">
    <g fill="none" stroke-linecap="round">
      <path d="M780 540 C 920 540, 900 300, 1000 300 S 1180 300, 1260 300" stroke="${ACCENT}" stroke-width="22" stroke-opacity=".9"/>
      <path d="M780 470 C 900 470, 920 360, 1260 360" stroke="${ACCENT}" stroke-width="22" stroke-opacity=".55"/>
      <path d="M780 120 C 920 120, 900 420, 1000 420 S 1180 420, 1260 420" stroke="${ACCENT}" stroke-width="22" stroke-opacity=".3"/>
    </g>
  </svg>
  <div style="position:absolute;left:80px;top:72px;display:flex;align-items:center;gap:20px">
    ${mark(72, 9)}
    <span style="font-family:Fraunces;font-size:56px;font-weight:600;letter-spacing:-1px">Fluxo</span>
  </div>
  <div style="position:absolute;left:80px;top:220px;width:640px">
    <div style="font-family:Fraunces;font-size:66px;line-height:1.05;font-weight:500;letter-spacing:-1.5px">Your money, in flow.<br/>Your data, at home.</div>
    <div style="margin-top:28px;font-size:28px;line-height:1.4;color:#625d54">Local-first personal finance. No account, works offline, optional end-to-end encrypted sync.</div>
  </div>
</div>`;

async function main() {
  const browser = await chromium.launch();
  const shot = async (html: string, width: number, height: number, path: string) => {
    const p = await browser.newPage({ viewport: { width, height } });
    await p.setContent(page(html, width, height));
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path, omitBackground: true });
    await p.close();
    console.log('wrote', path);
  };
  const icon = (size: number) =>
    `<div style="width:${size}px;height:${size}px">${mark(size, 9)}</div>`;
  // Maskable icons keep the logo inside the central safe zone (80%).
  const maskable = (size: number) =>
    `<div style="width:${size}px;height:${size}px;background:${ACCENT};display:grid;place-items:center">${mark(Math.round(size * 0.72), 0)}</div>`;

  await shot(icon(192), 192, 192, 'public/icons/icon-192.png');
  await shot(icon(512), 512, 512, 'public/icons/icon-512.png');
  await shot(maskable(512), 512, 512, 'public/icons/maskable-512.png');
  await shot(maskable(180), 180, 180, 'public/apple-touch-icon.png');
  await shot(og, 1200, 630, 'public/og-image.png');
  await browser.close();
}

void main();
