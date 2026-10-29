// Picks 5 recent IT jobs with a published salary from site/jobs.json and posts them to the
// Cleartext Jobs Facebook Page. Runs from .github/workflows/social.yml (manual) and
// .github/workflows/social-pack.yml (Sunday: the three posts of the week, to schedule by hand).
//
//   node src/social.mjs            -> posts (needs FB_PAGE_ID and FB_PAGE_TOKEN)
//   node src/social.mjs --dry-run  -> prints the post, posts nothing
import { readFile } from 'node:fs/promises';

const SITE = 'https://cleartextjobs.com/';
const PER_POST = 5;
const PER_COMPANY = 2;

// Monday: Portugal. Wednesday: remote anywhere in Europe. Friday: Portugal and Spain.
const few = (j) => (j.countries || []).length <= MAX_COUNTRIES;
export const THEMES = {
  1: { title: 'vagas de IT em Portugal', match: (j) => few(j) && j.countries.includes('Portugal') },
  3: { title: 'vagas de IT remotas na Europa', match: (j) => j.workplace === 'Remote' },
  5: { title: 'vagas de IT em Portugal e Espanha', match: (j) => few(j) && (j.countries.includes('Portugal') || j.countries.includes('Spain')) },
};
// How far back each run looks first, so consecutive posts show different jobs.
const LOOKBACK = { 1: 3, 3: 2, 5: 2 };

// A country theme only uses jobs tied to at most this many countries; "Germany | Remote"
// roles listed in 4+ countries rarely pay the shown range in Portugal or Spain.
const MAX_COUNTRIES = 3;

const PT_NAMES = {
  Portugal: 'Portugal', Spain: 'Espanha', France: 'França', Germany: 'Alemanha', Netherlands: 'Países Baixos', Belgium: 'Bélgica',
  Luxembourg: 'Luxemburgo', Ireland: 'Irlanda', 'United Kingdom': 'Reino Unido', Italy: 'Itália', Switzerland: 'Suíça', Austria: 'Áustria',
  Denmark: 'Dinamarca', Sweden: 'Suécia', Norway: 'Noruega', Finland: 'Finlândia', Poland: 'Polónia', 'Czech Republic': 'Chéquia',
  Slovakia: 'Eslováquia', Hungary: 'Hungria', Romania: 'Roménia', Bulgaria: 'Bulgária', Greece: 'Grécia', Croatia: 'Croácia',
  Slovenia: 'Eslovénia', Serbia: 'Sérvia', Estonia: 'Estónia', Latvia: 'Letónia', Lithuania: 'Lituânia', Cyprus: 'Chipre', Malta: 'Malta',
};
const CITY_PT = { Lisbon: 'Lisboa', Berlin: 'Berlim', Hamburg: 'Hamburgo', Cologne: 'Colónia', Barcelona: 'Barcelona', Seville: 'Sevilha', Munich: 'Munique', Warsaw: 'Varsóvia', Prague: 'Praga', Vienna: 'Viena',
  Copenhagen: 'Copenhaga', Brussels: 'Bruxelas', London: 'Londres', Milan: 'Milão', Rome: 'Roma', Athens: 'Atenas', Geneva: 'Genebra', Zurich: 'Zurique' };

export function place(j) {
  const cs = j.countries || [];
  const where = cs.length > MAX_COUNTRIES ? `${cs.length} países da Europa` : cs.map((c) => PT_NAMES[c] || c).join(', ');
  // A city is the first part of the location when it is not itself a country or a count.
  let city = (j.location || '').split(/[,/|]/)[0].trim();
  if (!city || /countries|europe|remote/i.test(city) || cs.includes(city) || Object.values(PT_NAMES).includes(city)) city = '';
  city = CITY_PT[city] || city;
  return city && cs.length === 1 ? `${city}, ${where}` : where || city;
}

const SYMBOL = { EUR: '€', GBP: '£', CHF: 'CHF ' };
const PERIOD = { year: '/ano', month: '/mês', hour: '/hora', day: '/dia', week: '/semana' };

export function money(s) {
  const n = (v) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sym = SYMBOL[s.currency] ?? `${s.currency} `;
  const range = s.max && s.max !== s.min ? `${n(s.min)}–${n(s.max)}` : n(s.min);
  return `${sym}${range}${PERIOD[s.period] ?? ''}`;
}

const daysAgo = (date, now) => (now - Date.parse(date + 'T00:00:00Z')) / 86400000;

export function pick(jobs, weekday, now = Date.now()) {
  const theme = THEMES[weekday];
  if (!theme) return null;
  const pool = jobs.filter((j) => j.salary && !j.featured && theme.match(j));
  // One job per company, widening the date window first; a second job from the same
  // company only when even 30 days do not give enough different companies.
  for (const [limit, days] of [[1, LOOKBACK[weekday]], [1, 7], [1, 14], [1, 30], [1, 120], [PER_COMPANY, 30], [PER_COMPANY, 120]]) {
    const recent = pool.filter((j) => j.posted && daysAgo(j.posted, now) <= days);
    // Euro, yearly salaries first (easiest to compare), then newest.
    recent.sort((a, b) =>
      (b.salary.currency === 'EUR') - (a.salary.currency === 'EUR') ||
      (b.salary.period === 'year') - (a.salary.period === 'year') ||
      b.posted.localeCompare(a.posted));
    const chosen = [];
    const perCompany = {};
    const seen = new Set();
    // Each company's first job before any company's second job.
    for (let cap = 1; cap <= limit; cap++) {
      for (const j of recent) {
        const key = `${j.company}|${j.title.toLowerCase()}`;
        if (seen.has(key) || (perCompany[j.company] || 0) >= cap) continue;
        seen.add(key);
        perCompany[j.company] = (perCompany[j.company] || 0) + 1;
        chosen.push(j);
        if (chosen.length === PER_POST) return { theme, jobs: chosen };
      }
    }
    if (days === 120 && limit === PER_COMPANY && chosen.length >= 3) return { theme, jobs: chosen };
  }
  return null;
}

const WORK = { Remote: 'Remoto', Hybrid: 'Híbrido', 'On-site': 'Presencial' };

export function compose({ theme, jobs }) {
  const lines = jobs.map((j) => {
    const where = [place(j), WORK[j.workplace]].filter(Boolean).join(' · ');
    return `💼 ${j.title} — ${j.company}\n💶 ${money(j.salary)}\n📍 ${where}`;
  });
  return [
    `${jobs.length} ${theme.title} com o salário à vista 👇`,
    lines.join('\n\n'),
    `Estas e mais de 2.000 vagas de IT na Europa, com filtros por país, modelo de trabalho e "só com salário". Sem registo, cada vaga leva ao anúncio original:\n${SITE}`,
    '#empregoIT #vagasIT #tecnologia #salario',
  ].join('\n\n');
}

// Instagram: links in captions are not clickable, so the caption points to the bio.
export function composeInstagram({ theme, jobs }) {
  const lines = jobs.map((j) => `• ${j.title} — ${j.company}: ${money(j.salary)}`);
  return [
    `${jobs.length} ${theme.title} com o salário à vista 👀`,
    lines.join('\n'),
    'Mais de 2.000 vagas de IT na Europa, sem registo e com link para o anúncio original: link na bio (cleartextjobs.com).',
    '#empregoIT #vagasIT #tecnologia #programadores #salario #transparenciasalarial #trabalhoremoto',
  ].join('\n\n');
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PERIOD_PT = { year: 'por ano', month: 'por mês', hour: 'por hora', day: 'por dia', week: 'por semana' };
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// HTML for each 1080x1350 carousel slide, in the site's style. Rendered to JPEG by src/render.mjs.
export function slides({ theme, jobs }, { total = 2000, date = new Date(), fonts = 'fonts' } = {}) {
  const day = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  const css = `
@font-face{font-family:IS;src:url(${fonts}/instrument-sans-latin-400-normal.woff2);font-weight:400}
@font-face{font-family:IS;src:url(${fonts}/instrument-sans-latin-600-normal.woff2);font-weight:600}
@font-face{font-family:IS;src:url(${fonts}/instrument-sans-latin-700-normal.woff2);font-weight:700}
@font-face{font-family:MM;src:url(${fonts}/martian-mono-latin-400-normal.woff2);font-weight:400}
@font-face{font-family:MM;src:url(${fonts}/martian-mono-latin-700-normal.woff2);font-weight:700}
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1350px;background:#F1F4F8;color:#131B2A;font-family:IS,sans-serif;padding:96px 88px;display:flex;flex-direction:column}
.top,.bot{font-family:MM;font-size:26px;color:#56617A;display:flex;justify-content:space-between}
.bot{font-size:24px}
.mid{flex:1;display:flex;flex-direction:column;justify-content:center;gap:34px}
h1{font-size:100px;line-height:1.02;letter-spacing:-.03em;font-weight:700}
h2{font-size:64px;line-height:1.08;letter-spacing:-.02em;font-weight:700;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
h2.long{font-size:50px}
.co{font-size:46px;font-weight:600}
.mark{display:inline-block;background:#FFE45C;color:#191708;font-family:MM;font-weight:700;padding:10px 22px}
.sal{font-size:68px}
.meta{font-size:38px;color:#56617A;display:flex;gap:34px;flex-wrap:wrap}
.lede{font-size:44px;color:#56617A;line-height:1.3}
.lede b{color:#131B2A}
.k{color:#56617A;font-family:MM;font-size:40px}`;
  const n = jobs.length + 2;
  const frame = (i, body) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="top"><span>Cleartext Jobs / IT, Europe</span><span>${i}/${n}</span></div>
<div class="mid">${body}</div>
<div class="bot"><span>Recolha de ${day}</span><span>${i < n ? 'desliza →' : ''}</span></div></body></html>`;
  const rounded = Math.floor(total / 100) * 100;
  return [
    frame(1, `<h1>${jobs.length} ${esc(theme.title)} com o salário à vista.</h1><div><span class="mark sal">€ à vista</span></div><p class="lede">Sem "salário competitivo". Valores publicados pelas próprias empresas.</p>`),
    ...jobs.map((j, k) => {
      const meta = [place(j), WORK[j.workplace], PERIOD_PT[j.salary.period]].filter(Boolean);
      return frame(k + 2, `<p class="k">salary =</p><div><span class="mark sal">${esc(money(j.salary).replace(/\/\S+$/, ''))}</span></div><h2${j.title.length > 60 ? ' class="long"' : ''}>${esc(j.title)}</h2><p class="co">${esc(j.company)}</p><div class="meta">${meta.map((m) => `<span>${esc(m)}</span>`).join('')}</div>`);
    }),
    frame(n, `<h1>Mais de ${String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} vagas de IT na Europa.</h1><p class="lede">Filtra por país, remoto ou híbrido, nível e <b>"só com salário"</b>. Sem registo, sem CV. Cada vaga leva ao anúncio original.</p><div><span class="mark" style="font-size:44px">Link na bio</span></div><p class="k" style="font-size:34px">cleartextjobs.com</p>`),
  ];
}

// ---- Publishing -------------------------------------------------------------------------
const GRAPH = 'https://graph.facebook.com';

async function graph(path, params, method = 'POST') {
  const url = `${GRAPH}/${path}`;
  const r = method === 'GET'
    ? await fetch(`${url}?${new URLSearchParams(params)}`)
    : await fetch(url, { method, body: new URLSearchParams(params) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.error) throw new Error(`${path}: ${JSON.stringify(body.error || body)}`);
  return body;
}

async function postFacebook(page, token, message) {
  const { id } = await graph(`${page}/feed`, { message, link: SITE, access_token: token });
  console.log(`Facebook: posted ${id}`);
}

async function postInstagram(page, token, caption, imageUrls) {
  const { instagram_business_account: ig } = await graph(page, { fields: 'instagram_business_account', access_token: token }, 'GET');
  if (!ig?.id) throw new Error('No Instagram account is linked to the Facebook Page.');
  const children = [];
  for (const image_url of imageUrls) {
    const { id } = await graph(`${ig.id}/media`, { image_url, is_carousel_item: 'true', access_token: token });
    children.push(id);
  }
  const { id: carousel } = await graph(`${ig.id}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption, access_token: token });
  // Wait until Instagram has fetched and processed the images.
  for (let i = 0; i < 30; i++) {
    const { status_code } = await graph(carousel, { fields: 'status_code', access_token: token }, 'GET');
    if (status_code === 'FINISHED') break;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`Instagram could not process the images (${status_code}).`);
    await new Promise((res) => setTimeout(res, 5000));
  }
  const { id } = await graph(`${ig.id}/media_publish`, { creation_id: carousel, access_token: token });
  console.log(`Instagram: posted ${id}`);
}

// Steps, run by .github/workflows/social.yml:
//   --plan  : choose today's jobs, write social-out/plan.json and the slide HTML; print the texts
//   --post  : publish the plan (Facebook text + link, Instagram carousel from the published images)
async function main() {
  const out = new URL('../social-out/', import.meta.url);
  const { mkdir, writeFile } = await import('node:fs/promises');
  if (process.argv.includes('--plan')) {
    const data = JSON.parse(await readFile(new URL('../site/jobs.json', import.meta.url), 'utf8'));
    const weekday = Number(process.env.WEEKDAY || new Date().getUTCDay());
    // USED_FILE (optional): jobs already chosen for another post this week are skipped.
    const usedFile = process.env.USED_FILE;
    const key = (j) => `${j.company}|${j.title.toLowerCase()}`;
    let used = [];
    if (usedFile) { try { used = JSON.parse(await readFile(usedFile, 'utf8')); } catch { used = []; } }
    const picked = pick(data.jobs.filter((j) => !used.includes(key(j))), weekday);
    await mkdir(out, { recursive: true });
    if (picked && usedFile) await writeFile(usedFile, JSON.stringify([...used, ...picked.jobs.map(key)]));
    if (!picked) { console.log(`Nothing to post for weekday ${weekday}.`); await writeFile(new URL('plan.json', out), 'null'); return; }
    const stamp = new Date().toISOString().slice(0, 10);
    const html = slides(picked, { total: data.total });
    const plan = { stamp, facebook: compose(picked), instagram: composeInstagram(picked), images: html.map((_, i) => `social/${stamp}/${String(i + 1).padStart(2, '0')}.jpg`) };
    await writeFile(new URL('plan.json', out), JSON.stringify(plan, null, 2));
    await writeFile(new URL('slides.json', out), JSON.stringify(html));
    console.log(`--- Facebook ---\n${plan.facebook}\n\n--- Instagram ---\n${plan.instagram}\n\n${plan.images.length} images`);
    return;
  }
  if (process.argv.includes('--post')) {
    const plan = JSON.parse(await readFile(new URL('plan.json', out), 'utf8'));
    if (!plan) return;
    const { FB_PAGE_ID: page, FB_PAGE_TOKEN: token } = process.env;
    if (!page || !token) { console.error('FB_PAGE_ID and FB_PAGE_TOKEN secrets are missing; nothing posted.'); process.exit(1); }
    let failed = false;
    try { await postFacebook(page, token, plan.facebook); } catch (e) { failed = true; console.error('Facebook refused the post:', e.message); }
    try { await postInstagram(page, token, plan.instagram, plan.images.map((p) => SITE + p)); } catch (e) { failed = true; console.error('Instagram refused the post:', e.message); }
    if (failed) process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
