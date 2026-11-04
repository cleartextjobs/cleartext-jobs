// Builds a sandbox copy of the site (home page + country pages + privacy) into sandbox/,
// with the sample data embedded and links made relative, for previewing changes before they go live.
// Run: node test/build-sandbox.mjs
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { classify, seniority } from '../src/normalize.mjs';
import { buildCountryPages } from '../src/pages.mjs';

const root = new URL('..', import.meta.url);
const out = new URL('sandbox/', root);
const read = async (p) => readFile(new URL(p, root), 'utf8');

const snap = JSON.parse(await read('test/sample-snapshot.json'));
const jobs = snap.rows.map(([title, company, url, an, family, sen, workplace, countries, location, sal, stack, posted]) => ({
  title, company, url, source: an ? 'arbeitnow' : 'company', family, seniority: sen, workplace, countries: countries ? countries.split('|') : [], region: '', location,
  salary: sal ? { min: sal[0], max: sal[1], currency: sal[2], period: sal[3], from: sal[4] ? 'company' : 'posting text', ...(sal[5] ? { note: 'Range varies by location' } : {}) } : null,
  stack: stack ? stack.split('|') : [], posted,
})).map((j) => ({ ...j, family: classify(j.title, '', { strict: false }) || j.family, seniority: seniority(j.title) }));

const siteCfg = JSON.parse(await read('config/site.json'));
const { _notes, ...site } = siteCfg;
const pagesCfg = JSON.parse(await read('config/pages.json'));
const data = {
  updated: snap.updated, total: jobs.length, withSalary: jobs.filter((j) => j.salary).length,
  companies: new Set(jobs.map((j) => j.company)).size, site, jobs,
  snapshot: 'Sandbox: a test copy of the site with sample jobs. The live site is cleartextjobs.com.',
};

const banner = '<div style="background:#1F2937;color:#F9FAFB;font:600 13px/1.4 system-ui,sans-serif;text-align:center;padding:6px 12px">SANDBOX · test copy with sample jobs · the live site is cleartextjobs.com</div>';

// Home page: the part between the page markers, with the data embedded.
const html = await read('site/index.html');
const home = html.slice(html.indexOf('<!--page-start-->') + 17, html.indexOf('<!--page-end-->'))
  .replace(/<title>[^<]*<\/title>/, '<title>Cleartext Jobs</title>')
  .replace('</head>\n<body>\n', `${banner}\n`)
  .replace('<script>\n(async function', `<script>window.CLEARTEXT_DATA = ${JSON.stringify(data)};</script>\n<script>\n(async function`)
  .replace(/href="\/it-jobs\/([a-z-]+)\/"/g, 'href="it-jobs/$1/index.html"');

// Country pages: links relative to it-jobs/<slug>/index.html, no analytics.
const pages = buildCountryPages(jobs, { updated: snap.updated, config: pagesCfg, site }).map((p) => ({
  ...p,
  html: p.html
    .replace(/<!-- Cloudflare Web Analytics[\s\S]*?End Cloudflare Web Analytics -->/, '')
    .replace('<body>\n', `<body>\n${banner}\n`)
    .replace(/href="\/it-jobs\/([a-z-]+)\/"/g, 'href="../$1/index.html"')
    .replace(/href="\/\?/g, 'href="../../index.html?')
    .replace(/href="\/privacy\.html"/g, 'href="../../privacy.html"')
    .replace(/href="\/(#[a-z]+)?"/g, (m, h) => `href="../../index.html${h || ''}"`),
}));

const privacy = (await read('site/privacy.html'))
  .replace(/<!-- Cloudflare Web Analytics[\s\S]*?End Cloudflare Web Analytics -->/, '')
  .replace('<body>\n', `<body>\n${banner}\n`)
  .replace(/href="\/"/g, 'href="index.html"').replace(/href="\.\/"/g, 'href="index.html"');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await writeFile(new URL('index.html', out), home);
await writeFile(new URL('privacy.html', out), privacy);
for (const p of pages) {
  await mkdir(new URL(p.path.replace(/[^/]+$/, ''), out), { recursive: true });
  await writeFile(new URL(p.path, out), p.html);
}
console.log(`sandbox/: home (${jobs.length} sample jobs), privacy, ${pages.map((p) => `${p.path.split('/')[1]} ${p.total}`).join(', ')}`);
