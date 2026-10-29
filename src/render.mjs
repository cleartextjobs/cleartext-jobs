// Renders the carousel slides planned by `node src/social.mjs --plan` to JPEG files in
// site/social/<date>/, so they are published with the site and Instagram can fetch them.
// Needs Playwright with Chromium (installed by the workflow).
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url);
const plan = JSON.parse(await readFile(new URL('social-out/plan.json', root), 'utf8'));
if (!plan) { console.log('No post planned; nothing to render.'); process.exit(0); }
const html = JSON.parse(await readFile(new URL('social-out/slides.json', root), 'utf8'));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
const tmp = new URL('assets/_slide.html', root); // next to assets/fonts, which the slides load
for (const [i, slide] of html.entries()) {
  await writeFile(tmp, slide);
  await page.goto(tmp.href);
  await page.evaluate(() => document.fonts.ready);
  const file = new URL(`site/${plan.images[i]}`, root);
  await mkdir(new URL('.', file), { recursive: true });
  await page.screenshot({ path: file.pathname, type: 'jpeg', quality: 90 });
}
await browser.close();
await rm(tmp, { force: true });
console.log(`Rendered ${html.length} slides to site/social/${plan.stamp}/`);
