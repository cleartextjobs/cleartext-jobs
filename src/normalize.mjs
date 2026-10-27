// Turns raw postings from each source into one common shape and decides
// which ones belong on Cleartext Jobs (IT roles, located in Europe).
// No Node-only APIs here, so the same code also runs in a browser.

// ---------- text helpers ----------
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', euro: '€', pound: '£' };
export function decodeEntities(s = '') {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}
export function htmlToText(html = '') {
  // Greenhouse content arrives HTML-escaped, so decode twice around tag stripping.
  return decodeEntities(decodeEntities(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// ---------- Europe ----------
const COUNTRIES = {
  'Portugal': ['portugal', 'lisbon', 'lisboa', 'porto', 'braga', 'coimbra', 'aveiro'],
  'Spain': ['spain', 'españa', 'espana', 'madrid', 'barcelona', 'valencia', 'malaga', 'málaga', 'seville', 'sevilla', 'bilbao'],
  'France': ['france', 'paris', 'lyon', 'marseille', 'toulouse', 'nantes', 'lille', 'bordeaux', 'montpellier'],
  'Germany': ['germany', 'deutschland', 'berlin', 'munich', 'münchen', 'munchen', 'hamburg', 'frankfurt', 'cologne', 'köln', 'koln', 'stuttgart', 'düsseldorf', 'dusseldorf', 'leipzig', 'dresden', 'hannover', 'nuremberg', 'nürnberg', 'karlsruhe', 'bonn', 'essen', 'dortmund', 'bremen', 'mannheim', 'heidelberg', 'potsdam'],
  'Netherlands': ['netherlands', 'amsterdam', 'rotterdam', 'utrecht', 'eindhoven', 'the hague', 'den haag'],
  'Belgium': ['belgium', 'brussels', 'bruxelles', 'antwerp', 'ghent', 'gent'],
  'Luxembourg': ['luxembourg'],
  'Ireland': ['ireland', 'dublin', 'cork', 'galway'],
  'United Kingdom': ['united kingdom', 'england', 'scotland', 'wales', 'london', 'manchester', 'edinburgh', 'glasgow', 'bristol', 'cambridge', 'oxford', 'leeds', 'birmingham', 'belfast'],
  'Italy': ['italy', 'italia', 'milan', 'milano', 'rome', 'roma', 'turin', 'torino', 'bologna', 'florence'],
  'Switzerland': ['switzerland', 'zurich', 'zürich', 'geneva', 'genève', 'basel', 'lausanne', 'bern'],
  'Austria': ['austria', 'österreich', 'vienna', 'wien', 'graz', 'linz'],
  'Denmark': ['denmark', 'copenhagen', 'københavn', 'aarhus'],
  'Sweden': ['sweden', 'stockholm', 'gothenburg', 'göteborg', 'malmö', 'malmo'],
  'Norway': ['norway', 'oslo'],
  'Finland': ['finland', 'helsinki', 'espoo', 'tampere'],
  'Poland': ['poland', 'polska', 'warsaw', 'warszawa', 'krakow', 'kraków', 'wroclaw', 'wrocław', 'gdansk', 'gdańsk', 'poznan', 'poznań'],
  'Czech Republic': ['czech', 'czechia', 'prague', 'praha', 'brno'],
  'Slovakia': ['slovakia', 'bratislava'],
  'Hungary': ['hungary', 'budapest'],
  'Romania': ['romania', 'bucharest', 'cluj', 'iasi', 'iași'],
  'Bulgaria': ['bulgaria', 'sofia'],
  'Greece': ['greece', 'athens'],
  'Croatia': ['croatia', 'zagreb'],
  'Slovenia': ['slovenia', 'ljubljana'],
  'Serbia': ['serbia', 'belgrade', 'novi sad'],
  'Estonia': ['estonia', 'tallinn'],
  'Latvia': ['latvia', 'riga'],
  'Lithuania': ['lithuania', 'vilnius', 'kaunas'],
  'Cyprus': ['cyprus', 'limassol', 'nicosia'],
  'Malta': ['malta'],
};
const ISO2 = { PT: 'Portugal', ES: 'Spain', FR: 'France', DE: 'Germany', NL: 'Netherlands', BE: 'Belgium', LU: 'Luxembourg', IE: 'Ireland', GB: 'United Kingdom', UK: 'United Kingdom', IT: 'Italy', CH: 'Switzerland', AT: 'Austria', DK: 'Denmark', SE: 'Sweden', NO: 'Norway', FI: 'Finland', PL: 'Poland', CZ: 'Czech Republic', SK: 'Slovakia', HU: 'Hungary', RO: 'Romania', BG: 'Bulgaria', GR: 'Greece', HR: 'Croatia', SI: 'Slovenia', RS: 'Serbia', EE: 'Estonia', LV: 'Latvia', LT: 'Lithuania', CY: 'Cyprus', MT: 'Malta' };
const EUROPE_REGION = /\b(europe|european|emea|\beu\b|cet|cest)\b/i;
const NON_EUROPE = /\b(united states|usa|us|u\.s\.|americas|latam|apac|apj|canada|brazil|brasil|mexico|india|singapore|australia|new south wales|new zealand|japan|china|hong kong|taiwan|korea|seoul|vietnam|indonesia|malaysia|argentina|colombia|chile|peru|philippines|israel|uae|dubai|saudi|qatar|south africa|nigeria|kenya|egypt|new york|san francisco|los angeles|toronto|montreal|vancouver|austin|seattle|boston|chicago|denver|atlanta|dallas|miami|washington|sao paulo|são paulo|bangalore|bengaluru|tokyo|sydney|melbourne|auckland)\b/i;
const EURO_CURRENCIES = new Set(['EUR', 'GBP', 'CHF', 'PLN', 'SEK', 'DKK', 'NOK', 'CZK', 'HUF', 'RON', 'BGN', 'ISK']);
const GLOBAL_REMOTE = /\b(anywhere|worldwide|global)\b/i;

export function countriesIn(text = '') {
  const out = [];
  // Look at each location separately and skip the ones outside Europe,
  // so "Sydney, New South Wales" never counts as Wales.
  for (const seg of String(text).split(/[;|]/)) {
    if (NON_EUROPE.test(seg)) continue;
    const t = ' ' + seg.toLowerCase() + ' ';
    for (const [country, words] of Object.entries(COUNTRIES)) {
      if (!out.includes(country) && words.some((w) => new RegExp(`(^|[^a-zà-ÿ])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-zà-ÿ]|$)`).test(t))) out.push(country);
    }
  }
  return out;
}

// ---------- IT roles ----------
const FAMILY_RULES = [
  ['Security', /\b(security|secops|soc analyst|pentest|penetration|appsec|cyber|iam engineer|grc)\b/i],
  ['Data & AI', /\b(data|machine learning|\bml\b|mlops|\bai\b|artificial intelligence|analytics|analyst bi|\bbi\b|business intelligence|scientist|llm|nlp|computer vision|research engineer|deep learning|ki-entwickler)\b/i],
  ['Cloud & infrastructure', /\b(devops|sre|site reliability|platform|infrastructure|infra|cloud|kubernetes|network|sysadmin|system administrator|systemadministrator|it operations|it engineer|it specialist|it support|linux|database administrator|dba|administrador de sistemas|técnico de sistemas|tecnico de sistemas|sistemas e redes|helpdesk|service desk)\b/i],
  ['Quality', /\b(qa|quality assurance|test automation|tester|sdet|testing)\b/i],
  ['Product & design', /\b(product manager|product owner|product designer|ux|ui designer|ux\/ui|ui\/ux|technical writer|design engineer)\b/i],
  ['Technical support', /\b(support engineer|technical support|technical account manager|solutions engineer|solution engineer|sales engineer|customer engineer|implementation engineer|integration engineer|forward deployed|solutions architect|technical consultant|sap|salesforce|erp|crm consultant)\b/i],
  ['Engineering leadership', /\b(engineering manager|head of engineering|vp engineering|vp of engineering|director of engineering|cto|chief technology|tech lead|technical lead|team lead engineering|it manager|head of it|head of data|head of platform)\b/i],
  ['Software development', /\b(software|developer|engineer|entwickler|programmer|frontend|front-end|backend|back-end|full[- ]?stack|mobile|ios|android|web developer|embedded|firmware|architect|game developer|informatiker|programador|programadora|desenvolvedor|desenvolvedora|desarrollador|desarrolladora|engenheiro de software|ingeniero de software|informática|informatica)\b/i],
];
// Most specific first: a "Product Security Engineer" is Security, a "Mobile Engineer, Platform" is Software.
const F = Object.fromEntries(FAMILY_RULES);
const SOFTWARE_STRONG = /\b(software engineer|software developer|developer|entwickler|programador|programadora|desenvolvedor|desenvolvedora|desarrollador|desarrolladora|frontend|front-end|backend|back-end|full[- ]?stack|mobile|ios|android|web developer|embedded|firmware|compiler)\b/i;
const CLASSIFY_ORDER = [
  ['Engineering leadership', F['Engineering leadership']], ['Security', F['Security']], ['Product & design', F['Product & design']],
  ['Data & AI', F['Data & AI']], ['Quality', F['Quality']], ['Technical support', F['Technical support']],
  ['Software development', SOFTWARE_STRONG], ['Cloud & infrastructure', F['Cloud & infrastructure']], ['Software development', F['Software development']],
];
// Titles that mention a tech word but are not IT jobs.
const NOT_IT = /\b(account executive|sales manager|sales representative|sales specialist|marketing|seo|content|copywriter|finance manager|controller|hr |human resources|office manager|customer service|customer support specialist|customer success manager|kundenservice|electrician|elektroniker|mechanic)\b/i;
// Never IT, even when the title says "developer" or "engineer" (e.g. "Recipe Developer", "Business Developer").
const NEVER_IT = /\b(physical security|export control|foreign trade|supply chain|logistics|lab engineer|laboratory|electromobility|high-voltage|mechanical|ebike|passive safety|recipe|culinary|chef|cook|doctor|nurse|physician|pharmacist|driver|warehouse|hausmeister|brandschutz|callcenter|business developer|business development|legal|lawyer|counsel|paralegal|accountant|accounting|recruiter|talent acquisition|people &|people and|people partner|people experience|workplace experience)\b/i;
const NON_SOFTWARE_ENGINEER = /\b(civil|mechanical|electrical|hardware|structural|process|chemical|manufacturing|field service|maintenance|hvac|elektrotechnik|construction|sales|industrial|electronics?|radar|mechatronics|automotive|optical|thermal|plant|production|equipment|wafer(-level)?|analog|semiconductor|lithography|power electronics|rf|pcb|asic|ic design|packaging|purchasing|supplier|customer quality|production quality)\b(\s+(?!software|data|cloud|ai|ml|security|devops|platform|systems|embedded)[a-z&/-]+)?\s+(engineer|ingenieur|entwickler|developer)/i;
// "Quality engineer" and "reliability engineer" are usually manufacturing roles unless the title says software, QA or site reliability.
const NON_IT_QUALITY = /\b(quality|reliability)\s+engineer/i;

// strict: for large non-tech employers, a bare "engineer" or "architect" is not enough to call a role IT.
const STRICT_SOFTWARE = /\b(software|developer|programmer|programador|desenvolvedor|desarrollador|frontend|front-end|backend|back-end|full[- ]?stack|web|mobile|ios|android|embedded software|firmware|(enterprise|solution|software|it|cloud|data) architect)\b/i;
export function classify(title = '', dept = '', { strict = false } = {}) {
  const t = clean(title);
  if (NEVER_IT.test(t)) return null;
  if (NOT_IT.test(t + ' ') && !/\b(engineer|developer|entwickler)\b/i.test(t)) return null;
  if (/\bsales\b/i.test(t) && !/\bsales engineer/i.test(t)) return null;
  if (NON_SOFTWARE_ENGINEER.test(t)) return null;
  if (NON_IT_QUALITY.test(t) && !/\b(software|qa|test automation|site reliability|data)\b/i.test(t)) return null;
  // Leadership first when the title is clearly a management role.
  for (const [family, re] of CLASSIFY_ORDER) {
    if (strict && re === F['Software development']) { if (STRICT_SOFTWARE.test(t)) return family; continue; }
    if (re.test(t)) return family;
  }
  if (strict) return null;
  // Fall back on the department for generic titles like "Senior Associate".
  if (/\b(engineering|technology|it|data|security|infrastructure|product development)\b/i.test(dept) && /\b(engineer|developer|architect|administrator)\b/i.test(t)) return 'Software development';
  return null;
}

export function seniority(title = '') {
  const t = title.toLowerCase();
  if (/\b(intern|internship|werkstudent|working student|trainee|graduate|apprentice|praktikum|stage|stagiaire|ausbildung|estágio|estagio|prácticas|practicas|becario|becaria)\b/.test(t)) return 'Intern / graduate';
  if (/\b(junior|júnior|jr\.?|entry[- ]level|associate engineer)\b/.test(t)) return 'Junior';
  if (/\b(head of|director|vp|vice president|chief|cto|engineering manager|manager)\b/.test(t)) return 'Manager';
  if (/\b(principal|staff|lead|architect)\b/.test(t)) return 'Lead / principal';
  if (/\b(senior|sénior|sr\.?|expert)\b/.test(t)) return 'Senior';
  if (/\b(mid|medior|intermediate)\b/.test(t)) return 'Mid';
  return '';
}

// ---------- stack ----------
const STACK = [
  ['Python', /\bpython\b/i], ['Java', /\bjava\b(?!script)/i], ['Kotlin', /\bkotlin\b/i], ['Go', /\b(golang|Go(?= (developer|engineer)|,|\/| and ))\b/], ['TypeScript', /\btypescript\b/i],
  ['JavaScript', /\bjavascript\b/i], ['React', /\breact\b(?!ive)/i], ['React Native', /\breact native\b/i], ['Angular', /\bangular\b/i], ['Vue', /\bvue(\.js)?\b/i],
  ['Node.js', /\bnode(\.js|js)?\b/i], ['.NET', /\.net\b/i], ['C#', /\bc#/i], ['C++', /\bc\+\+/i], ['Rust', /\brust\b/i], ['Ruby', /\bruby\b/i], ['PHP', /\bphp\b/i],
  ['Scala', /\bscala\b/i], ['Swift', /\bswift\b/i], ['Elixir', /\belixir\b/i], ['Kubernetes', /\bkubernetes|\bk8s\b/i], ['Docker', /\bdocker\b/i], ['Terraform', /\bterraform\b/i],
  ['AWS', /\baws\b|amazon web services/i], ['Azure', /\bazure\b/i], ['GCP', /\bgcp\b|google cloud/i], ['PostgreSQL', /\bpostgres(ql)?\b/i], ['SQL', /\bsql\b/i],
  ['Kafka', /\bkafka\b/i], ['Spark', /\bspark\b/i], ['Snowflake', /\bsnowflake\b/i], ['dbt', /\bdbt\b/i], ['Airflow', /\bairflow\b/i], ['PyTorch', /\bpytorch\b/i],
  ['TensorFlow', /\btensorflow\b/i], ['LLMs', /\bllms?\b|large language model/i], ['SAP', /\bsap\b/i], ['Salesforce', /\bsalesforce\b/i], ['Linux', /\blinux\b/i],
];
export function extractStack(title = '', text = '', max = 6) {
  const hay = `${title} ${title} ${text}`;
  const found = [];
  for (const [name, re] of STACK) {
    const m = hay.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'));
    if (m) found.push([name, m.length]);
  }
  const names = found.sort((a, b) => b[1] - a[1]).map(([n]) => n);
  // Prefer the more specific tag when both appear.
  return names.filter((n) => !(n === 'SQL' && names.includes('PostgreSQL')) && !(n === 'JavaScript' && names.includes('TypeScript'))).slice(0, max);
}

// ---------- salary ----------
const CUR = { '€': 'EUR', 'eur': 'EUR', 'euro': 'EUR', 'euros': 'EUR', '£': 'GBP', 'gbp': 'GBP', 'chf': 'CHF', 'pln': 'PLN', 'zł': 'PLN', 'sek': 'SEK', 'dkk': 'DKK', 'nok': 'NOK', 'czk': 'CZK', '$': 'USD', 'usd': 'USD' };
function num(s) {
  // "55.000" / "55,000" / "55 000" / "55k" / "72.8k"
  let x = String(s).trim().toLowerCase();
  const k = /k$/.test(x);
  x = x.replace(/k$/, '').replace(/\s/g, '');
  if (k) return Math.round(parseFloat(x.replace(',', '.')) * 1000);
  if (/^\d{1,3}([.,]\d{3})+$/.test(x)) return parseInt(x.replace(/[.,]/g, ''), 10);
  return Math.round(parseFloat(x.replace(',', '.')));
}
function periodFrom(text) {
  if (/(per|\/|a|an)\s?(hour|hr|stunde)|hourly|stündlich/i.test(text)) return 'hour';
  if (/(per|\/|a)\s?(day|tag)|daily|day rate|tagessatz/i.test(text)) return 'day';
  if (/(per|\/|a|pro)\s?(month|monat|mês|mes)|monthly|monatlich|mensal/i.test(text)) return 'month';
  return 'year';
}
const SAL_RE = new RegExp(
  String.raw`(€|£|\b(?:eur|euro|euros|gbp|chf|pln|sek|dkk|nok|czk)\b)?\s?(\d{1,3}(?:[.,\s]\d{3})+|\d{4,6}|\d{2,3}(?:[.,]\d)?\s?k?)\s?(€|£|\b(?:eur|euro|euros|gbp|chf|pln|sek|dkk|nok|czk)\b)?\s?(?:-|–|—|to|bis|até|a)\s?(€|£|\b(?:eur|euro|euros|gbp|chf|pln|sek|dkk|nok|czk)\b)?\s?(\d{1,3}(?:[.,\s]\d{3})+|\d{2,3}(?:[.,]\d)?\s?k|\d{4,6})\s?(€|£|\b(?:eur|euro|euros|gbp|chf|pln|sek|dkk|nok|czk)\b)?`,
  'gi'
);
export function salaryFromText(text = '') {
  const t = String(text);
  for (const m of t.matchAll(SAL_RE)) {
    const cur = [m[1], m[3], m[4], m[6]].find(Boolean);
    if (!cur) continue; // a range with no currency is too ambiguous (could be team size, years…)
    const currency = CUR[cur.toLowerCase()];
    if (!EURO_CURRENCIES.has(currency)) continue;
    let min = num(m[2]), max = num(m[5]);
    if (/k/i.test(m[5]) && !/k/i.test(m[2]) && min < 1000) min *= 1000; // "55-70k"
    if (!(min > 0 && max >= min)) continue;
    const around = t.slice(Math.max(0, m.index - 60), m.index + m[0].length + 60);
    const period = periodFrom(around);
    const plausible = { year: [12000, 600000], month: [800, 40000], day: [100, 3000], hour: [10, 400] }[period];
    if (min < plausible[0] || max > plausible[1] || max / min > 3) continue;
    return { min, max, currency, period, from: 'posting text' };
  }
  return null;
}
function intervalToPeriod(i = '') {
  const s = String(i).toLowerCase();
  if (s.includes('hour')) return 'hour';
  if (s.includes('day')) return 'day';
  if (s.includes('month')) return 'month';
  return 'year';
}

// ---------- workplace ----------
function workplaceFrom(...parts) {
  const t = parts.filter(Boolean).join(' ').toLowerCase();
  if (/hybrid|hybride|híbrido/.test(t)) return 'Hybrid';
  if (/remote|remoto|télétravail|teletrabajo|homeoffice|home office|fully distributed|100 ?% remote/.test(t)) return 'Remote';
  if (/on-?site|onsite|in office|office-based|presencial/.test(t)) return 'On-site';
  return '';
}

// Only strong phrases in the posting text count, since many company blurbs mention remote work in passing.
function workplaceFromText(text = '') {
  const t = String(text).toLowerCase();
  if (/\bhybrid (role|position|setup|model|working|work)\b|\bhybrid\b.{0,40}\b(office|days)\b/.test(t)) return 'Hybrid';
  if (/\b(fully remote|100% remote|remote[- ]first|remote position|this (role|position) is remote|work from anywhere)\b/.test(t)) return 'Remote';
  if (/\b(on-?site role|office-based|5 days (a week )?in the office|in-office)\b/.test(t)) return 'On-site';
  return '';
}
const companyClean = (c) => clean(c).replace(/^careers at\s+/i, '').replace(/\s+careers$/i, '');

// ---------- per-source parsers ----------
function base(o) {
  return {
    id: o.id, source: o.source, title: clean(o.title), company: clean(o.company), url: o.url,
    department: clean(o.department), locationText: clean(o.locationText), countries: o.countries || [],
    workplace: o.workplace || '', salary: o.salary || null, posted: o.posted || null, text: o.text || '',
  };
}

export function fromGreenhouse(token, j, companyName) {
  const text = htmlToText(j.content || '');
  const loc = j.location?.name || '';
  const offices = (j.offices || []).map((o) => o.location || o.name).filter(Boolean).join('; ');
  let salary = null;
  const pr = (j.pay_input_ranges || []).find((p) => p && p.min_cents && EURO_CURRENCIES.has(String(p.currency_type || '').toUpperCase()));
  if (pr) salary = { min: Math.round(pr.min_cents / 100), max: Math.round((pr.max_cents || pr.min_cents) / 100), currency: String(pr.currency_type).toUpperCase(), period: periodFrom(pr.title || ''), from: 'company' };
  return base({
    id: `gh-${token}-${j.id}`, source: 'greenhouse', title: j.title, company: companyName || j.company_name || token,
    url: j.absolute_url, department: (j.departments || []).map((d) => d.name).join(', '),
    locationText: [loc, offices].filter(Boolean).join('; '),
    workplace: workplaceFrom(loc, j.title) || workplaceFromText(text), salary: salary || salaryFromText(text),
    posted: j.first_published || j.updated_at, text,
  });
}

export function fromLever(token, p, companyName) {
  const c = p.categories || {};
  const locs = [c.location, ...(c.allLocations || [])].filter(Boolean);
  const text = clean([p.descriptionPlain, p.additionalPlain, ...(p.lists || []).map((l) => l.text + ' ' + htmlToText(l.content || ''))].join(' '));
  let salary = null;
  const sr = p.salaryRange;
  if (sr && sr.min && EURO_CURRENCIES.has(String(sr.currency || '').toUpperCase())) salary = { min: sr.min, max: sr.max || sr.min, currency: String(sr.currency).toUpperCase(), period: intervalToPeriod(sr.interval), from: 'company' };
  const wt = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site', 'on-site': 'On-site' }[String(p.workplaceType || '').toLowerCase()] || workplaceFrom(locs.join(' '), p.text) || workplaceFromText(text);
  const countries = [...new Set([...(ISO2[p.country] ? [ISO2[p.country]] : []), ...countriesIn(locs.join('; '))])];
  return base({
    id: `lv-${token}-${p.id}`, source: 'lever', title: p.text, company: companyName || token, url: p.hostedUrl,
    department: [c.department, c.team].filter(Boolean).join(' / '), locationText: [...new Set(locs)].join('; '), countries,
    workplace: wt, salary: salary || salaryFromText(text), posted: p.createdAt ? new Date(p.createdAt).toISOString() : null, text,
  });
}

export function fromAshby(token, j, companyName) {
  if (j.isListed === false) return null;
  const locs = [j.location, ...(j.secondaryLocations || []).map((s) => s.location)].filter(Boolean);
  const addrCountries = [j.address, ...(j.secondaryLocations || []).map((s) => s.address)]
    .map((a) => a?.postalAddress?.addressCountry).filter(Boolean);
  const countries = [...new Set([...addrCountries.flatMap((c) => countriesIn(c)), ...countriesIn(locs.join('; '))])];
  let salary = null;
  // Prefer the overall summary; if it is in a non-European currency, look for a European tier.
  const isSalary = (c) => c && c.compensationType === 'Salary' && c.minValue && EURO_CURRENCIES.has(c.currencyCode);
  const tiers = j.compensation?.compensationTiers || [];
  const comp = (j.compensation?.summaryComponents || []).find(isSalary) || tiers.flatMap((t) => t.components || []).find(isSalary);
  if (comp) salary = { min: comp.minValue, max: comp.maxValue || comp.minValue, currency: comp.currencyCode, period: intervalToPeriod(comp.interval), from: 'company' };
  if (salary && tiers.length > 1) salary.note = 'Range varies by location';
  const wt = { Remote: 'Remote', Hybrid: 'Hybrid', OnSite: 'On-site', Onsite: 'On-site' }[j.workplaceType] || (j.isRemote ? 'Remote' : workplaceFrom(locs.join(' '), j.title) || workplaceFromText(j.descriptionPlain));
  return base({
    id: `ab-${token}-${j.id}`, source: 'ashby', title: j.title, company: companyName || token, url: j.jobUrl,
    department: [j.department, j.team].filter(Boolean).join(' / '), locationText: [...new Set(locs)].join('; '), countries,
    workplace: wt, salary: salary || salaryFromText(j.descriptionPlain || ''), posted: j.publishedAt, text: j.descriptionPlain || '',
  });
}

export function fromArbeitnow(j) {
  const text = htmlToText(j.description || '');
  const loc = j.location || '';
  let countries = countriesIn(loc);
  // Arbeitnow often lists the city only; its country site (arbeitnow.nl, .fr, .co.uk…) tells us the country.
  const SITE = { 'arbeitnow.com': 'Germany', 'arbeitnow.de': 'Germany', 'arbeitnow.nl': 'Netherlands', 'arbeitnow.fr': 'France', 'arbeitnow.co.uk': 'United Kingdom', 'arbeitnow.ch': 'Switzerland', 'arbeitnow.at': 'Austria', 'arbeitnow.es': 'Spain', 'arbeitnow.ie': 'Ireland' };
  const host = (String(j.url || '').match(/^https?:\/\/(?:www\.)?([^/]+)/) || [])[1] || '';
  if (!countries.length && !NON_EUROPE.test(loc) && SITE[host]) countries = [SITE[host]];
  return base({
    id: `an-${j.slug}`, source: 'arbeitnow', title: j.title, company: j.company_name, url: j.url,
    department: (j.tags || []).join(', '), locationText: loc, countries,
    workplace: j.remote ? 'Remote' : workplaceFrom(loc, j.title), salary: salaryFromText(text),
    posted: j.created_at ? new Date(j.created_at * 1000).toISOString() : null, text,
  });
}

export function fromSmartRecruiters(token, p, companyName) {
  const l = p.location || {};
  const iso = String(l.country || '').toUpperCase();
  const countries = ISO2[iso] ? [ISO2[iso]] : countriesIn(l.fullLocation || '');
  const workplace = l.remote ? 'Remote' : l.hybrid ? 'Hybrid' : '';
  const company = companyName || p.company?.name || token;
  return base({
    id: `sr-${token}-${p.id}`, source: 'smartrecruiters', title: p.name, company,
    url: `https://jobs.smartrecruiters.com/${p.company?.identifier || token}/${p.id}`,
    department: [p.function?.label, p.department?.label, p.industry?.label].filter(Boolean).join(', '),
    locationText: [l.city, ISO2[iso] || ''].filter(Boolean).join(', ') || l.fullLocation || '', countries,
    workplace, salary: null, posted: p.releasedDate, text: '',
  });
}

export function fromRecruitee(token, o, companyName) {
  const text = htmlToText(`${o.description || ''} ${o.requirements || ''}`);
  const iso = String(o.country_code || '').toUpperCase();
  const countries = [...new Set([...(ISO2[iso] ? [ISO2[iso]] : []), ...countriesIn([o.city, o.country].filter(Boolean).join(', '))])];
  let salary = null;
  const s = o.salary || {};
  if (s.min && EURO_CURRENCIES.has(String(s.currency || '').toUpperCase())) salary = { min: +s.min, max: +(s.max || s.min), currency: String(s.currency).toUpperCase(), period: intervalToPeriod(s.period), from: 'company' };
  const workplace = o.remote ? 'Remote' : o.hybrid ? 'Hybrid' : o.on_site ? 'On-site' : workplaceFromText(text);
  const posted = o.published_at ? String(o.published_at).replace(' ', 'T').replace(' UTC', 'Z') : null;
  return base({
    id: `rc-${token}-${o.id}`, source: 'recruitee', title: o.title, company: companyName || o.company_name || token, url: o.careers_url,
    department: o.department || '', locationText: [o.city, o.country].filter(Boolean).join(', '), countries,
    workplace, salary: salary || salaryFromText(text), posted, text,
  });
}

// ---------- final decision ----------
export function finalize(job, { now = Date.now(), maxAgeDays = 120 } = {}) {
  if (!job || !job.title || !job.url) return null;
  const family = classify(job.title, job.department, { strict: job.source === 'smartrecruiters' });
  if (!family) return null;

  let countries = job.countries.length ? job.countries : countriesIn(job.locationText);
  const locText = job.locationText;
  const europeRemote = EUROPE_REGION.test(locText) || EUROPE_REGION.test(job.title);
  const globalRemote = job.workplace === 'Remote' && GLOBAL_REMOTE.test(locText);
  if (!countries.length && !europeRemote && !globalRemote) return null;
  if (!countries.length && NON_EUROPE.test(locText) && !europeRemote) return null;

  if (job.posted) {
    const age = (now - Date.parse(job.posted)) / 864e5;
    if (age > maxAgeDays) return null;
  }
  let region = '';
  if (!countries.length) region = europeRemote ? 'Europe (remote)' : 'Anywhere (remote)';

  // Salary sanity: keep only plausible, readable ranges.
  let salary = job.salary;
  if (salary && (!(salary.min > 0) || salary.max < salary.min)) salary = null;

  return {
    id: job.id,
    title: job.title,
    company: prettyCompany(companyClean(job.company)),
    url: job.url,
    source: job.source,
    family,
    seniority: seniority(job.title),
    workplace: job.workplace,
    countries,
    region,
    location: shortLocation(locText, countries, region),
    salary,
    stack: extractStack(job.title, job.text),
    posted: job.posted ? new Date(job.posted).toISOString().slice(0, 10) : null,
  };
}

function prettyCompany(c) {
  if (!c) return '';
  if (c !== c.toLowerCase()) return c;
  return c.split(/[-_ ]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
function shortLocation(text, countries, region) {
  if (region) return region;
  if (countries.length > 3) return `${countries.length} European countries`;
  if (countries.length > 1) return countries.join(', ');
  // Show the European location, not the first one listed (which may be outside Europe).
  const seg = String(text).split(';').map((x) => x.trim()).find((x) => x && !NON_EUROPE.test(x) && countriesIn(x).length);
  return seg && seg.length < 60 ? seg : countries[0] || '';
}

export function dedupe(jobs) {
  const seen = new Map();
  for (const j of jobs) {
    const key = `${j.company}|${j.title}|${j.location}`.toLowerCase().replace(/\s+/g, ' ');
    const prev = seen.get(key);
    // Prefer the copy straight from the company's own job board, then the one with a salary.
    const score = (x) => (x.source === 'arbeitnow' ? 0 : 2) + (x.salary ? 1 : 0);
    if (!prev || score(j) > score(prev)) seen.set(key, j);
  }
  return [...seen.values()];
}

// ---------- paid features ----------
// Marks featured jobs and adds jobs sent in directly by companies, while their paid period lasts.
export function applyFeatured(jobs, cfg = {}, { now = Date.now() } = {}) {
  const today = new Date(now).toISOString().slice(0, 10);
  const active = (e) => e && e.until && e.until >= today;
  const featuredUrls = new Set((cfg.featured || []).filter(active).map((e) => e.url));
  const direct = (cfg.direct || []).filter(active).filter((d) => d.title && d.company && d.url && d.salary).map((d) => ({
    id: `direct-${d.url}`, title: clean(d.title), company: clean(d.company), url: d.url, source: 'direct',
    family: d.family || classify(d.title) || 'Software development', seniority: d.seniority ?? seniority(d.title),
    workplace: d.workplace || '', countries: d.countries || countriesIn(d.location || ''), region: '',
    location: d.location || (d.countries || []).join(', '), salary: { from: 'company', ...d.salary },
    stack: d.stack || [], posted: d.posted || today, featured: true,
  }));
  const directUrls = new Set(direct.map((d) => d.url));
  return [...direct, ...jobs.filter((j) => !directUrls.has(j.url)).map((j) => (featuredUrls.has(j.url) ? { ...j, featured: true } : j))];
}
