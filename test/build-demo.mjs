// Builds a self-contained preview page (site + embedded snapshot) for sharing before the real site is live.
// Uses test/full-snapshot.json when present (a full collection run), else the small sample.
import { readFile, writeFile, access } from 'node:fs/promises';
import { classify, seniority } from '../src/normalize.mjs';
const root = new URL('..', import.meta.url);
let jobs, meta;
try {
  await access(new URL('test/full-snapshot.json', root));
  jobs = JSON.parse(await readFile(new URL('test/full-snapshot.json', root), 'utf8'));
  meta = { updated: '2026-10-27T18:56:58.243Z' };
} catch {
  const snap = JSON.parse(await readFile(new URL('test/sample-snapshot.json', root), 'utf8'));
  meta = { updated: snap.updated };
  jobs = snap.rows.map(([title, company, url, an, family, sen, workplace, countries, location, sal, stack, posted]) => ({
    title, company, url, source: an ? 'arbeitnow' : 'company', family, seniority: sen, workplace, countries: countries ? countries.split('|') : [], region: '', location,
    salary: sal ? { min: sal[0], max: sal[1], currency: sal[2], period: sal[3], from: sal[4] ? 'company' : 'posting text', ...(sal[5] ? { note: 'Range varies by location' } : {}) } : null,
    stack: stack ? stack.split('|') : [], posted,
  }));
}
// Re-apply the current classification rules to the snapshot.
const before = jobs.length;
jobs = jobs.map((j) => ({ ...j, family: classify(j.title, '', { strict: j.source === 'smartrecruiters' }), seniority: seniority(j.title), company: j.company === 'N8n' ? 'n8n' : j.company })).filter((j) => j.family);
const data = {
  ...meta, site: { price: 49, currency: 'EUR', days: 30, contactEmail: 'cleartextjobs@gmail.com', paymentLink: '' }, total: jobs.length, withSalary: jobs.filter((j) => j.salary).length, companies: new Set(jobs.map((j) => j.company)).size, jobs,
  snapshot: `Preview built from a real collection run on 27 October 2026. The live site refreshes the list automatically every 6 hours.`,
};
const html = await readFile(new URL('site/index.html', root), 'utf8');
const page = html.slice(html.indexOf('<!--page-start-->') + 17, html.indexOf('<!--page-end-->'))
  .replace('</head>\n<body>\n', '')
  .replace('<script>\n(async function', `<script>window.CLEARTEXT_DATA = ${JSON.stringify(data)};</script>\n<script>\n(async function`);
await writeFile(new URL('demo.html', root), page);
const c = (k) => jobs.filter((j) => j.countries.includes(k)).length;
console.log(`demo.html: ${jobs.length} jobs (dropped ${before - jobs.length} by new rules), ${data.withSalary} with salary, ${data.companies} companies, PT ${c('Portugal')}, ES ${c('Spain')}, ${(page.length / 1024).toFixed(0)} KB`);
