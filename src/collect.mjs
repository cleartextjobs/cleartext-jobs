// Collects IT jobs in Europe from public company job boards and writes site/jobs.json.
// Run: node src/collect.mjs   (Node 20+, no dependencies)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fromGreenhouse, fromLever, fromAshby, fromArbeitnow, fromSmartRecruiters, fromRecruitee, finalize, dedupe, applyFeatured } from './normalize.mjs';

const ROOT = new URL('..', import.meta.url);
const config = JSON.parse(await readFile(new URL('config/sources.json', ROOT), 'utf8'));
const readOptional = async (path, fallback) => { try { return JSON.parse(await readFile(new URL(path, ROOT), 'utf8')); } catch { return fallback; } };
const site = await readOptional('config/site.json', {});
const featured = await readOptional('config/featured.json', {});
const UA = 'CleartextJobsBot/0.1 (+https://cleartextjobs.com)';
const report = { ok: [], failed: [] };
const names = config.names || {};

async function getJSON(url, tries = 2) {
  for (let i = 0; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
      if (r.status === 404) throw new Error('not found (check the token)');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i === tries || /not found/.test(e.message)) throw e;
      await new Promise((res) => setTimeout(res, 2000 * (i + 1)));
    }
  }
}

// Small pool so we stay polite to each provider.
async function pool(items, size, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) { const item = items[i++]; out.push(...(await fn(item))); }
  }));
  return out;
}

async function source(label, tokens, fetcher) {
  return pool(tokens, 4, async (token) => {
    try {
      const jobs = await fetcher(token);
      report.ok.push(`${label}/${token}: ${jobs.length}`);
      return jobs;
    } catch (e) {
      report.failed.push(`${label}/${token}: ${e.message}`);
      return [];
    }
  });
}

const raw = [
  ...(await source('greenhouse', config.greenhouse || [], async (t) => {
    const d = await getJSON(`https://boards-api.greenhouse.io/v1/boards/${t}/jobs?content=true&pay_transparency=true`);
    return (d.jobs || []).map((j) => fromGreenhouse(t, j, names[t]));
  })),
  ...(await source('lever', config.lever || [], async (t) => {
    const d = await getJSON(`https://api.lever.co/v0/postings/${t}?mode=json`);
    return (Array.isArray(d) ? d : []).map((p) => fromLever(t, p, names[t]));
  })),
  ...(await source('ashby', config.ashby || [], async (t) => {
    const d = await getJSON(`https://api.ashbyhq.com/posting-api/job-board/${t}?includeCompensation=true`);
    return (d.jobs || []).map((j) => fromAshby(t, j, names[t])).filter(Boolean);
  })),
  ...(await source('recruitee', config.recruitee || [], async (t) => {
    const d = await getJSON(`https://${t}.recruitee.com/api/offers/`);
    return (d.offers || []).map((o) => fromRecruitee(t, o, names[t]));
  })),
];

// SmartRecruiters companies are often large employers with many non-IT roles, so ask per European country.
const SR_COUNTRIES = ['pt', 'es', 'fr', 'de', 'nl', 'be', 'lu', 'ie', 'gb', 'it', 'ch', 'at', 'dk', 'se', 'no', 'fi', 'pl', 'cz', 'sk', 'hu', 'ro', 'bg', 'gr', 'hr', 'si', 'rs', 'ee', 'lv', 'lt', 'cy', 'mt'];
for (const entry of config.smartrecruiters || []) {
  const id = typeof entry === 'string' ? entry : entry.id;
  const countries = (typeof entry === 'object' && entry.countries) || SR_COUNTRIES;
  raw.push(...(await source('smartrecruiters', countries.map((c) => `${id}:${c}`), async (key) => {
    const [cid, country] = key.split(':');
    const out = [];
    for (let offset = 0; offset < 1000; offset += 100) {
      const d = await getJSON(`https://api.smartrecruiters.com/v1/companies/${cid}/postings?country=${country}&limit=100&offset=${offset}`);
      out.push(...(d.content || []).map((p) => fromSmartRecruiters(cid, p, names[cid])));
      if (!d.content || d.content.length < 100) break;
    }
    return out;
  })));
}

if (config.arbeitnow?.enabled) {
  const pages = Array.from({ length: config.arbeitnow.pages || 3 }, (_, i) => i + 1);
  raw.push(...(await source('arbeitnow', pages, async (p) => {
    const d = await getJSON(`https://www.arbeitnow.com/api/job-board-api?page=${p}`);
    return (d.data || []).map(fromArbeitnow);
  })));
}

const now = Date.now();
const jobs = applyFeatured(
  dedupe(raw.map((j) => finalize(j, { now, maxAgeDays: config.maxAgeDays || 120 })).filter(Boolean)).sort((a, b) => (b.posted || '').localeCompare(a.posted || '')),
  featured, { now },
);

const summary = {
  updated: new Date(now).toISOString(),
  total: jobs.length,
  withSalary: jobs.filter((j) => j.salary).length,
  companies: new Set(jobs.map((j) => j.company)).size,
  collected: raw.length,
};

await mkdir(new URL('site/', ROOT), { recursive: true });
const { _notes, ...siteSettings } = site;
await writeFile(new URL('site/jobs.json', ROOT), JSON.stringify({ ...summary, site: siteSettings, jobs }));

console.log(`Collected ${raw.length} postings → kept ${jobs.length} IT jobs in Europe (${summary.withSalary} with salary) from ${summary.companies} companies.`);
if (report.failed.length) console.log(`Skipped sources (${report.failed.length}):\n  ` + report.failed.join('\n  '));

// Fail the run only if nothing at all came back, so one broken board never takes the site down.
if (!jobs.length) { console.error('No jobs collected; keeping the previous site.'); process.exit(1); }
