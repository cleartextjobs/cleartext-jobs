// Static country pages for search engines: /it-jobs/<slug>/index.html.
// The job rows are written into the HTML (no JavaScript needed), so search engines can read them.
const BASE = 'https://cleartextjobs.com';
const nf = new Intl.NumberFormat('en-GB');
const SYM = { EUR: '€', GBP: '£', CHF: 'CHF ', PLN: 'PLN ', SEK: 'SEK ', DKK: 'DKK ', NOK: 'NOK ', CZK: 'CZK ', HUF: 'HUF ', RON: 'RON ', BGN: 'BGN ' };
const PER = { year: 'a year', month: 'a month', day: 'a day', hour: 'an hour' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (s) => { const c = SYM[s.currency] ?? `${s.currency} `; return s.min === s.max ? `${c}${nf.format(s.min)}` : `${c}${nf.format(s.min)}–${nf.format(s.max)}`; };
const round = (n) => (n >= 10000 ? Math.round(n / 1000) * 1000 : Math.round(n / 100) * 100);
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

export const jobsIn = (jobs, country) => jobs.filter((j) => (j.countries || []).includes(country));

const sortJobs = (list) => [...list].sort((a, b) => (!!b.featured - !!a.featured) || (!!b.salary - !!a.salary) || (b.posted || '').localeCompare(a.posted || ''));

// Yearly salaries in the local currency: median of the range midpoints, overall and per area (5+ jobs).
export function salaryStats(list, currency) {
  const yearly = list.filter((j) => j.salary && j.salary.period === 'year' && j.salary.currency === currency);
  const mid = (j) => (j.salary.min + j.salary.max) / 2;
  const byFamily = {};
  yearly.forEach((j) => (byFamily[j.family] ||= []).push(mid(j)));
  const families = Object.entries(byFamily).filter(([, v]) => v.length >= 5)
    .map(([family, v]) => ({ family, n: v.length, median: round(median(v)) })).sort((a, b) => b.median - a.median);
  return { n: yearly.length, median: yearly.length >= 5 ? round(median(yearly.map(mid))) : null, families };
}

// Cities, from the short location of jobs placed in this country only (e.g. "Berlin, Germany" → Berlin).
export function topCities(list, country, limit = 8) {
  const counts = {};
  for (const j of list) {
    if ((j.countries || []).length !== 1) continue;
    const city = String(j.location || '').split(/[,;(]/)[0].trim();
    if (!city || city.length > 30 || city.toLowerCase() === country.toLowerCase() || /remote|europe|countries/i.test(city)) continue;
    const key = city.replace(/\b\w/g, (c) => c.toUpperCase());
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

const countBy = (list, key) => {
  const c = {};
  list.forEach((j) => { const v = j[key]; if (v) c[v] = (c[v] || 0) + 1; });
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
};

function row(j) {
  const s = j.salary;
  const pay = s
    ? `<mark class="sal">${esc(money(s))}</mark><span class="per">${PER[s.period] || ''}${s.note ? ', varies by location' : ''}</span>`
    : '<span class="none">Salary not published</span>';
  const meta = [j.location, j.workplace, j.seniority, j.posted ? `Posted ${fmtDate(j.posted)}` : ''].filter(Boolean).map((m) => `<span>${esc(m)}</span>`).join('');
  const stack = j.stack?.length ? `<div class="stack">${j.stack.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : '';
  const via = j.source === 'arbeitnow' ? ' <span class="via">via <a href="https://www.arbeitnow.com" target="_blank" rel="noopener">Arbeitnow</a></span>' : '';
  return `<li class="job${j.featured ? ' featured' : ''}">
<div class="head"><h3><a href="${esc(j.url)}" target="_blank" rel="noopener nofollow">${esc(j.title)}</a>${j.featured ? '<span class="badge">Featured</span>' : ''}</h3><div class="co">${esc(j.company)}</div></div>
<div class="pay">${pay}</div>
<div class="body"><div class="meta">${meta}</div>${stack}${via}</div>
</li>`;
}

export function countryPage(c, jobs, { updated, all, maxListed = 150, site = {} }) {
  const label = c.label || c.name;
  const list = sortJobs(jobsIn(jobs, c.name));
  const total = list.length;
  const withSal = list.filter((j) => j.salary).length;
  const companies = new Set(list.map((j) => j.company)).size;
  const stats = salaryStats(list, c.currency);
  const cities = topCities(list, c.name);
  const models = countBy(list, 'workplace');
  const areas = countBy(list, 'family');
  const url = `${BASE}/it-jobs/${c.slug}/`;
  const day = fmtDate(updated);
  const cur = (n) => `${SYM[c.currency] ?? c.currency + ' '}${nf.format(n)}`;
  const filterLink = `/?country=${encodeURIComponent(c.name)}`;

  const title = `IT jobs in ${label} with salary: ${nf.format(total)} open roles | Cleartext Jobs`;
  const desc = total
    ? `${nf.format(total)} IT jobs in ${label} from ${nf.format(companies)} companies' own job boards, ${nf.format(withSal)} with the salary shown${stats.median ? ` (median ${cur(stats.median)} a year)` : ''}. Remote, hybrid and on-site. Updated ${day}.`
    : `IT jobs in ${label} from companies' own job boards, with the salary shown first. Updated ${day}.`;

  const salaryBlock = stats.median ? `
<section class="panel" aria-labelledby="pay-h">
<h2 id="pay-h">Published salaries</h2>
<p class="big"><mark class="sal">${esc(cur(stats.median))}</mark> <span class="per">median a year</span></p>
<p class="small">Middle of the published range, gross per year in ${esc(c.currency)}, across ${nf.format(stats.n)} jobs. Only jobs that publish a salary count.</p>
${stats.families.length ? `<table><thead><tr><th scope="col">Area</th><th scope="col" class="num">Median</th><th scope="col" class="num">Jobs</th></tr></thead><tbody>
${stats.families.map((f) => `<tr><td>${esc(f.family)}</td><td class="num">${esc(cur(f.median))}</td><td class="num">${f.n}</td></tr>`).join('\n')}
</tbody></table>` : ''}
</section>` : '';

  const facts = (h, rows, id) => rows.length ? `
<section class="panel" aria-labelledby="${id}">
<h2 id="${id}">${h}</h2>
<ul class="bars">${rows.map(([k, n]) => `<li><span>${esc(k)}</span><span class="n">${nf.format(n)}</span></li>`).join('')}</ul>
</section>` : '';

  const others = all.filter((o) => o.slug !== c.slug).map((o) => `<a href="/it-jobs/${esc(o.slug)}/">${esc(o.name)}</a>`).join(' · ');
  const shown = list.slice(0, maxListed);
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: `IT jobs in ${label}`, url, description: desc, dateModified: updated, isPartOf: { '@type': 'WebSite', name: 'Cleartext Jobs', url: `${BASE}/` } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Cleartext Jobs', item: `${BASE}/` },
        { '@type': 'ListItem', position: 2, name: `IT jobs in ${label}`, item: url },
      ] },
    ],
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Cleartext Jobs">
<meta property="og:title" content="IT jobs in ${esc(label)}, with the salary in plain text">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${BASE}/og.png">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Martian+Mono:wght@400;600&display=swap">
<style>
:root { --paper: #F1F4F8; --surface: #FFFFFF; --ink: #131B2A; --muted: #56617A; --rule: #D5DCE6; --mark: #FFE45C; --mark-ink: #191708; --link: #2145C4; --tint: #FFF8D1;
  --sans: "Instrument Sans", "Segoe UI", system-ui, -apple-system, sans-serif; --mono: "Martian Mono", ui-monospace, Menlo, Consolas, monospace; }
@media (prefers-color-scheme: dark) { :root { --paper: #0F141E; --surface: #161D2A; --ink: #E5E9F0; --muted: #9AA4B6; --rule: #283245; --mark: #E7CC38; --mark-ink: #15130A; --link: #93AAFF; --tint: #2A2614; color-scheme: dark; } }
[hidden] { display: none !important; }
body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--sans); line-height: 1.5; }
.wrap { max-width: 64rem; margin: 0 auto; padding-inline: 16px; }
a { color: var(--link); }
:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; border-radius: 3px; }
.topbar { position: sticky; top: 0; z-index: 7; background: var(--paper); }
.top { padding-block: 0.85rem; display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; align-items: baseline; }
.brand { font-weight: 700; font-size: 1.25rem; color: var(--ink); text-decoration: none; }
.brand span { font-family: var(--mono); font-weight: 400; font-size: 0.8em; color: var(--muted); }
.crumbs { font-size: 0.8125rem; color: var(--muted); }
.hero { padding-block: 1.5rem 1.5rem; display: grid; gap: 1rem; }
h1 { margin: 0; font-size: clamp(2rem, 1.3rem + 3.2vw, 3.2rem); line-height: 1.05; letter-spacing: -0.025em; max-width: 18ch; text-wrap: balance; }
.lede { margin: 0; color: var(--muted); max-width: 44rem; }
.by-country { font-size: 0.9375rem; color: var(--muted); }
.by-country a { font-weight: 500; }
.lede strong { color: var(--ink); font-variant-numeric: tabular-nums; }
.cta { display: inline-block; justify-self: start; font-weight: 600; text-decoration: none; color: var(--mark-ink); background: var(--mark); border-radius: 6px; padding: 0.6rem 1rem; }
mark.sal { background: linear-gradient(transparent 12%, var(--mark) 12%, var(--mark) 88%, transparent 88%); color: var(--mark-ink); padding: 0 0.25em; font-family: var(--mono); font-weight: 600; font-variant-numeric: tabular-nums; }
.panels { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); align-items: start; padding-top: 0.9rem; }
.summary { padding-bottom: 1rem; }
.pager { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.75rem 1rem; padding-block: 1.25rem; font-size: 0.9375rem; }
.pager select { font: inherit; color: var(--ink); background: var(--surface); border: 1px solid var(--rule); border-radius: 6px; padding: 0.3rem 0.4rem; }
.pages { display: flex; align-items: center; gap: 0.75rem; }
.pages span { color: var(--muted); font-variant-numeric: tabular-nums; }
.pager button { font: inherit; font-weight: 600; color: var(--ink); background: var(--surface); border: 1px solid var(--rule); border-radius: 6px; padding: 0.45rem 0.9rem; cursor: pointer; }
.pager button:disabled { opacity: 0.4; cursor: default; }
.panel { background: var(--surface); border: 1px solid var(--rule); border-radius: 8px; padding: 1rem 1.15rem; }
.panel h2 { margin: 0 0 0.6rem; font-size: 1rem; }
.big { margin: 0; font-size: 1.4rem; }
.per { font-size: 0.8rem; color: var(--muted); }
.small { margin: 0.4rem 0 0.75rem; font-size: 0.8125rem; color: var(--muted); }
table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
th { text-align: left; font-weight: 600; color: var(--muted); border-bottom: 1px solid var(--rule); padding: 0.3rem 0; }
td { border-bottom: 1px solid var(--rule); padding: 0.35rem 0; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.bars { list-style: none; margin: 0; padding: 0; font-size: 0.9rem; }
.bars li { display: flex; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--rule); padding: 0.3rem 0; }
.bars .n { color: var(--muted); font-variant-numeric: tabular-nums; }
.employers { padding-block: 2rem 1rem; display: grid; gap: 1.25rem; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); align-items: start; border-top: 1px solid var(--rule); margin-top: 1rem; }
.employers h2 { margin: 0 0 0.5rem; font-size: 1.5rem; letter-spacing: -0.015em; }
.employers p { margin: 0 0 0.75rem; max-width: 36rem; }
.offer { background: var(--surface); border: 1px solid var(--rule); border-radius: 8px; padding: 1.25rem; display: grid; gap: 0.75rem; }
.offer .price { font-family: var(--mono); font-size: 1.6rem; font-weight: 600; }
.offer .price small { font-family: var(--sans); font-size: 0.875rem; font-weight: 400; color: var(--muted); }
.offer ul { margin: 0; padding-left: 1.1rem; display: grid; gap: 0.3rem; }
.offer .cta { justify-self: stretch; text-align: center; }
.contact { font-size: 0.9375rem; display: flex; flex-wrap: wrap; gap: 0.4rem; }
.contact code { font-family: var(--mono); font-size: 0.85rem; }
@media (max-width: 760px) { .employers { grid-template-columns: minmax(0, 1fr); } }
.list-h { font-size: 1.35rem; margin: 0.9rem 0 0; letter-spacing: -0.01em; }
.jobs { list-style: none; margin: 0; padding: 0; }
.job { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "head pay" "body pay"; gap: 0.25rem 1.5rem; padding-block: 1.1rem; border-bottom: 1px solid var(--rule); }
.job .head { grid-area: head; min-width: 0; } .job .body { grid-area: body; min-width: 0; } .job .pay { grid-area: pay; }
.job h3 { margin: 0; font-size: 1.0625rem; line-height: 1.3; font-weight: 600; }
.job h3 a { color: var(--ink); text-decoration: none; } .job h3 a:hover { text-decoration: underline; }
.co { font-weight: 500; }
.meta { color: var(--muted); font-size: 0.9rem; display: flex; flex-wrap: wrap; gap: 0.15rem 0.9rem; }
.stack { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.35rem; }
.stack span { font-size: 0.75rem; border: 1px solid var(--rule); border-radius: 4px; padding: 0.05rem 0.4rem; color: var(--muted); }
.pay { text-align: right; display: grid; align-content: start; justify-items: end; gap: 0.2rem; }
.pay .none { color: var(--muted); font-size: 0.875rem; }
.via { font-size: 0.75rem; color: var(--muted); } .via a { color: inherit; }
.job.featured { background: var(--tint); margin-inline: -0.75rem; padding-inline: 0.75rem; border-radius: 6px; }
.badge { font-size: 0.7rem; font-weight: 600; color: var(--mark-ink); background: var(--mark); border-radius: 3px; padding: 0.05rem 0.4rem; margin-left: 0.4rem; }
.after { margin: 0; padding-block: 0.5rem 1.5rem; }
footer { border-top: 1px solid var(--rule); margin-top: 1rem; padding-block: 1.5rem 3rem; color: var(--muted); font-size: 0.875rem; }
footer p { margin: 0 0 0.5rem; max-width: 46rem; }
footer .legal { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--rule); }
@media (max-width: 600px) {
  .job { grid-template-columns: minmax(0, 1fr); grid-template-areas: "head" "pay" "body"; }
  .pay { text-align: left; justify-items: start; grid-auto-flow: column; justify-content: start; align-items: baseline; gap: 0.5rem; }
}
</style>
</head>
<body>
<header class="topbar" id="topbar"><div class="wrap top">
<a class="brand" href="/">Cleartext Jobs <span>/ IT, Europe</span></a>
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">All IT jobs in Europe</a> › ${esc(label)}</nav>
</div></header>
<main>
<section class="wrap hero">
<h1>IT jobs in ${esc(label)}, with the salary in plain text</h1>
<p class="lede">${total
    ? `<strong>${nf.format(total)}</strong> open IT roles in ${esc(label)} from <strong>${nf.format(companies)}</strong> companies, collected from their own job boards. <strong>${nf.format(withSal)}</strong> (${pct(withSal, total)}%) show the salary. Updated ${esc(day)}.`
    : `No open IT roles in ${esc(label)} in today's collection. The list refreshes every 6 hours.`}</p>
<a class="cta" href="${esc(filterLink)}">Search and filter jobs in ${esc(label)}</a>
<nav class="by-country" aria-label="Other countries"><a href="/">All countries</a> · Other countries: ${others}</nav>
</section>
<section class="wrap list" aria-labelledby="list-h">
<h2 class="list-h" id="list-h">${nf.format(total)} ${total === 1 ? 'job' : 'jobs'}, salary shown first</h2>
<ul class="jobs" id="jobs">
${shown.map(row).join('\n')}
</ul>
${shown.length > 10 ? `<nav class="pager" id="pager" aria-label="Pages" hidden>
<label class="per-page">Show <select id="per"><option>10</option><option>25</option><option>50</option><option value="0">All</option></select> per page</label>
<div class="pages"><button type="button" id="prev">Previous</button><span id="pinfo" aria-live="polite"></span><button type="button" id="next">Next</button></div>
</nav>` : ''}
${total > shown.length ? `<p class="after"><a class="cta" href="${esc(filterLink)}">See all ${nf.format(total)} jobs in ${esc(label)}</a></p>` : ''}
</section>
${total ? `<section class="wrap summary" aria-labelledby="sum-h">
<h2 class="list-h" id="sum-h">IT jobs in ${esc(label)} in numbers</h2>
<div class="panels">${salaryBlock}${facts('Where the jobs are', cities, 'city-h')}${facts('Work model', models, 'model-h')}${facts('Areas', areas, 'area-h')}</div>
</section>` : ''}
${employers(site)}
</main>
<footer>
<div class="wrap">
<p>Jobs are collected automatically, several times a day, from the public job boards of the companies that post them. Every listing links to the original posting, where you apply directly. Cleartext Jobs does not receive applications or store any personal data.</p>
<p>Salaries are shown as the company published them: gross, in the original currency and period.</p>
<p><a href="/">All IT jobs in Europe</a> · <a href="#employers">Feature a job</a></p>
<p>Follow Cleartext Jobs: <a href="https://www.facebook.com/cleartextjobs" target="_blank" rel="noopener">Facebook</a> · <a href="https://www.instagram.com/cleartextjobs/" target="_blank" rel="noopener">Instagram</a></p>
<p class="legal"><a href="/privacy.html">Privacy policy</a></p>
</div>
</footer>
<script>
(function () {
  var list = document.getElementById('jobs'), pager = document.getElementById('pager');
  if (!list || !pager) return;
  var rows = [].slice.call(list.children), per = document.getElementById('per'), page = 0;
  function size() { return +per.value || rows.length; }
  function show(scroll) {
    var n = size(), pages = Math.max(1, Math.ceil(rows.length / n));
    page = Math.min(page, pages - 1);
    rows.forEach(function (r, i) { r.hidden = i < page * n || i >= (page + 1) * n; });
    document.getElementById('pinfo').textContent = 'Page ' + (page + 1) + ' of ' + pages;
    document.getElementById('prev').disabled = page === 0;
    document.getElementById('next').disabled = page >= pages - 1;
    if (scroll) window.scrollTo({ top: Math.max(0, document.getElementById('list-h').getBoundingClientRect().top + window.scrollY - document.getElementById('topbar').offsetHeight - 8) });
  }
  per.addEventListener('change', function () { page = 0; show(false); });
  document.getElementById('prev').addEventListener('click', function () { page--; show(true); });
  document.getElementById('next').addEventListener('click', function () { page++; show(true); });
  pager.hidden = false;
  show(false);
})();
</script>
<!-- Cloudflare Web Analytics (cookieless page-view counts) --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "6a800cdc32cd47edb3f8e78ae11b47ec"}'></script><!-- End Cloudflare Web Analytics -->
</body>
</html>
`;
}

// "Hiring IT people in Europe?" offer, same as the home page (price and contact from config/site.json).
function employers(site) {
  const st = { price: 49, currency: 'EUR', days: 30, contactEmail: '', paymentLink: '', ...site };
  const price = new Intl.NumberFormat('en-GB', { style: 'currency', currency: st.currency, maximumFractionDigits: 0 }).format(st.price);
  const contact = st.contactEmail
    ? `<div class="contact"><span>${st.paymentLink ? 'After paying, send the job link to' : 'Send the job link to'}</span> <a href="mailto:${esc(st.contactEmail)}"><code>${esc(st.contactEmail)}</code></a></div>`
    : '<div class="contact">Contact details are being set up.</div>';
  return `<section class="wrap employers" id="employers" aria-labelledby="emp-title">
<div>
<h2 id="emp-title">Hiring IT people in Europe?</h2>
<p>Put your role at the top of the list for ${st.days} days. Candidates here are filtering for IT roles with a visible salary, so a featured job with a clear range gets seen first.</p>
<p>Your job is not listed yet? Send us the link to the posting and we add it and feature it at the same price.</p>
</div>
<div class="offer">
<div class="price">${esc(price)} <small>for ${st.days} days</small></div>
<ul>
<li>Pinned at the top of the list and highlighted</li>
<li>Shown first in every search and filter it matches</li>
<li>Links straight to your own posting; applications go to you</li>
<li>The salary range must be shown, like every job here</li>
</ul>
${st.paymentLink ? `<a class="cta" href="${esc(st.paymentLink)}" target="_blank" rel="noopener">Pay and feature a job</a>` : ''}
${contact}
</div>
</section>`;
}

// Returns [{ path: 'it-jobs/<slug>/index.html', url, html, total }] for every configured country.
export function buildCountryPages(jobs, { updated, config = {}, site = {} }) {
  const all = config.countries || [];
  return all.map((c) => {
    const html = countryPage(c, jobs, { updated, all, maxListed: config.maxListed || 600, site });
    return { path: `it-jobs/${c.slug}/index.html`, url: `${BASE}/it-jobs/${c.slug}/`, html, total: jobsIn(jobs, c.name).length };
  });
}
