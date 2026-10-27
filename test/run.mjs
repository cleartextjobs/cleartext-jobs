// Quick checks for the parsing and filtering rules. Run: node test/run.mjs
import assert from 'node:assert/strict';
import { classify, seniority, salaryFromText, countriesIn, extractStack, fromGreenhouse, fromLever, fromAshby, fromArbeitnow, fromSmartRecruiters, fromRecruitee, finalize, dedupe, applyFeatured } from '../src/normalize.mjs';

let passed = 0;
const t = (name, fn) => { fn(); passed++; };
const now = Date.parse('2026-10-27T12:00:00Z');

t('classify IT titles', () => {
  assert.equal(classify('Senior Backend Engineer'), 'Software development');
  assert.equal(classify('Senior Cloud / DevOps Engineer – AWS, Kubernetes/OpenShift (m/w/d)'), 'Cloud & infrastructure');
  assert.equal(classify('Sr Security Engineer | Remote | Europe'), 'Security');
  assert.equal(classify('Data Analyst'), 'Data & AI');
  assert.equal(classify('Engineering Manager, Payments'), 'Engineering leadership');
  assert.equal(classify('Technical Account Manager (Remote Europe)'), 'Technical support');
  assert.equal(classify('IT Operations Specialist'), 'Cloud & infrastructure');
  assert.equal(classify('Fullstack Entwickler TypeScript – Node.js / Angular (m/w/d)'), 'Software development');
  assert.equal(classify('Advanced Product Manager - Digital Trust'), 'Product & design');
});
t('reject non-IT titles', () => {
  for (const x of ['Senior Account Executive - Americas', 'SEO Specialist', 'Senior Accountant (m/w/d)', 'Callcenter - Telefonist:in', 'Customer Support Senior Associate', 'Freelance Doctor (GP) - Medical Chat', 'Hardware Engineer', 'Sales Manager - (m/w/d)', 'Marketing Manager (m/w/d)'])
    assert.equal(classify(x), null, x);
});
t('seniority', () => {
  assert.equal(seniority('Senior Backend Engineer'), 'Senior');
  assert.equal(seniority('Werkstudent Software Development Frontend'), 'Intern / graduate');
  assert.equal(seniority('Staff Engineer'), 'Lead / principal');
  assert.equal(seniority('Engineering Manager'), 'Manager');
  assert.equal(seniority('Backend Engineer'), '');
});
t('salary from text', () => {
  assert.deepEqual(salaryFromText('We pay €55,000 - €70,000 per year.'), { min: 55000, max: 70000, currency: 'EUR', period: 'year', from: 'posting text' });
  assert.deepEqual(salaryFromText('Gehalt: 60.000 € – 75.000 € brutto jährlich'), { min: 60000, max: 75000, currency: 'EUR', period: 'year', from: 'posting text' });
  assert.equal(salaryFromText('Salary range 55-70k EUR').min, 55000);
  assert.equal(salaryFromText('£50,000 to £65,000').currency, 'GBP');
  assert.equal(salaryFromText('€3.500 - €4.200 per month').period, 'month');
  assert.equal(salaryFromText('We have 10 - 20 engineers'), null);
  assert.equal(salaryFromText('$120,000 - $150,000'), null);
});
t('countries', () => {
  assert.deepEqual(countriesIn('Lisbon, Portugal'), ['Portugal']);
  assert.deepEqual(countriesIn('Berlin Office'), ['Germany']);
  assert.deepEqual(countriesIn('Austin, Texas'), []);
});
t('stack', () => {
  assert.deepEqual(extractStack('Senior Product Engineer (TS/NodeJS/Vue)', 'We use TypeScript, Node.js and Vue on AWS with PostgreSQL.').slice(0, 3).sort(), ['Node.js', 'TypeScript', 'Vue'].sort());
});

t('ashby with company salary', () => {
  const j = fromAshby('alan', { id: '1', title: 'IT Engineer', department: 'Work Environment', team: 'IT', location: 'Paris, France', secondaryLocations: [], publishedAt: '2026-09-07T11:20:10.452+00:00', isListed: true, isRemote: true, workplaceType: 'Hybrid', address: { postalAddress: { addressCountry: 'France' } }, jobUrl: 'https://jobs.ashbyhq.com/alan/1', descriptionPlain: 'We use Linux and Python.', compensation: { compensationTiers: [{}], summaryComponents: [{ compensationType: 'Salary', interval: '1 YEAR', currencyCode: 'EUR', minValue: 53000, maxValue: 70000 }] } });
  const f = finalize(j, { now });
  assert.equal(f.company, 'Alan'); assert.equal(f.workplace, 'Hybrid'); assert.deepEqual(f.countries, ['France']);
  assert.deepEqual(f.salary, { min: 53000, max: 70000, currency: 'EUR', period: 'year', from: 'company' });
});
t('ashby US-only job is dropped', () => {
  const j = fromAshby('deel', { id: '2', title: 'Software Engineer', location: 'Austin', isListed: true, isRemote: true, workplaceType: 'Remote', address: { postalAddress: { addressCountry: 'United States', addressLocality: 'Austin' } }, jobUrl: 'u', publishedAt: '2026-10-01T00:00:00Z', compensation: { summaryComponents: [] } });
  assert.equal(finalize(j, { now }), null);
});
t('greenhouse escaped HTML and Europe filter', () => {
  const gh = { id: 9, title: 'Senior Data Engineer', absolute_url: 'https://x/9', location: { name: 'Portugal' }, first_published: '2026-10-01T07:50:14-04:00', content: '&lt;p&gt;Salary: €50.000 – €65.000 gross per year. Python, Spark, Airflow.&lt;/p&gt;', departments: [{ name: 'Data' }], offices: [] };
  const f = finalize(fromGreenhouse('feedzai', gh), { now });
  assert.equal(f.family, 'Data & AI'); assert.equal(f.salary.min, 50000); assert.ok(f.stack.includes('Python'));
  const us = finalize(fromGreenhouse('feedzai', { ...gh, id: 10, location: { name: 'US Remote' } }), { now });
  assert.equal(us, null);
});
t('lever', () => {
  const p = { id: 'a', text: 'Backend Engineer', hostedUrl: 'https://jobs.lever.co/x/a', createdAt: Date.parse('2026-10-10'), country: 'ES', workplaceType: 'hybrid', categories: { location: 'Barcelona', allLocations: ['Barcelona'], department: 'Engineering' }, descriptionPlain: 'Go and Kubernetes' };
  const f = finalize(fromLever('travelperk', p), { now });
  assert.equal(f.workplace, 'Hybrid'); assert.deepEqual(f.countries, ['Spain']); assert.equal(f.location, 'Barcelona');
});
t('arbeitnow city implies Germany; old jobs dropped', () => {
  const a = { slug: 's', company_name: 'X GmbH', title: 'Senior Fullstack Entwickler Java / Angular (m/w/d)', description: '<p>Java, Angular</p>', remote: true, url: 'https://www.arbeitnow.com/jobs/s', tags: [], location: 'Stuttgart', created_at: Math.floor(Date.parse('2026-10-20') / 1000) };
  const f = finalize(fromArbeitnow(a), { now });
  assert.deepEqual(f.countries, ['Germany']); assert.equal(f.workplace, 'Remote');
  assert.equal(finalize(fromArbeitnow({ ...a, created_at: Math.floor(Date.parse('2025-01-01') / 1000) }), { now }), null);
});
t('dedupe prefers company board with salary', () => {
  const a = { company: 'A', title: 'Dev', location: 'Berlin', source: 'arbeitnow', salary: null };
  const b = { company: 'A', title: 'Dev', location: 'Berlin', source: 'greenhouse', salary: { min: 1 } };
  assert.equal(dedupe([a, b])[0].source, 'greenhouse');
});

console.log(`${passed} checks passed`);
t('regression: New South Wales is not the UK; ordering', () => {
  assert.deepEqual(countriesIn('Sydney; Sydney, New South Wales, Australia'), []);
  assert.deepEqual(countriesIn('United States; Spain'), ['Spain']);
  assert.equal(classify('Principal Product Manager - Core Experience Platform'), 'Product & design');
  assert.equal(classify('Senior Mobile Engineer - React Native, Platform/Infrastructure'), 'Software development');
  assert.equal(classify('Senior Product Security Engineer'), 'Security');
  assert.equal(classify('Platform Engineer'), 'Cloud & infrastructure');
});
console.log('regression checks passed');
t('location shows the European part', () => {
  const p = { id: 'b', text: 'Senior Developer Advocate', hostedUrl: 'u', createdAt: Date.parse('2026-10-10'), country: 'CA', categories: { location: 'Canada', allLocations: ['Canada', 'Madrid, Spain'] }, descriptionPlain: '' };
  assert.equal(finalize(fromLever('elastic', p), { now }).location, 'Madrid, Spain');
});
console.log('location check passed');
t('more non-IT titles and Arbeitnow country sites', () => {
  for (const x of ['Sales Specialist - security', 'People & Workplace Experience Manager', 'Junior Recipe Developer (all genders)', 'Data protection and compliance Legal - Apprenticeship', 'Business Developer (Digital Marketing)', 'Hardware Entwickler (m/w/d) digitale Signalverarbeitung'])
    assert.equal(classify(x), null, x);
  const a = { slug: 'x', company_name: 'B', title: 'Technical Support Consultant', description: '', remote: false, url: 'https://www.arbeitnow.nl/jobs/companies/b/x', tags: [], location: 'Almere', created_at: Math.floor(Date.parse('2026-10-20') / 1000) };
  assert.deepEqual(finalize(fromArbeitnow(a), { now }).countries, ['Netherlands']);
});
console.log('arbeitnow check passed');
t('Portuguese/Spanish titles and industrial engineering', () => {
  assert.equal(classify('Senior Hardware Design Engineer (f/m/div.)'), null);
  assert.equal(classify('Automotive Software Engineer'), 'Software development');
  assert.equal(classify('Subproject Manager - RADAR Plant Test (f/m/div.)'), null);
  assert.equal(classify('Estágio Curricular em Engenharia Mecânica (f/m/div.)'), null);
  assert.equal(classify('Senior C# Developer - WPF (f/m/div.)'), 'Software development');
  assert.equal(classify('Programador Java Sénior'), 'Software development');
  assert.equal(seniority('Programador Java Sénior'), 'Senior');
  assert.equal(classify('Desarrollador Frontend'), 'Software development');
  assert.equal(classify('Técnico de Sistemas e Redes'), 'Cloud & infrastructure');
  const sr = fromSmartRecruiters('BoschGroup', { id: '1', name: 'Data Engineer (f/m/div.)', company: { identifier: 'BoschGroup', name: 'Bosch Group' }, releasedDate: '2026-10-27T17:29:48.960Z', location: { city: 'Lisboa', country: 'pt', hybrid: true, fullLocation: 'Lisboa, , Portugal' }, function: { label: 'Engineering' } });
  const f = finalize(sr, { now });
  assert.deepEqual(f.countries, ['Portugal']); assert.equal(f.workplace, 'Hybrid'); assert.equal(f.url, 'https://jobs.smartrecruiters.com/BoschGroup/1');
  const rc = fromRecruitee('sequra', { id: 9, title: 'Senior Platform Engineer', company_name: 'seQura', city: 'Barcelona', country: 'Spain', country_code: 'ES', remote: true, salary: { min: 60000, max: 75000, currency: 'EUR', period: 'year' }, careers_url: 'https://sequra.recruitee.com/o/x', published_at: '2026-10-26 11:38:39 UTC', description: '<p>Kubernetes</p>' });
  const g = finalize(rc, { now });
  assert.equal(g.salary.min, 60000); assert.equal(g.workplace, 'Remote'); assert.equal(g.posted, '2026-10-26');
});
console.log('PT/ES checks passed');
t('manufacturing roles at large employers are not IT', () => {
  for (const x of ['Purchasing Quality Engineer - automotive area', 'Production Quality Engineer', 'Production Engineer Intern', 'Senior Equipment Engineer Lithography (w/m/div.)', 'Reliability Engineer - Automotive Power Electronics', 'Wafer-level Test Engineer', 'Customer Quality Engineer (eBike Systems)', 'Senior Analog IC Design Engineer – Espoo', 'Hardware Developer (f/m/div.)', 'Physical Security Specialist', 'EXPORT CONTROL CLASSIFICATION SPECIALIST (f/m)'])
    assert.equal(classify(x, 'Engineering'), null, x);
  assert.equal(classify('Software Quality Engineer'), 'Software development');
  assert.equal(classify('Senior Site Reliability Engineer'), 'Cloud & infrastructure');
  assert.equal(classify('Senior MATLAB/SIMULINK Software Engineer (f/m/div.)'), 'Software development');
});
console.log('manufacturing checks passed');
t('strict mode for large industrial employers', () => {
  for (const x of ['Supply Chain & Logistics Engineer (m/f/d)', 'Test engineer- Electromobility high-voltage laboratories', 'Lab Engineer (f/m/div.)', 'Sensor System Architect for Passive Safety', 'Development engineer - eBike systems'])
    assert.equal(classify(x, '', { strict: true }), null, x);
  assert.equal(classify('Full-Stack Developer Senior', '', { strict: true }), 'Software development');
  assert.equal(classify('Enterprise Architect (m/w/d)', '', { strict: true }), 'Software development');
  assert.equal(classify('Data Engineer', '', { strict: true }), 'Data & AI');
  assert.equal(classify('Dutch Market | IT Helpdesk Support', '', { strict: true }), 'Cloud & infrastructure');
});
console.log('strict checks passed');
t('paid features', () => {
  const jobs = [{ url: 'a', title: 'Dev' }, { url: 'b', title: 'Ops' }];
  const cfg = { featured: [{ url: 'b', until: '2026-11-30' }, { url: 'a', until: '2026-10-01' }],
    direct: [{ title: 'Senior Backend Engineer', company: 'Example Lda', url: 'c', location: 'Lisbon', salary: { min: 45000, max: 60000, currency: 'EUR', period: 'year' }, until: '2026-12-31' },
             { title: 'No salary', company: 'X', url: 'd', until: '2026-12-31' }] };
  const out = applyFeatured(jobs, cfg, { now });
  assert.equal(out.length, 3);
  assert.equal(out[0].url, 'c'); assert.equal(out[0].featured, true); assert.deepEqual(out[0].countries, ['Portugal']);
  assert.equal(out.find((j) => j.url === 'b').featured, true);
  assert.equal(out.find((j) => j.url === 'a').featured, undefined);
});
console.log('feature checks passed');
