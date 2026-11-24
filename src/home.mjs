// Writes the first page of jobs, the counts and the employer offer into the home page HTML,
// so search engines (and visitors before the script runs) see real content instead of "Loading jobs…".
// The page script still loads jobs.json and re-renders the list with the visitor's filters.
// Safe to run again on an already filled page: each slot is replaced, not appended to.
const nf = new Intl.NumberFormat('en-GB');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const SYM = { EUR: '€', GBP: '£', CHF: 'CHF ', PLN: 'PLN ', SEK: 'SEK ', DKK: 'DKK ', NOK: 'NOK ', CZK: 'CZK ', HUF: 'HUF ', RON: 'RON ', BGN: 'BGN ' };
const PER = { year: 'a year', month: 'a month', day: 'a day', hour: 'an hour' };
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const money = (s) => { const c = SYM[s.currency] ?? `${s.currency} `; return s.min === s.max ? `${c}${nf.format(s.min)}` : `${c}${nf.format(s.min)}–${nf.format(s.max)}`; };
const icon = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 3H3v10h10v-3M9 3h4v4M13 3 7 9"/></svg>';

function ago(iso, now) {
  if (!iso) return '';
  const d = Math.floor((now - Date.parse(iso)) / 864e5);
  return d <= 0 ? 'Posted today' : d === 1 ? 'Posted yesterday' : d < 60 ? `Posted ${d} days ago` : `Posted ${fmtDate(iso)}`;
}

// Same markup as row() in site/index.html, so nothing moves when the script takes over.
function row(j, now) {
  const s = j.salary;
  const pay = s
    ? `<mark class="sal">${esc(money(s))}</mark><span class="per">${PER[s.period] || ''}${s.note ? ', varies by location' : ''}</span>`
    : '<span class="none">Salary not published</span>';
  const meta = [j.location, j.workplace, j.seniority, ago(j.posted, now)].filter(Boolean).map((m) => `<span>${esc(m)}</span>`).join('');
  const stack = j.stack && j.stack.length ? `<div class="stack">${j.stack.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : '';
  const via = j.source === 'arbeitnow' ? ' <span class="via">via <a href="https://www.arbeitnow.com" target="_blank" rel="noopener">Arbeitnow</a></span>' : '';
  return `<li class="job${j.featured ? ' featured' : ''}">
      <div class="head"><h2><a href="${esc(j.url)}" target="_blank" rel="noopener">${esc(j.title)}</a>${j.featured ? '<span class="badge">Featured</span>' : ''}</h2><div class="co">${esc(j.company)}</div></div>
      <div class="pay">${pay}</div>
      <div class="body"><div class="meta">${meta}</div>${stack}
      <a class="go" href="${esc(j.url)}" target="_blank" rel="noopener">View original posting ${icon}</a>${via}</div>
    </li>`;
}

// Default order of the page: featured first, then jobs with a salary, newest first.
const defaultOrder = (jobs) => [...jobs].sort((a, b) => (!!b.featured - !!a.featured) || (!!b.salary - !!a.salary) || (b.posted || '').localeCompare(a.posted || ''));

function fill(html, re, inner) {
  if (!re.test(html)) throw new Error(`Home page slot not found: ${re}`);
  return html.replace(re, (m, open, _old, close) => open + inner + close);
}

export function prerenderHome(html, data, { now = Date.now(), perPage = 10 } = {}) {
  const jobs = data.jobs || [];
  const site = { price: 49, currency: 'EUR', days: 30, contactEmail: '', paymentLink: '', ...(data.site || {}) };
  const total = data.total ?? jobs.length;
  const withSal = data.withSalary ?? jobs.filter((j) => j.salary).length;
  const companies = data.companies ?? new Set(jobs.map((j) => j.company)).size;
  const first = defaultOrder(jobs).slice(0, perPage);
  const pages = Math.max(1, Math.ceil(jobs.length / perPage));
  const price = new Intl.NumberFormat('en-GB', { style: 'currency', currency: site.currency, maximumFractionDigits: 0 }).format(site.price);
  const contact = site.contactEmail
    ? `<span>${site.paymentLink ? 'After paying, send the job link to' : 'Send the job link to'}</span> <code id="mail">${esc(site.contactEmail)}</code>`
    : 'Contact details are being set up.';

  let out = html;
  out = fill(out, /(<span id="updated">)([\s\S]*?)(<\/span>)/, data.updated ? `Updated ${fmtDate(data.updated)}` : '');
  out = fill(out, /(<p class="lede" id="lede">)([\s\S]*?)(<\/p>)/,
    `<strong>${nf.format(total)}</strong> open IT roles from <strong>${nf.format(companies)}</strong> companies, collected from their own job boards. <strong>${nf.format(withSal)}</strong> show the salary.`);
  out = fill(out, /(<span class="count" id="count" aria-live="polite">)([\s\S]*?)(<\/span>)/, `${nf.format(jobs.length)} ${jobs.length === 1 ? 'job' : 'jobs'}`);
  out = fill(out, /(<ul class="jobs" id="list">)([\s\S]*?)(<\/ul>)/, first.map((j) => row(j, now)).join(''));
  out = fill(out, /(<span id="pinfo" aria-live="polite">)([\s\S]*?)(<\/span>)/, `Page 1 of ${nf.format(pages)}`);
  out = fill(out, /(<div class="price" id="offer-price">)([\s\S]*?)(<\/div>)/, `${esc(price)} <small>for ${site.days} days</small>`);
  out = fill(out, /(<div class="contact" id="contact">)([\s\S]*?)(<\/div>)/, contact);
  // The list is already there: no reserved space needed, and show the page controls.
  out = out.replace('<main class="wrap" id="main" aria-busy="true">', '<main class="wrap" id="main">');
  out = out.replace('<button type="button" id="prev">', '<button type="button" id="prev" disabled>');
  if (jobs.length > perPage) out = out.replace('<nav class="pager" id="pager" aria-label="Pages" hidden>', '<nav class="pager" id="pager" aria-label="Pages">');
  return out;
}
