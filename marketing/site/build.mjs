#!/usr/bin/env node
/**
 * Vacationist marketing-site builder.
 *
 * Reads Markdown content from marketing/site/content/**, renders static HTML
 * into docs/ (the GitHub Pages root), regenerates docs/sitemap.xml, and copies
 * the shared stylesheet to docs/assets/site.css.
 *
 * Output is deterministic: running the build twice produces a zero diff.
 * All dates come from front matter, never from the clock.
 *
 * Usage: npm run build:site
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { generateOgImage, ogImagePath } from './og-image.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTENT_DIR = join(ROOT, 'marketing', 'site', 'content');
const DOCS_DIR = join(ROOT, 'docs');
const SITE = 'https://vacationist.app';
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.vacationist.mobile';
const WEB_APP_URL = 'https://web.vacationist.app';
/* Per-page social-preview image (see og-image.mjs) — every generated content
   page gets its own, so shared links show a page-specific card instead of
   a generic one. The homepage (docs/index.html, hand-authored) keeps its
   own bespoke /og-image.png, untouched by this. */
const pageOgImage = (page) => `${SITE}/assets/og/${ogImagePath(page)}`;

/* Bump alongside apps/mobile/app.config.ts `version` on every MINOR/MAJOR
   release — feeds SoftwareApplication.softwareVersion (see softwareApplicationLd). */
const APP_VERSION = '1.26.0';

/**
 * Single source of truth for the SoftwareApplication/WebSite JSON-LD text,
 * shared by the hand-authored homepage's German transform (renderGermanHome)
 * and by generated pages that opt in via `appLd: true` front matter. Kept
 * here rather than in docs/i18n/*.js because generated content pages never
 * load docs/i18n — only the hand-authored homepage does.
 */
const APP_LD = {
  en: {
    description: 'The free group trip planning app. Vote on activities, split travel expenses, share packing lists, manage accommodations, and keep the whole group in sync — from the first idea to the last flight home.',
    featureList: 'Group activity voting, Travel expense splitting, Group chat, Shared packing lists, Shared shopping lists, Vacation tracker, Shared calendar, Transfer & flight management, Encrypted travel documents, Real-time sync, Offline support, Guest access without account',
    siteDescription: 'The free group trip planner — vote on activities, split travel expenses, share packing lists, and keep everyone in sync.',
  },
  de: {
    description: 'Die kostenlose Gruppenreise-App. Aktivitäten abstimmen, Reisekosten teilen, Packlisten teilen, Unterkünfte verwalten und die ganze Gruppe synchron halten — von der ersten Idee bis zum letzten Heimflug.',
    featureList: 'Aktivitäten-Abstimmung, Reisekosten teilen, Gruppenchat, Geteilte Packlisten, Geteilte Einkaufslisten, Urlaubsverfolgung, Gemeinsamer Kalender, Transfer- & Flugverwaltung, Verschlüsselte Reisedokumente, Echtzeit-Synchronisierung, Offline-Unterstützung, Gastzugang ohne Konto',
    siteDescription: 'Der kostenlose Gruppenreise-Planer — über Aktivitäten abstimmen, Reisekosten teilen, Packlisten teilen und alle synchron halten.',
  },
};

// For fresh insertion into head templates where the calling template literal
// has no indentation of its own (see jsonLd()'s block array, joined at column
// 0) — bakes in a 2-space indent so blocks align with surrounding <meta> tags.
const ldScript = (obj) =>
  `  <script type="application/ld+json">\n  ${JSON.stringify(obj, null, 2).split('\n').join('\n  ')}\n  </script>`;

// For regex-replacing a <script> block that's already indented in existing
// HTML (renderGermanHome, syncEnglishHomepageAppLd): the match starts at
// "<script", so the original file's leading whitespace before it is left
// untouched and must NOT be duplicated here — otherwise output indentation
// grows by two spaces every time the build re-reads its own prior output.
const ldScriptInPlace = (obj) =>
  `<script type="application/ld+json">\n  ${JSON.stringify(obj, null, 2).split('\n').join('\n  ')}\n  </script>`;

function softwareApplicationLd(lang) {
  const a = APP_LD[lang];
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${SITE}/#app`,
    name: 'Vacationist',
    applicationCategory: 'TravelApplication',
    applicationSubCategory: 'Group Trip Planner',
    operatingSystem: 'Android, Web',
    softwareVersion: APP_VERSION,
    description: a.description,
    url: `${SITE}/`,
    installUrl: PLAY_URL,
    downloadUrl: PLAY_URL,
    inLanguage: ['en', 'de'],
    isAccessibleForFree: true,
    featureList: a.featureList,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    author: {
      '@type': 'Person',
      name: 'Gary Lude',
      address: { '@type': 'PostalAddress', addressCountry: 'CH' },
    },
    publisher: { '@id': `${SITE}/#org` },
  };
}

function webSiteLd(lang) {
  const a = APP_LD[lang];
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Vacationist',
    url: `${SITE}/`,
    description: a.siteDescription,
    inLanguage: lang,
  };
}

/* Bump when docs/i18n/de.js or docs/index.html content changes materially —
   it is the <lastmod> of the generated German homepage. */
const DE_HOME_LASTMOD = '2026-07-26';

/* ── Hand-authored pages included in the sitemap (not generated here) ── */
const STATIC_SITEMAP_ENTRIES = [
  {
    loc: `${SITE}/`, lastmod: '2026-07-21', changefreq: 'monthly', priority: '1.0',
    alternates: [
      { hreflang: 'en', href: `${SITE}/` },
      { hreflang: 'de', href: `${SITE}/de/` },
      { hreflang: 'x-default', href: `${SITE}/` },
    ],
  },
  { loc: `${SITE}/scan/android-qr`, lastmod: '2026-07-11', changefreq: 'monthly', priority: '0.6' },
  {
    loc: `${SITE}/privacy-policy.html`, lastmod: '2026-05-23', changefreq: 'yearly', priority: '0.4',
    alternates: [
      { hreflang: 'en', href: `${SITE}/privacy-policy.html` },
      { hreflang: 'de', href: `${SITE}/de/privacy-policy/` },
      { hreflang: 'x-default', href: `${SITE}/privacy-policy.html` },
    ],
  },
  {
    loc: `${SITE}/terms-of-service.html`, lastmod: '2026-05-23', changefreq: 'yearly', priority: '0.4',
    alternates: [
      { hreflang: 'en', href: `${SITE}/terms-of-service.html` },
      { hreflang: 'de', href: `${SITE}/de/terms-of-service/` },
      { hreflang: 'x-default', href: `${SITE}/terms-of-service.html` },
    ],
  },
];
/* Note: /impressum.html is noindex — deliberately absent from the sitemap and
   from any hreflang cluster. The German /de/impressum/ page stands alone. */

/* ────────────────────────────── i18n strings ────────────────────────────── */

const STR = {
  en: {
    navFeatures: 'Features', navBlog: 'Blog', navWebApp: '🌐 Web app', navGetApp: 'Get the app',
    breadcrumbHome: 'Home', breadcrumbBlog: 'Blog', breadcrumbFeatures: 'Features', breadcrumbUseCases: 'Use cases',
    ctaTitle: 'Plan your next group trip with Vacationist',
    ctaText: 'Vote on activities, split expenses, and keep everyone in sync — free, no ads, and friends can join without an account. Available on Android and the web today; iOS is in development.',
    ctaPlay: 'Get it on Google Play', ctaWeb: 'Open the Web App',
    related: 'Keep reading',
    footerTagline: 'The free group trip planner — vote on activities, split expenses, share lists, and keep everyone in sync.',
    footerProduct: 'Product', footerCompare: 'Compare', footerResources: 'Resources', footerLegal: 'Legal',
    footerCopy: '© 2026 Vacationist · Gary Lude, Switzerland',
    blogIndexTitle: 'Vacationist Blog — Group Travel Planning Guides',
    blogIndexDesc: 'Practical guides on planning group trips, splitting travel expenses, and coordinating friends, families, and teams — from the makers of Vacationist.',
    blogIndexH1: 'The Vacationist blog',
    blogIndexIntro: 'Practical, honest guides on planning group trips: coordination, expense splitting, voting, and everything in between.',
  },
  de: {
    navFeatures: 'Funktionen', navBlog: 'Blog', navWebApp: '🌐 Web-App', navGetApp: 'App holen',
    breadcrumbHome: 'Startseite', breadcrumbBlog: 'Blog', breadcrumbFeatures: 'Funktionen', breadcrumbUseCases: 'Anwendungsfälle',
    ctaTitle: 'Plane deine nächste Gruppenreise mit Vacationist',
    ctaText: 'Über Aktivitäten abstimmen, Kosten teilen und alle auf dem gleichen Stand halten — kostenlos, ohne Werbung, und Freunde machen ohne Konto mit. Heute für Android und im Web verfügbar; die iOS-Version ist in Entwicklung.',
    ctaPlay: 'Bei Google Play laden', ctaWeb: 'Web-App öffnen',
    related: 'Weiterlesen',
    footerTagline: 'Der kostenlose Gruppenreise-Planer — über Aktivitäten abstimmen, Kosten teilen, Listen gemeinsam führen.',
    footerProduct: 'Produkt', footerCompare: 'Vergleiche', footerResources: 'Ressourcen', footerLegal: 'Rechtliches',
    footerCopy: '© 2026 Vacationist · Gary Lude, Schweiz',
    blogIndexTitle: 'Vacationist Blog — Guides für Gruppenreisen',
    blogIndexDesc: 'Praktische Guides rund um Gruppenreisen: Planung, Kostenteilung, Abstimmungen und Koordination — auf Deutsch und Englisch.',
    blogIndexH1: 'Der Vacationist-Blog',
    blogIndexIntro: 'Praktische, ehrliche Guides zur Planung von Gruppenreisen. Artikel auf Englisch sind entsprechend markiert.',
    postBadgeEn: 'Englisch',
  },
};

const FOOTER_LINKS = {
  en: {
    product: [
      ['/features/', 'All features'],
      ['/features/voting/', 'Activity voting'],
      ['/features/expenses/', 'Expense splitting'],
      ['/features/shopping-lists/', 'Shared lists'],
      ['/features/travel-documents/', 'Travel documents'],
      // Only 2 of 6 /use-cases/ niches are footer-linked sitewide (space —
      // the product column is already 5 features + these). Bachelorette +
      // van-life chosen as the broadest-appeal pair; revisit once Search
      // Console shows which niches are actually ranking (see
      // marketing/seo-strategy.md, Pillar 5 "next niches to scale").
      ['/use-cases/', 'Use cases'],
      ['/use-cases/bachelorette-party-planner/', 'Bachelorette party planner'],
      ['/use-cases/van-life-trip-planner/', 'Van life trip planner'],
    ],
    compare: [
      ['/vs/splitwise/', 'Vacationist vs. Splitwise'],
      ['/vs/wanderlog/', 'Vacationist vs. Wanderlog'],
      ['/alternatives/splitwise/', 'Splitwise alternatives'],
      ['/alternatives/wanderlog/', 'Wanderlog alternatives'],
    ],
    resources: [
      ['/blog/', 'Blog'],
      ['/blog/how-to-plan-a-group-trip/', 'Group trip planning guide'],
      ['/blog/best-group-travel-apps-2026/', 'Best group travel apps'],
      ['/blog/how-to-split-travel-expenses/', 'Expense splitting guide'],
    ],
    legal: [
      ['/privacy-policy.html', 'Privacy Policy'],
      ['/terms-of-service.html', 'Terms of Service'],
      ['/impressum.html', 'Impressum'],
      ['#cookie-settings', 'Cookie settings'],
      ['mailto:meetdeep.de@gmail.com', 'Contact'],
    ],
  },
  de: {
    product: [
      ['/de/features/', 'Alle Funktionen'],
      ['/de/features/voting/', 'Aktivitäten-Voting'],
      ['/de/features/expenses/', 'Kosten teilen'],
      ['/de/features/shopping-lists/', 'Gemeinsame Listen'],
      ['/de/features/travel-documents/', 'Reisedokumente'],
      // Same provisional 2-of-6 selection as FOOTER_LINKS.en.product above —
      // see that comment for the rationale.
      ['/de/use-cases/', 'Anwendungsfälle'],
      ['/de/use-cases/bachelorette-party-planner/', 'Junggesellinnenabschied planen'],
      ['/de/use-cases/van-life-trip-planner/', 'Van-Life-Reiseplaner'],
    ],
    compare: [
      ['/de/vs/splitwise/', 'Vacationist vs. Splitwise'],
      ['/de/vs/wanderlog/', 'Vacationist vs. Wanderlog'],
      ['/de/alternatives/splitwise/', 'Splitwise-Alternativen'],
      ['/de/alternatives/wanderlog/', 'Wanderlog-Alternativen'],
    ],
    resources: [
      ['/de/blog/', 'Blog'],
      ['/de/blog/how-to-plan-a-group-trip/', 'Gruppenreise-Planungs-Guide'],
      ['/de/blog/best-group-travel-apps-2026/', 'Beste Gruppenreise-Apps'],
      ['/de/blog/how-to-split-travel-expenses/', 'Reisekosten-Guide'],
    ],
    legal: [
      ['/de/privacy-policy/', 'Datenschutz'],
      ['/de/terms-of-service/', 'Nutzungsbedingungen'],
      ['/de/impressum/', 'Impressum'],
      ['#cookie-settings', 'Cookie-Einstellungen'],
      ['mailto:meetdeep.de@gmail.com', 'Kontakt'],
    ],
  },
};

/* ────────────────────────────── helpers ────────────────────────────── */

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const slugify = (s) => s.toLowerCase()
  .replace(/&#?[a-z0-9]+;/g, '').replace(/[^a-z0-9äöüß\s-]/g, '')
  .trim().replace(/\s+/g, '-');

/** Strip markdown formatting to plain text (for JSON-LD FAQ answers). */
function mdToText(md) {
  return md
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

/** Parse `---` front matter (simple `key: value` lines, no YAML). */
function parseFrontMatter(raw, file) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) throw new Error(`Missing front matter in ${file}`);
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) throw new Error(`Bad front matter line "${line}" in ${file}`);
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { meta, body: raw.slice(m[0].length) };
}

/**
 * Extract a FAQ section (`## Frequently asked questions` / `## Häufige Fragen`)
 * from the markdown body. Returns [{q, a}] with plain-text answers.
 * The section stays in the rendered page; JSON-LD mirrors it exactly.
 */
function extractFaq(body) {
  const m = body.match(/^##\s+(Frequently asked questions|Häufige Fragen)\s*$/im);
  if (!m) return [];
  const start = m.index + m[0].length;
  const rest = body.slice(start);
  const endMatch = rest.match(/^##\s+[^#]/m);
  const section = endMatch ? rest.slice(0, endMatch.index) : rest;
  const faqs = [];
  const parts = section.split(/^###\s+/m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf('\n');
    if (nl === -1) continue;
    const q = part.slice(0, nl).trim();
    const a = mdToText(part.slice(nl + 1));
    if (q && a) faqs.push({ q, a });
  }
  return faqs;
}

/* marked setup: GFM on, heading ids for in-page anchors */
marked.use({
  gfm: true,
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const id = slugify(text.replace(/<[^>]*>/g, ''));
      return `<h${depth} id="${id}">${text}</h${depth}>\n`;
    },
  },
});

/* ────────────────────────────── page model ────────────────────────────── */

function loadPages() {
  const pages = [];
  for (const file of walk(CONTENT_DIR)) {
    const raw = readFileSync(file, 'utf8');
    const { meta, body } = parseFrontMatter(raw, relative(ROOT, file));
    for (const key of ['title', 'description', 'path', 'lang', 'type', 'date']) {
      if (!meta[key]) throw new Error(`Missing "${key}" in ${relative(ROOT, file)}`);
    }
    if (!meta.path.startsWith('/') || !meta.path.endsWith('/')) {
      throw new Error(`path must start and end with "/" in ${relative(ROOT, file)}`);
    }
    pages.push({
      ...meta,
      updated: meta.updated || meta.date,
      schema: meta.schema || 'WebPage',
      blogIndex: meta.blogIndex === 'true',
      appLd: meta.appLd === 'true',
      related: meta.related ? meta.related.split(',').map((s) => s.trim()).filter(Boolean) : [],
      body,
      faqs: extractFaq(body),
      file: relative(ROOT, file),
    });
  }
  return pages;
}

/* ────────────────────────────── rendering ────────────────────────────── */

const LOGO_SVG = `<svg class="nav-logo-icon" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><radialGradient id="nlg" cx="42%" cy="38%" r="72%"><stop offset="0%" stop-color="#2D1B69"/><stop offset="100%" stop-color="#09060F"/></radialGradient></defs>
      <rect width="512" height="512" fill="url(#nlg)" rx="96"/>
      <path d="M 108 108 L 256 366 L 404 108" stroke="#fff" stroke-width="72" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="256" cy="366" r="52" fill="#6C63FF"/><circle cx="256" cy="366" r="22" fill="#fff"/>
    </svg>`;

function breadcrumbs(page, registry) {
  const t = STR[page.lang];
  const isDe = page.lang === 'de';
  const crumbs = [{ name: t.breadcrumbHome, path: isDe ? '/de/' : '/' }];
  if (page.path === '/de/') return [{ name: t.breadcrumbHome, path: '/' }, { name: 'Deutsch', path: '/de/' }];
  const segs = page.path.split('/').filter(Boolean);
  // German pages live under /de/…; the section segment comes after the prefix.
  const rel = segs[0] === 'de' ? segs.slice(1) : segs;
  if (rel[0] === 'blog' && rel.length > 1) crumbs.push({ name: t.breadcrumbBlog, path: isDe ? '/de/blog/' : '/blog/' });
  if (rel[0] === 'features' && rel.length > 1) crumbs.push({ name: t.breadcrumbFeatures, path: isDe ? '/de/features/' : '/features/' });
  if (rel[0] === 'use-cases' && rel.length > 1) crumbs.push({ name: t.breadcrumbUseCases, path: isDe ? '/de/use-cases/' : '/use-cases/' });
  const label = page.breadcrumbLabel || page.title.split(/[:|—|]/)[0].trim();
  crumbs.push({ name: label, path: page.path });
  return crumbs;
}

function jsonLd(page, registry) {
  const blocks = [];
  const url = SITE + page.path;
  const crumbs = breadcrumbs(page, registry);

  // Extractable by AI answer engines / voice assistants — points at the
  // .lede short-answer paragraph (comparison/listicle pages) and .tldr
  // callouts (use-case pages), both already present in the rendered body.
  const speakable = {
    '@type': 'SpeakableSpecification',
    cssSelector: ['.lede', '.tldr'],
  };

  if (page.schema === 'Article' || page.schema === 'BlogPosting') {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': page.schema,
      headline: page.title,
      description: page.description,
      url,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      speakable,
      datePublished: page.date,
      dateModified: page.updated,
      inLanguage: page.lang,
      author: { '@type': 'Person', 'name': 'Gary Lude', 'address': { '@type': 'PostalAddress', 'addressCountry': 'CH' } },
      publisher: { '@type': 'Organization', 'name': 'Vacationist', 'url': `${SITE}/`, 'logo': { '@type': 'ImageObject', 'url': `${SITE}/favicon.svg` } },
      image: pageOgImage(page),
    });
  } else {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.title,
      description: page.description,
      url,
      speakable,
      inLanguage: page.lang,
      isPartOf: { '@type': 'WebSite', 'name': 'Vacationist', 'url': `${SITE}/` },
    });
  }

  blocks.push({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem', position: i + 1, name: c.name, item: SITE + c.path,
    })),
  });

  if (page.faqs.length) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faqs.map(({ q, a }) => ({
        '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    });
  }

  // Commercial-intent pages (features, use-cases) carry the product entity
  // alongside their own page schema, so AI engines can resolve "what is this
  // page about" -> "what is the product" in one hop.
  if (page.appLd) blocks.push(softwareApplicationLd(page.lang));

  return blocks.map((b) => ldScript(b)).join('\n');
}

function navHtml(page) {
  const t = STR[page.lang];
  const isDe = page.lang === 'de';
  // navAltPath links the language switcher to a hand-authored counterpart page
  // without pulling it into the hreflang cluster (see altPath / hreflangLinks) —
  // used by pages like /de/impressum/ whose EN counterpart is deliberately
  // noindex and hreflang-isolated.
  const switchPath = page.navAltPath || page.altPath;
  // DE first (primary audience is DACH), current language highlighted.
  const deSide = isDe
    ? '<span class="lp-on">DE</span>'
    : `<a href="${switchPath && switchPath !== '/' ? switchPath : '/de/'}" title="Deutsche Version">DE</a>`;
  const enSide = isDe
    ? `<a href="${switchPath && switchPath !== '/' ? switchPath : '/?lang=en'}" title="English version">EN</a>`
    : '<span class="lp-on">EN</span>';
  const home = isDe ? '/de/' : '/';
  return `<nav class="nav">
  <a class="nav-logo" href="${home}">
    ${LOGO_SVG}
    Vacationist
  </a>
  <div class="nav-links">
    <a href="${isDe ? '/de/features/' : '/features/'}">${t.navFeatures}</a>
    <a href="${isDe ? '/de/blog/' : '/blog/'}">${t.navBlog}</a>
    <a href="${WEB_APP_URL}" class="nav-cta-web" target="_blank" rel="noopener noreferrer">${t.navWebApp}</a>
    <a href="${PLAY_URL}" class="nav-cta" target="_blank" rel="noopener noreferrer">${t.navGetApp}</a>
    <span class="lang-pair" aria-label="${isDe ? 'Sprache' : 'Language'}">${deSide}${enSide}</span>
  </div>
</nav>`;
}

function ctaHtml(lang) {
  const t = STR[lang];
  return `<div class="cta-band">
  <h3>${esc(t.ctaTitle)}</h3>
  <p>${esc(t.ctaText)}</p>
  <div class="cta-actions">
    <a class="btn-white" href="${PLAY_URL}" target="_blank" rel="noopener noreferrer">${esc(t.ctaPlay)}</a>
    <a class="btn-outline" href="${WEB_APP_URL}" target="_blank" rel="noopener noreferrer">${esc(t.ctaWeb)}</a>
  </div>
</div>`;
}

function relatedHtml(page, registry) {
  if (!page.related.length) return '';
  const t = STR[page.lang];
  const cards = page.related.map((p) => {
    const target = registry.get(p);
    if (!target) {
      console.warn(`  ! ${page.file}: related path ${p} not found — skipping`);
      return '';
    }
    const label = target.breadcrumbLabel || target.title.split(/[:|—|]/)[0].trim();
    return `    <a class="related-card" href="${p}">
      <span class="related-title">${esc(label)}</span>
      <span class="related-desc">${esc(target.description)}</span>
    </a>`;
  }).filter(Boolean).join('\n');
  if (!cards) return '';
  return `<section class="related">
  <h2 class="related-heading">${esc(t.related)}</h2>
  <div class="related-grid">
${cards}
  </div>
</section>`;
}

function footerHtml(lang) {
  const t = STR[lang];
  const links = FOOTER_LINKS[lang];
  const col = (title, items) => `    <div class="footer-col">
      <h4>${esc(title)}</h4>
${items.map(([href, label]) => `      <a href="${href}">${esc(label)}</a>`).join('\n')}
    </div>`;
  return `<footer class="site-footer">
  <div class="footer-inner">
    <div class="footer-brand">
      <span class="footer-logo">Vacationist</span>
      <p>${esc(t.footerTagline)}</p>
    </div>
${col(t.footerProduct, links.product)}
${col(t.footerCompare, links.compare)}
${col(t.footerResources, links.resources)}
${col(t.footerLegal, links.legal)}
  </div>
  <div class="footer-copy">${esc(t.footerCopy)}</div>
</footer>`;
}

function hreflangLinks(page) {
  if (!page.altPath) return '';
  const en = page.lang === 'en' ? page.path : page.altPath;
  const de = page.lang === 'de' ? page.path : page.altPath;
  return `  <link rel="alternate" hreflang="en" href="${SITE}${en}">
  <link rel="alternate" hreflang="de" href="${SITE}${de}">
  <link rel="alternate" hreflang="x-default" href="${SITE}${en}">
`;
}

function renderPage(page, registry, contentHtml) {
  const t = STR[page.lang];
  const url = SITE + page.path;
  const ogType = ['comparison', 'listicle', 'article', 'pillar'].includes(page.type) ? 'article' : 'website';
  const crumbs = breadcrumbs(page, registry);
  const crumbHtml = crumbs.map((c, i) => (
    i === crumbs.length - 1
      ? `<span aria-current="page">${esc(c.name)}</span>`
      : `<a href="${c.path}">${esc(c.name)}</a>`
  )).join(' <span class="crumb-sep">/</span> ');

  const dateLine = (page.schema === 'BlogPosting' || page.schema === 'Article')
    ? `\n    <p class="article-meta">${page.lang === 'de' ? 'Aktualisiert' : 'Updated'} <time datetime="${page.updated}">${page.updated}</time></p>`
    : '';

  return `<!DOCTYPE html>
<html lang="${page.lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Analytics: gated behind opt-in consent (Consent Mode v2). See marketing/site/consent.js -->
  <script defer src="/assets/consent.js"></script>

  <title>${esc(page.title)}</title>
  <meta name="description" content="${esc(page.description)}">
${page.keywords ? `  <meta name="keywords" content="${esc(page.keywords)}">\n` : ''}
  <link rel="canonical" href="${url}">
${hreflangLinks(page)}
  <link rel="alternate" type="application/rss+xml" title="Vacationist Blog" href="${page.lang === 'de' ? `${SITE}/de/blog/feed.xml` : `${SITE}/blog/feed.xml`}">
  <meta property="og:title" content="${esc(page.title)}">
  <meta property="og:description" content="${esc(page.description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:image" content="${pageOgImage(page)}">
  <meta property="og:site_name" content="Vacationist">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(page.title)}">
  <meta name="twitter:description" content="${esc(page.description)}">
  <meta name="twitter:image" content="${pageOgImage(page)}">

${jsonLd(page, registry)}

  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preload" href="/assets/fonts/InterVariable-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/fonts/inter-face.css">
  <link rel="stylesheet" href="/assets/site.css">
</head>
<body>

${navHtml(page)}

<main class="page">
  <nav class="crumbs" aria-label="Breadcrumb">${crumbHtml}</nav>
  <article class="article">${dateLine}
${contentHtml}
  </article>

${relatedHtml(page, registry)}
</main>

${footerHtml(page.lang)}

</body>
</html>
`;
}

/* ────────────────────────── German homepage (/de/) ────────────────────────
 * Generated as a full transform of docs/index.html using the reviewed
 * translations in docs/i18n/de.js — same hero, mockup, features, and FAQ as
 * the English landing page, but statically German and crawlable. Single
 * source of truth stays index.html + de.js.
 */

function loadDeTranslations() {
  const code = readFileSync(join(DOCS_DIR, 'i18n', 'de.js'), 'utf8');
  const win = {};
  new Function('window', code)(win);
  if (!win.VACATIONIST_I18N || win.VACATIONIST_I18N.__lang !== 'de') {
    throw new Error('Failed to load docs/i18n/de.js translations');
  }
  return win.VACATIONIST_I18N;
}

const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function renderGermanHome() {
  const t = loadDeTranslations();
  let html = readFileSync(join(DOCS_DIR, 'index.html'), 'utf8');

  // 1. Translate data-i18n elements (plain-text content by contract of i18n.js)
  html = html.replace(/(data-i18n="([^"]+)"[^>]*>)([^<]*)/g, (m, open, key, text) =>
    t[key] !== undefined ? open + escText(t[key]) : m);

  // 2. Translate data-i18n-html elements (raw HTML values, h1/h2 only)
  html = html.replace(/(<h(\d)[^>]*data-i18n-html="([^"]+)"[^>]*>)([\s\S]*?)(<\/h\2>)/g,
    (m, open, lvl, key, inner, close) => (t[key] !== undefined ? open + t[key] + close : m));

  // 3. Head: lang, title, description, keywords, OG/Twitter, canonical, og:url
  html = html.replace('<html lang="en">', '<html lang="de">');
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escText(t['meta.title'])}</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*(">)/, `$1${esc(t['meta.description'])}$2`);
  html = html.replace(/(<meta name="keywords" content=")[^"]*(">)/,
    '$1Gruppenreise planen App, Reise App Gruppe, Urlaubsplaner App Gruppe, Reisekosten teilen App, Kosten teilen Urlaub App, Gruppenreise-Planer, Reiseplaner Gruppe, Packliste App, Junggesellinnenabschied planen App$2');
  html = html.replace(/(<meta property="og:title" content=")[^"]*(">)/, `$1${esc(t['meta.og_title'])}$2`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*(">)/, `$1${esc(t['meta.og_description'])}$2`);
  html = html.replace(/(<meta name="twitter:title" content=")[^"]*(">)/, `$1${esc(t['meta.twitter_title'])}$2`);
  html = html.replace(/(<meta name="twitter:description" content=")[^"]*(">)/, `$1${esc(t['meta.twitter_description'])}$2`);
  html = html.replace('<link rel="canonical" href="https://vacationist.app/">', `<link rel="canonical" href="${SITE}/de/">`);
  html = html.replace('href="https://vacationist.app/blog/feed.xml"', `href="${SITE}/de/blog/feed.xml"`);
  html = html.replace('<meta property="og:url" content="https://vacationist.app/">', `<meta property="og:url" content="${SITE}/de/">`);

  // 4. FAQPage JSON-LD → rebuild from German FAQ strings so it matches the page
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [1, 2, 3, 4, 5, 6]
      .filter((n) => t[`faq.${n}.q`] && t[`faq.${n}.a`])
      .map((n) => ({
        '@type': 'Question', name: t[`faq.${n}.q`],
        acceptedAnswer: { '@type': 'Answer', text: t[`faq.${n}.a`] },
      })),
  };
  html = html.replace(
    /<script type="application\/ld\+json">\s*\{\s*"@context": "https:\/\/schema\.org",\s*"@type": "FAQPage"[\s\S]*?<\/script>/,
    `<script type="application/ld+json">\n  ${JSON.stringify(faqLd, null, 2).split('\n').join('\n  ')}\n  </script>`);

  // 4b. SoftwareApplication / WebSite JSON-LD → German description text.
  // These previously stayed English on /de/ because only the FAQ block above
  // was rebuilt from translated strings.
  html = html.replace(
    /<script type="application\/ld\+json">\s*\{\s*"@context": "https:\/\/schema\.org",\s*"@type": "SoftwareApplication"[\s\S]*?<\/script>/,
    ldScriptInPlace(softwareApplicationLd('de')));
  html = html.replace(
    /<script type="application\/ld\+json">\s*\{\s*"@context": "https:\/\/schema\.org",\s*"@type": "WebSite"[\s\S]*?<\/script>/,
    ldScriptInPlace(webSiteLd('de')));

  // 5. Root-relative URLs (page lives one level deeper), then German-specific links
  html = html.replace(/href="\.\//g, 'href="/').replace(/src="\.\//g, 'src="/');
  html = html.replace('class="nav-logo" href="/"', 'class="nav-logo" href="/de/"');

  // 6. Static language switcher: DE active, EN → English homepage with explicit override
  html = html.replace(
    /<div class="lang-switcher" aria-label="Language">[\s\S]*?<\/div>/,
    `<div class="lang-switcher" aria-label="Sprache">
      <span class="lang-de lang-active">DE</span>
      <a class="lang-de" href="/?lang=en" title="English version">EN</a>
    </div>`);

  // 7. Language-dependent hrefs (strip card 4 → German article).
  // (?<!-) keeps the match off the data-i18n-href attribute itself.
  html = html.replace(/(<a[^>]*data-i18n-href="([^"]+)"[^>]*>)/g, (m, tag, key) =>
    t[key] !== undefined ? tag.replace(/(?<!-)href="[^"]*"/, `href="${t[key]}"`) : m);

  // 8. No client-side i18n on the static German page
  html = html.replace(/<script src="\/i18n\.js"><\/script>\s*/, '');

  return html;
}

/* Keeps docs/index.html's own SoftwareApplication/WebSite JSON-LD in sync
   with APP_LD.en / APP_VERSION at build time, mirroring what step 4b of
   renderGermanHome() already does for 'de'. Without this, the EN homepage
   is a third hand-written copy of the same text that can silently drift —
   which is exactly the bug class this file's DE fix addressed. */
function syncEnglishHomepageAppLd() {
  const file = join(DOCS_DIR, 'index.html');
  let html = readFileSync(file, 'utf8');
  html = html.replace(
    /<script type="application\/ld\+json">\s*\{\s*"@context": "https:\/\/schema\.org",\s*"@type": "SoftwareApplication"[\s\S]*?<\/script>/,
    ldScriptInPlace(softwareApplicationLd('en')));
  html = html.replace(
    /<script type="application\/ld\+json">\s*\{\s*"@context": "https:\/\/schema\.org",\s*"@type": "WebSite"[\s\S]*?<\/script>/,
    ldScriptInPlace(webSiteLd('en')));
  writeOut(file, html);
}

function germanHomePage(t) {
  return {
    title: t['meta.title'],
    description: t['meta.description'],
    path: '/de/',
    lang: 'de',
    type: 'home-de',
    schema: 'WebPage',
    date: DE_HOME_LASTMOD,
    updated: DE_HOME_LASTMOD,
    blogIndex: false,
    related: [],
    faqs: [],
    breadcrumbLabel: 'Vacationist auf Deutsch',
    altPath: '/',
    body: '',
    file: '(generated from docs/index.html + docs/i18n/de.js)',
  };
}

/* ────────────────────────────── blog index ────────────────────────────── */

function blogIndexPage(lang) {
  const t = STR[lang];
  return {
    title: t.blogIndexTitle,
    description: t.blogIndexDesc,
    path: lang === 'de' ? '/de/blog/' : '/blog/',
    lang,
    type: 'blog-index',
    schema: 'WebPage',
    date: '2026-07-17',
    updated: '2026-07-17',
    altPath: lang === 'de' ? '/blog/' : '/de/blog/',
    blogIndex: false,
    related: [],
    faqs: [],
    breadcrumbLabel: 'Blog',
    body: '',
    file: '(generated)',
  };
}

function postCard(p, { title, description, badge } = {}) {
  return `    <a class="post-card" href="${p.path}">
      <time datetime="${p.date}">${p.date}</time>${badge ? ` <span class="post-badge">${esc(badge)}</span>` : ''}
      <h2>${esc(title || p.title)}</h2>
      <p>${esc(description || p.description)}</p>
    </a>`;
}

function renderBlogIndex(pages, registry) {
  const t = STR.en;
  const posts = pages
    .filter((p) => p.blogIndex && p.lang === 'en')
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const page = blogIndexPage('en');
  if (posts.length) page.updated = posts[0].updated;

  const content = `
    <h1>${esc(t.blogIndexH1)}</h1>
    <p class="lede">${esc(t.blogIndexIntro)}</p>
    <div class="post-list">
${posts.map((p) => postCard(p)).join('\n')}
    </div>`;

  return { page, html: renderPage(page, registry, content) };
}

/**
 * German blog overview at /de/blog/: German blog articles first, then any
 * English guides that have no German counterpart yet, shown with German
 * titles/descriptions (titleDe/descriptionDe front matter) and an "Englisch"
 * badge.
 */
function renderGermanBlogIndex(pages, registry) {
  const t = STR.de;
  const dePosts = pages
    .filter((p) => p.lang === 'de' && p.path.startsWith('/de/blog/'))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const enPosts = pages
    .filter((p) => p.blogIndex && p.lang === 'en' && !p.altPath)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const cards = [
    ...dePosts.map((p) => postCard(p)),
    ...enPosts.map((p) => postCard(p, {
      title: p.titleDe || p.title,
      description: p.descriptionDe || p.description,
      badge: t.postBadgeEn,
    })),
  ].join('\n');

  const page = blogIndexPage('de');
  if (dePosts.length) page.updated = dePosts[0].updated;

  const content = `
    <h1>${esc(t.blogIndexH1)}</h1>
    <p class="lede">${esc(t.blogIndexIntro)}</p>
    <div class="post-list">
${cards}
    </div>`;

  return { page, html: renderPage(page, registry, content) };
}

/* ────────────────────────────── RSS feed ────────────────────────────── */

/**
 * RSS 2.0 feed for /blog/ posts only (the actual publishing cadence — not
 * the evergreen /vs/, /alternatives/, /use-cases/ pages). `lastBuildDate`
 * derives from the newest post's front-matter `updated` date, never
 * `Date.now()` — the build must stay idempotent (see file header).
 */
function renderRssFeed(posts, lang) {
  const t = STR[lang];
  const base = lang === 'de' ? `${SITE}/de/blog/` : `${SITE}/blog/`;
  const feedUrl = `${base}feed.xml`;

  const items = posts.map((p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${SITE}${p.path}</link>
      <guid isPermaLink="true">${SITE}${p.path}</guid>
      <description>${esc(p.description)}</description>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
    </item>`).join('\n');

  const lastBuildDate = new Date(posts.length ? posts[0].updated : '2026-01-01').toUTCString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(t.blogIndexTitle)}</title>
    <link>${base}</link>
    <description>${esc(t.blogIndexDesc)}</description>
    <language>${lang === 'de' ? 'de-de' : 'en-us'}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

/* ────────────────────────────── sitemap ────────────────────────────── */

function renderSitemap(allPages) {
  const entries = [...STATIC_SITEMAP_ENTRIES];

  for (const p of allPages.sort((a, b) => a.path.localeCompare(b.path))) {
    const entry = {
      loc: SITE + p.path,
      lastmod: p.updated,
      changefreq: 'monthly',
      priority: p.type === 'pillar' ? '0.9' : (p.path === '/de/' ? '0.9' : '0.8'),
    };
    if (p.altPath) {
      const en = p.lang === 'en' ? p.path : p.altPath;
      const de = p.lang === 'de' ? p.path : p.altPath;
      entry.alternates = [
        { hreflang: 'en', href: SITE + en },
        { hreflang: 'de', href: SITE + de },
        { hreflang: 'x-default', href: SITE + en },
      ];
    }
    entries.push(entry);
  }

  const urlXml = entries.map((e) => {
    let xml = `  <url>\n    <loc>${e.loc}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n`;
    if (e.alternates) {
      for (const a of e.alternates) {
        xml += `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}"/>\n`;
      }
    }
    return xml + '  </url>';
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlXml}
</urlset>
`;
}

/* ────────────────────────────── main ────────────────────────────── */

function outPathFor(pagePath) {
  return join(DOCS_DIR, ...pagePath.split('/').filter(Boolean), 'index.html');
}

function writeOut(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content.replace(/\r\n/g, '\n'), 'utf8');
  console.log(`  ✓ ${relative(ROOT, file).replace(/\\/g, '/')}`);
}

// Binary sibling of writeOut() — no CRLF normalization, same reasoning as
// the font copy below (normalizing would corrupt PNG bytes).
function writeBinary(file, buf) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buf);
  console.log(`  ✓ ${relative(ROOT, file).replace(/\\/g, '/')}`);
}

async function main() {
  console.log('Building marketing site…');

  const pages = loadPages();
  const registry = new Map(pages.map((p) => [p.path, p]));

  // Synthetic /de/ homepage (transformed from index.html + de.js, not from markdown)
  const deHome = germanHomePage(loadDeTranslations());
  registry.set('/de/', deHome);

  // Validate altPath pairs are bidirectional ("/" is the hand-authored homepage,
  // whose hreflang back-links live in index.html and the static sitemap entry;
  // ".html" altPaths point at hand-authored static pages outside the registry,
  // whose hreflang back-links are maintained in the HTML files themselves)
  for (const p of pages) {
    if (p.altPath && p.altPath !== '/' && !p.altPath.endsWith('.html')) {
      const alt = registry.get(p.altPath);
      if (!alt) throw new Error(`${p.file}: altPath ${p.altPath} has no matching page`);
      if (alt.altPath !== p.path) throw new Error(`${p.file}: altPath pair is not bidirectional (${p.path} ↔ ${p.altPath})`);
    }
  }

  // Content pages, each with its own generated social-preview image (og-image.mjs)
  for (const page of pages) {
    let body = page.body.replace(/<!--CTA-->/g, ctaHtml(page.lang));
    const contentHtml = marked.parse(body);
    writeOut(outPathFor(page.path), renderPage(page, registry, contentHtml));
    writeBinary(join(DOCS_DIR, 'assets', 'og', ogImagePath(page)), await generateOgImage(page));
  }

  // Blog indexes (generated, no md source) — also rendered via renderPage(),
  // so they reference pageOgImage() too and need their own generated image.
  const blogIndex = renderBlogIndex(pages, registry);
  registry.set('/blog/', blogIndex.page);
  writeOut(outPathFor('/blog/'), blogIndex.html);
  writeBinary(join(DOCS_DIR, 'assets', 'og', ogImagePath(blogIndex.page)), await generateOgImage(blogIndex.page));

  const deBlogIndex = renderGermanBlogIndex(pages, registry);
  registry.set('/de/blog/', deBlogIndex.page);
  writeOut(outPathFor('/de/blog/'), deBlogIndex.html);
  writeBinary(join(DOCS_DIR, 'assets', 'og', ogImagePath(deBlogIndex.page)), await generateOgImage(deBlogIndex.page));

  // RSS feeds — same post filters renderBlogIndex()/renderGermanBlogIndex() use
  const enPosts = pages.filter((p) => p.blogIndex && p.lang === 'en').sort((a, b) => (a.date < b.date ? 1 : -1));
  writeOut(join(DOCS_DIR, 'blog', 'feed.xml'), renderRssFeed(enPosts, 'en'));

  const dePosts = pages.filter((p) => p.lang === 'de' && p.path.startsWith('/de/blog/')).sort((a, b) => (a.date < b.date ? 1 : -1));
  writeOut(join(DOCS_DIR, 'de', 'blog', 'feed.xml'), renderRssFeed(dePosts, 'de'));

  // English homepage: keep its own SoftwareApplication/WebSite JSON-LD in
  // sync with APP_LD.en / APP_VERSION (see syncEnglishHomepageAppLd).
  syncEnglishHomepageAppLd();

  // German homepage: full transform of the English landing page
  writeOut(outPathFor('/de/'), renderGermanHome());

  // Shared stylesheet
  const css = readFileSync(join(ROOT, 'marketing', 'site', 'site.css'), 'utf8');
  writeOut(join(DOCS_DIR, 'assets', 'site.css'), css);

  // Shared consent/analytics script (text — safe through writeOut, which normalizes CRLF)
  const consentJs = readFileSync(join(ROOT, 'marketing', 'site', 'consent.js'), 'utf8');
  writeOut(join(DOCS_DIR, 'assets', 'consent.js'), consentJs);

  // Self-hosted font — BINARY. Must NOT go through writeOut(): its \r\n -> \n
  // normalization would corrupt the woff2. Byte-for-byte copy keeps the build idempotent.
  const fontDir = join(DOCS_DIR, 'assets', 'fonts');
  mkdirSync(fontDir, { recursive: true });
  for (const f of ['InterVariable-latin.woff2', 'OFL.txt', 'inter-face.css']) {
    copyFileSync(join(ROOT, 'marketing', 'site', 'fonts', f), join(fontDir, f));
  }

  // Sitemap (all generated pages + blog indexes + German home + static entries)
  const allPages = [...pages, blogIndex.page, deBlogIndex.page, deHome];
  writeOut(join(DOCS_DIR, 'sitemap.xml'), renderSitemap(allPages));

  console.log(`Done — ${pages.length + 3} pages, ${pages.length + 2} OG images, sitemap, stylesheet, consent script, fonts.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
