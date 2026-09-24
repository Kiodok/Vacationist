#!/usr/bin/env node
/**
 * Regression tests for the generated marketing site (docs/) — JSON-LD
 * validity, the FAQ/schema sync the GEO pass (2026-09-24) was built to make
 * unnecessary-to-maintain-by-hand, DefinedTermSet/speakable selector
 * integrity, softwareVersion drift, and the EN->DE translation leak class of
 * bug. No DOM/test framework dependency — same hand-rolled style as
 * consent.test.js. Rebuilds the site first so it always checks current
 * output, never a stale docs/ tree from an earlier run.
 *
 * Run: node marketing/site/site.test.js
 * Exits non-zero on any failure — wired into `npm run test:site`.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const DOCS_DIR = path.join(ROOT, 'docs');

let failures = 0;
function assert(condition, message) {
  if (!condition) {
    failures++;
    console.error(`  ✗ ${message}`);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

console.log('Building the site so tests check current output…');
execFileSync('node', [path.join(ROOT, 'marketing', 'site', 'build.mjs')], { cwd: ROOT, stdio: 'inherit' });

function walkHtml(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) out.push(...walkHtml(p));
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

function extractLdBlocks(html) {
  const blocks = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    try {
      blocks.push(JSON.parse(m[1]));
    } catch (e) {
      blocks.push({ __parseError: e.message, __raw: m[1].slice(0, 200) });
    }
  }
  return blocks;
}

function loadTranslations(lang) {
  const code = fs.readFileSync(path.join(DOCS_DIR, 'i18n', `${lang}.js`), 'utf8');
  const win = {};
  new Function('window', code)(win);
  return win.VACATIONIST_I18N;
}

/* ── 1/2. Every JSON-LD block on every generated page parses and has
   @context + @type ── */
console.log('\nJSON-LD validity across the whole site:');
{
  const htmlFiles = walkHtml(DOCS_DIR);
  let totalBlocks = 0;
  let badBlocks = 0;
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    const blocks = extractLdBlocks(html);
    totalBlocks += blocks.length;
    for (const b of blocks) {
      if (b.__parseError || !b['@context'] || !b['@type']) {
        badBlocks++;
        console.error(`  ! ${path.relative(ROOT, file)}: invalid JSON-LD block (${b.__parseError || 'missing @context/@type'})`);
      }
    }
  }
  assert(htmlFiles.length > 50, `scanned a plausible number of HTML files (${htmlFiles.length})`);
  assert(totalBlocks > 100, `found a plausible number of JSON-LD blocks (${totalBlocks})`);
  assert(badBlocks === 0, `every JSON-LD block parses with @context + @type (${badBlocks} bad)`);
}

/* ── 3. Homepage: exactly 7 block types, on both languages ── */
console.log('\nHomepage JSON-LD block set:');
const EXPECTED_HOME_TYPES = ['SoftwareApplication', 'WebSite', 'WebPage', 'Organization', 'FAQPage', 'HowTo', 'DefinedTermSet'];
const homeBlocks = {};
for (const [lang, file] of [['en', 'index.html'], ['de', path.join('de', 'index.html')]]) {
  const html = fs.readFileSync(path.join(DOCS_DIR, file), 'utf8');
  const blocks = extractLdBlocks(html);
  homeBlocks[lang] = blocks;
  const types = blocks.map((b) => b['@type']);
  assert(
    EXPECTED_HOME_TYPES.every((t) => types.includes(t)) && types.length === EXPECTED_HOME_TYPES.length,
    `/${lang === 'de' ? 'de/' : ''} carries exactly the 7 expected block types (got: ${types.join(',')})`
  );
}

/* ── 4. FAQ sync: EN/DE FAQPage.mainEntity count matches, and matches the
   faq.N.q key count in each language's i18n file. This is the drift test
   the homeFaqLd() build-managed fix (2026-09-24) exists to make
   unnecessary in practice — verify it stays that way. ── */
console.log('\nFAQ schema <-> i18n sync:');
{
  const en = loadTranslations('en');
  const de = loadTranslations('de');
  const faqCount = (t) => Object.keys(t).filter((k) => /^faq\.\d+\.q$/.test(k)).length;
  const enFaqLd = homeBlocks.en.find((b) => b['@type'] === 'FAQPage');
  const deFaqLd = homeBlocks.de.find((b) => b['@type'] === 'FAQPage');
  assert(!!enFaqLd && !!deFaqLd, 'both homepages carry a FAQPage block');
  assert(enFaqLd.mainEntity.length === faqCount(en), `EN FAQPage count (${enFaqLd.mainEntity.length}) matches faq.N.q keys in en.js (${faqCount(en)})`);
  assert(deFaqLd.mainEntity.length === faqCount(de), `DE FAQPage count (${deFaqLd.mainEntity.length}) matches faq.N.q keys in de.js (${faqCount(de)})`);
  assert(enFaqLd.mainEntity.length === deFaqLd.mainEntity.length, 'EN and DE FAQ counts match each other');

  let mismatches = 0;
  for (let i = 0; i < enFaqLd.mainEntity.length; i++) {
    const n = i + 1;
    if (enFaqLd.mainEntity[i].name !== en[`faq.${n}.q`]) mismatches++;
  }
  assert(mismatches === 0, `every EN FAQPage Question.name matches its faq.N.q key (${mismatches} mismatch(es))`);
}

/* ── 5. DefinedTerm.url fragments resolve to a real id= in the same doc ── */
console.log('\nDefinedTermSet integrity:');
for (const [lang, file] of [['en', 'index.html'], ['de', path.join('de', 'index.html')]]) {
  const html = fs.readFileSync(path.join(DOCS_DIR, file), 'utf8');
  const dts = homeBlocks[lang].find((b) => b['@type'] === 'DefinedTermSet');
  assert(!!dts && dts.hasDefinedTerm.length === 6, `/${lang === 'de' ? 'de/' : ''} DefinedTermSet has 6 terms`);
  let unresolved = 0;
  for (const term of dts.hasDefinedTerm) {
    const frag = term.url.split('#')[1];
    if (!html.includes(`id="${frag}"`)) {
      unresolved++;
      console.error(`  ! ${lang}: DefinedTerm "${term.name}" url fragment #${frag} has no matching id= in the page`);
    }
  }
  assert(unresolved === 0, `every DefinedTerm.url fragment resolves to an id= in /${lang === 'de' ? 'de/' : ''} (${unresolved} unresolved)`);
}

/* ── 6. speakable.cssSelector entries match a real class in the same doc —
   the D.3 fix (jsonLd() derives selectors from rendered contentHtml) ── */
console.log('\nspeakable selector integrity (sampled across content pages):');
{
  const htmlFiles = walkHtml(DOCS_DIR).filter((f) => !f.includes(`${path.sep}assets${path.sep}`));
  let checked = 0;
  let orphaned = 0;
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    const blocks = extractLdBlocks(html);
    for (const b of blocks) {
      if (!b.speakable) continue;
      checked++;
      for (const sel of b.speakable.cssSelector) {
        const cls = sel.slice(1);
        if (!new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"`).test(html)) {
          orphaned++;
          console.error(`  ! ${path.relative(ROOT, file)}: speakable selector "${sel}" matches no element`);
        }
      }
    }
  }
  assert(checked > 20, `checked a plausible number of speakable blocks (${checked})`);
  assert(orphaned === 0, `no speakable selector is orphaned (matches no class) — ${orphaned} orphaned`);
}

/* ── 7. SoftwareApplication.softwareVersion matches apps/mobile/app.config.ts
   — kills the class of drift that let this sit at 1.38.1 while the app
   shipped 1.39.0. ── */
console.log('\nsoftwareVersion drift check:');
{
  const appConfig = fs.readFileSync(path.join(ROOT, 'apps', 'mobile', 'app.config.ts'), 'utf8');
  const m = appConfig.match(/^\s*version:\s*'([^']+)'/m);
  assert(!!m, 'apps/mobile/app.config.ts has a parseable version: field');
  if (m) {
    const appVersion = m[1];
    const enApp = homeBlocks.en.find((b) => b['@type'] === 'SoftwareApplication');
    assert(enApp.softwareVersion === appVersion, `SoftwareApplication.softwareVersion (${enApp.softwareVersion}) matches app.config.ts (${appVersion})`);
  }
}

/* ── 8. aggregateRating stays absent below the review threshold ── */
console.log('\naggregateRating gate:');
{
  let combined = { ratingCount: 0 };
  try {
    combined = JSON.parse(fs.readFileSync(path.join(ROOT, 'marketing', 'site', 'store-ratings.json'), 'utf8')).combined || combined;
  } catch { /* not yet generated — treat as zero, same as build.mjs */ }
  const enApp = homeBlocks.en.find((b) => b['@type'] === 'SoftwareApplication');
  if ((combined.ratingCount || 0) < 25) {
    assert(!enApp.aggregateRating, `aggregateRating absent while combined ratings (${combined.ratingCount || 0}) < 25`);
  } else {
    assert(!!enApp.aggregateRating, `aggregateRating present now that combined ratings (${combined.ratingCount}) >= 25`);
  }
}

/* ── 9. en.js / de.js load cleanly, identical key sets, no undefined ── */
console.log('\ni18n dictionary integrity:');
{
  const en = loadTranslations('en');
  const de = loadTranslations('de');
  assert(!!en && !!de, 'both docs/i18n/{en,de}.js load via new Function without throwing');
  const enKeys = new Set(Object.keys(en));
  const deKeys = new Set(Object.keys(de));
  const onlyEn = [...enKeys].filter((k) => !deKeys.has(k));
  const onlyDe = [...deKeys].filter((k) => !enKeys.has(k));
  assert(onlyEn.length === 0, `no keys exist only in en.js (${onlyEn.slice(0, 5).join(', ')})`);
  assert(onlyDe.length === 0, `no keys exist only in de.js (${onlyDe.slice(0, 5).join(', ')})`);
  const enUndef = Object.entries(en).filter(([, v]) => v === undefined).map(([k]) => k);
  const deUndef = Object.entries(de).filter(([, v]) => v === undefined).map(([k]) => k);
  assert(enUndef.length === 0, `no undefined values in en.js (${enUndef.join(', ')})`);
  assert(deUndef.length === 0, `no undefined values in de.js (${deUndef.join(', ')})`);
}

/* ── 10. German-leakage test: for every key where EN and DE differ, the EN
   string must not appear verbatim in docs/de/index.html. Direct check on the
   `data-i18n-html`-outside-`<hN>` and similar silent-leak failure modes. ── */
console.log('\nGerman homepage leakage check:');
{
  const en = loadTranslations('en');
  const de = loadTranslations('de');
  const deHtml = fs.readFileSync(path.join(DOCS_DIR, 'de', 'index.html'), 'utf8');
  let leaks = 0;
  for (const key of Object.keys(en)) {
    if (key.endsWith('.href')) continue; // hrefs are legitimately language-agnostic
    const enVal = en[key];
    if (typeof enVal !== 'string' || enVal.length < 8) continue; // skip short/ambiguous strings
    if (enVal === de[key]) continue; // identical by design (e.g. a proper noun), not a leak
    if (deHtml.includes(enVal)) {
      leaks++;
      console.error(`  ! /de/ contains the EN value of "${key}": ${JSON.stringify(enVal.slice(0, 60))}`);
    }
  }
  assert(leaks === 0, `no EN i18n value leaks into docs/de/index.html (${leaks} leak(s))`);
}

/* ── 11. Every citation.url is an absolute https:// URL — checked sitewide,
   not just the homepages, since /features/travel-documents/ and the privacy
   blog post also carry citations via `citations:` front matter. ── */
console.log('\nCitation URL sanity (sitewide):');
{
  let badCitations = 0;
  let checked = 0;
  for (const file of walkHtml(DOCS_DIR)) {
    if (file.includes(`${path.sep}assets${path.sep}`)) continue;
    const html = fs.readFileSync(file, 'utf8');
    for (const b of extractLdBlocks(html)) {
      for (const c of b.citation || []) {
        checked++;
        if (!/^https:\/\//.test(c.url)) {
          badCitations++;
          console.error(`  ! ${path.relative(ROOT, file)}: citation "${c.name}" has a non-https URL: ${c.url}`);
        }
      }
    }
  }
  assert(checked >= 16, `found a plausible number of citations sitewide (${checked})`);
  assert(badCitations === 0, `every citation.url is absolute https:// (${badCitations} bad)`);
}

console.log(`\n${failures === 0 ? '✓ All checks passed.' : `✗ ${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
