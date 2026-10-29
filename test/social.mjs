// Checks for the Facebook post rules. Run: node test/social.mjs
import assert from 'node:assert/strict';
import { pick, compose, composeInstagram, slides, money, place } from '../src/social.mjs';

const now = Date.parse('2026-10-28T09:00:00Z');
const job = (o) => ({ title: 'Software Engineer', company: 'Acme', countries: ['Portugal'], location: 'Lisbon, Portugal', workplace: 'Hybrid',
  salary: { min: 50000, max: 70000, currency: 'EUR', period: 'year' }, posted: '2026-10-27', ...o });

// Money format
assert.equal(money({ min: 55800, max: 88300, currency: 'EUR', period: 'year' }), '€55.800–88.300/ano');
assert.equal(money({ min: 900, max: 1000, currency: 'EUR', period: 'month' }), '€900–1.000/mês');
assert.equal(money({ min: 20300, max: 27000, currency: 'PLN', period: 'month' }), 'PLN 20.300–27.000/mês');
assert.equal(money({ min: 60000, max: 60000, currency: 'GBP', period: 'year' }), '£60.000/ano');

// Places in Portuguese
assert.equal(place(job({})), 'Lisboa, Portugal');
assert.equal(place(job({ countries: ['Portugal', 'Spain'], location: 'Portugal, Spain' })), 'Portugal, Espanha');
assert.equal(place(job({ countries: ['Portugal', 'Spain', 'France', 'Italy'], location: '4 European countries' })), '4 países da Europa');

// Selection: only salaried, themed jobs; one per company first; no featured jobs
const jobs = [
  job({ company: 'A' }), job({ company: 'A', title: 'Data Engineer' }), job({ company: 'B' }), job({ company: 'C' }),
  job({ company: 'D' }), job({ company: 'E' }), job({ company: 'F', salary: null }), job({ company: 'G', featured: true }),
  job({ company: 'H', countries: ['Germany'], location: 'Berlin' }),
  job({ company: 'R', countries: ['Germany'], location: 'Berlin', workplace: 'Remote' }),
];
const mon = pick(jobs, 1, now);
assert.equal(mon.jobs.length, 5);
assert.deepEqual(mon.jobs.map((j) => j.company), ['A', 'B', 'C', 'D', 'E']);
assert.ok(!mon.jobs.some((j) => !j.salary || j.featured || !j.countries.includes('Portugal')));
assert.equal(pick(jobs, 3, now), null); // only 1 remote job: fewer than 3, so no post
const remote = ['R', 'S', 'T'].map((c) => job({ company: c, countries: ['Germany'], location: 'Berlin', workplace: 'Remote' }));
assert.deepEqual(pick([...jobs, ...remote.slice(1)], 3, now).jobs.map((j) => j.company), ['R', 'S', 'T']);
assert.equal(pick(jobs, 2, now), null); // no post on Tuesdays

// A second job from the same company only when there are not enough companies
const few = [job({ company: 'A' }), job({ company: 'A', title: 'QA Engineer' }), job({ company: 'B' })];
assert.deepEqual(pick(few, 1, now).jobs.map((j) => j.company), ['A', 'B', 'A']);

// Too few jobs: nothing posted
assert.equal(pick([job({})], 1, now), null);

// Text
const text = compose(mon);
assert.match(text, /^5 vagas de IT em Portugal com o salário à vista/);
assert.match(text, /€50\.000–70\.000\/ano/);
assert.match(text, /Lisboa, Portugal · Híbrido/);
assert.match(text, /https:\/\/cleartextjobs\.com\//);
// Instagram caption and slides
const ig = composeInstagram(mon);
assert.match(ig, /link na bio/);
assert.ok(ig.length < 2200);
const s = slides(mon, { total: 2296, date: new Date('2026-10-28T09:00:00Z') });
assert.equal(s.length, 7); // cover + 5 jobs + closing slide
assert.match(s[0], /5 vagas de IT em Portugal com o salário à vista/);
assert.match(s[1], /€50\.000–70\.000</);
assert.match(s[6], /Mais de 2\.200 vagas/);
assert.match(s[6], /Recolha de 28 out 2026/);
assert.ok(!slides({ theme: mon.theme, jobs: [job({ title: '<b>x</b>' })] })[1].includes('<b>x</b>'));
console.log('social post checks passed');
