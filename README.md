# Cleartext Jobs

IT jobs in Europe, collected automatically from companies' own public job boards. Every job shows the salary when the company publishes it and links to the original posting.

Live site: **[cleartextjobs.com](https://cleartextjobs.com)**

## How it works

1. **Collection** (`src/collect.mjs`): several times a day, the collector reads the public job listings of:
   - companies that use **Greenhouse**, **Lever**, **Ashby**, **Recruitee** or **SmartRecruiters** (the list is in `config/sources.json`);
   - **Arbeitnow**, a free job API for Europe that asks for a link back (the site shows "via Arbeitnow").
2. **Filtering** (`src/normalize.mjs`): keeps only IT roles located in Europe (or remote for Europe) and posted in the last 120 days. It reads the salary from the company's data or the posting text, detects the work model (remote, hybrid, on-site), the level and the technologies, and removes duplicates.
3. **Site** (`site/index.html`): one page with search and filters, which reads `site/jobs.json` produced by the collection. It stores no personal data and receives no applications.
4. **Country pages** (`src/pages.mjs`, `config/pages.json`): each collection builds static pages for search engines at `/it-jobs/<country>/` (Portugal, United Kingdom, Germany, Spain, France and the Netherlands), with the jobs written into the HTML, the median published salary, cities, work model and areas. They are listed in `sitemap.xml`. To add a country (for example Italy), add a line to `config/pages.json` and the link at the top of `site/index.html`. Each page's button opens the main list already filtered (`/?country=Germany`).
5. **Publishing** (`.github/workflows/update.yml`): GitHub runs the collection every 6 hours and publishes the site on GitHub Pages.

The site carries no text from the postings, only the facts (role, company, location, salary, technologies) and the link to the original.

## Maintenance

- **Add companies:** in `config/sources.json`, add the company's name to the right list. The name is the one in the address of its jobs page: `boards.greenhouse.io/<name>`, `jobs.lever.co/<name>`, `jobs.ashbyhq.com/<name>`, `<name>.recruitee.com` or `jobs.smartrecruiters.com/<Name>` (on SmartRecruiters, upper and lower case matter). If a name is wrong, the collection skips it and says so in the run log (**Actions** tab).
- **Company name spelled badly on the site:** add it under `names` in the same file.
- **If a run fails:** the previous site stays online. The run log in **Actions** shows why.

## Featured jobs

The site has a "Feature a job" section and a link at the top of the page. A company pays to have its job featured for 30 days.

1. **Contact and price:** in `config/site.json`, set the contact email in `contactEmail`. The default price is €49 for 30 days.
2. **Payment link (optional):** paste a payment link (for example from Stripe) in `paymentLink`. Without one, the company writes to the email and receives the link or the invoice.
3. **When a company pays:**
   - if the job is already on the site, add the link to the original posting and the end date to `config/featured.json`, in the `featured` list;
   - if the company is not among the sources, add the full job to the `direct` list (there is an example in the file). The salary is required.
4. On the next run (within 6 hours, or straight away with **Run workflow**), the job appears at the top with a "Featured" label. After the end date it stops being featured on its own.

## Weekly social posts

`.github/workflows/social-pack.yml` runs on Sundays (and on demand) and prepares the posts for Monday (jobs in Portugal), Wednesday (remote in Europe) and Friday (Portugal and Spain), without repeating jobs between days (`src/social.mjs`). Each day has a Facebook text and an Instagram carousel of 7 images (`src/render.mjs`). The files are in the run's **Artifacts** (`publicacoes-semana`) and are scheduled by hand in Meta Business Suite.

`.github/workflows/social.yml` can post directly to Facebook and Instagram, but only runs by hand and needs the `FB_PAGE_ID` and `FB_PAGE_TOKEN` secrets, which are not set.

## Testing locally

With Node.js 20 or newer:

```
node test/run.mjs            # checks the filtering rules and the country pages
node src/collect.mjs         # collects the jobs into site/jobs.json
npx serve site               # opens the site at http://localhost:3000
node test/build-sandbox.mjs  # builds a preview copy with sample jobs in sandbox/
```

## Known limits

- Only companies that use Greenhouse, Lever, Ashby, Recruitee or SmartRecruiters appear (plus Arbeitnow jobs). Companies with their own systems, Workday or Workable are not included.
- At large industrial companies (Bosch, Continental), only roles with clear IT signals in the title are kept; some borderline technical roles may be left out.
- Roles are classified by words in the title, so some jobs may land in the wrong area or be missed.
- LinkedIn, Indeed, ITJobs and other job sites are not used, because their terms forbid automated collection. Remotive is not used either, because it does not allow its jobs on other job sites.

## Fonts

Instrument Sans and Martian Mono, under the SIL Open Font License (files in `assets/fonts`).

## Copyright

© 2026 Cleartext Jobs. All rights reserved.

This repository is public so the code can be read. No licence is granted to copy, modify, distribute or use the code or the site's content, in whole or in part, without written permission. For permission, contact cleartextjobs@gmail.com.
