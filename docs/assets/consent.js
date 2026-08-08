/* Vacationist — cookie consent (Consent Mode v2) + Google Analytics + Reddit Pixel loader.
 *
 * Neither GA nor the Reddit Pixel is ever requested until the visitor actively accepts —
 * one combined Accept/Decline covers both. This file is copied byte-for-byte to
 * docs/assets/consent.js by build.mjs and is the ONLY place GA/Reddit are loaded from — see
 * CLAUDE.md "Marketing Site". track.js (loaded right after this file) reads window.__vConsent
 * / the "v:consent" event set here instead of duplicating any consent logic.
 *
 * Loaded with <script defer src="/assets/consent.js"> on all 43 site pages
 * (36 generated + 7 hand-authored). Banner copy lives here, not in
 * docs/i18n/*.js, because generated pages never load i18n.js and the /de/
 * homepage transform strips it — see resolveLang() below.
 */
(function () {
  'use strict';

  var GA_ID = 'G-4DRBWGQHE3';
  var RDT_ID = 'a2_jcz7aqtl8eua';
  var STORAGE_KEY = 'v_consent';
  // Bumped 1 -> 2: existing stored decisions were given under analytics-only copy. Reusing
  // them to also enable advertising cookies (Reddit Pixel) would not be valid consent, so the
  // schema bump invalidates them and every returning visitor is re-prompted once under the
  // new combined Analytics + Advertising copy below.
  var SCHEMA = 2;
  var MAX_AGE_DAYS = 365;

  var COPY = {
    en: {
      aria: 'Cookie consent',
      title: 'Cookies on this site',
      body: 'We use Google Analytics and the Reddit Pixel to understand how visitors use this site and how our ads perform. Both only run if you accept — nothing is set beforehand.',
      accept: 'Accept',
      decline: 'Decline',
      privacy: 'Privacy policy',
      privacyHref: '/privacy-policy.html'
    },
    de: {
      aria: 'Cookie-Einwilligung',
      title: 'Cookies auf dieser Website',
      body: 'Wir nutzen Google Analytics und das Reddit-Pixel, um zu verstehen, wie Besucher diese Website nutzen und wie unsere Anzeigen wirken. Beide laufen nur, wenn du zustimmst — vorher wird nichts gesetzt.',
      accept: 'Akzeptieren',
      decline: 'Ablehnen',
      privacy: 'Datenschutzerklärung',
      privacyHref: '/de/privacy-policy/'
    }
  };

  /* ── 1. dataLayer + gtag + Consent Mode v2 defaults. Pure queue pushes — zero network. ── */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted'
  });

  /* ── 2. GA loader — guarded so it can never run twice, called only after opt-in ── */
  var gaLoaded = false;
  function loadGa() {
    if (gaLoaded) return;
    gaLoaded = true;
    gtag('js', new Date());
    gtag('config', GA_ID);
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
  }

  /* ── 2b. Reddit Pixel loader — same guard shape and script-injection style as loadGa
   * (document.head.appendChild, not the getElementsByTagName/insertBefore form some of
   * Reddit's own docs show — functionally identical, but keeps both loaders consistent and
   * testable against the same minimal DOM shim in consent.test.js), called only after
   * opt-in. ── */
  var rdtLoaded = false;
  function loadRdt() {
    if (rdtLoaded) return;
    rdtLoaded = true;
    if (!window.rdt) {
      var p = window.rdt = function () {
        p.sendEvent ? p.sendEvent.apply(p, arguments) : p.callQueue.push(arguments);
      };
      p.callQueue = [];
      var t = document.createElement('script');
      t.async = true;
      t.src = 'https://www.redditstatic.com/ads/pixel.js';
      document.head.appendChild(t);
    }
    window.rdt('init', RDT_ID);
    window.rdt('track', 'PageVisit');
  }

  /* ── 2c. Consent state for track.js — the single source of truth it reads instead of
   * duplicating storage/schema logic. Set on every decision and once at initial load. ── */
  function publishConsent(decision) {
    window.__vConsent = decision;
    try {
      document.dispatchEvent(new CustomEvent('v:consent', { detail: decision }));
    } catch (e) { /* older browsers without CustomEvent — track.js falls back to no-op */ }
  }

  /* ── 3. Storage — deliberately localStorage, not a cookie, so nothing is set pre-consent ── */
  var memoryFallback = null;

  function read() {
    var raw;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return memoryFallback;
    }
    if (!raw) return memoryFallback;
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return memoryFallback;
    }
    if (!parsed || parsed.v !== SCHEMA || (parsed.analytics !== 'granted' && parsed.analytics !== 'denied')) {
      return memoryFallback;
    }
    var ts = Date.parse(parsed.ts);
    if (isNaN(ts) || (Date.now() - ts) > MAX_AGE_DAYS * 24 * 60 * 60 * 1000) {
      return memoryFallback;
    }
    return parsed.analytics;
  }

  function write(decision) {
    var entry = { v: SCHEMA, analytics: decision, ts: new Date().toISOString() };
    memoryFallback = decision;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
    } catch (e) {
      /* Safari private mode etc. — in-memory fallback still prevents a re-prompt this session. */
    }
  }

  /* ── 4. Language resolution — must match the page as actually rendered.
   *     A page whose language is dynamic is exactly a page that ships i18n.js.
   *     Matches the exact src forms used across the 7 hand-authored pages
   *     (./i18n.js, /i18n.js, i18n.js via <base href="/">) — not a generic
   *     suffix match, so an unrelated future "*i18n.js" filename can't false-positive. ── */
  function resolveLang() {
    var dynamic = !!document.querySelector('script[src="i18n.js"], script[src="./i18n.js"], script[src="/i18n.js"]');
    if (!dynamic) {
      var htmlLang = document.documentElement.lang;
      return COPY[htmlLang] ? htmlLang : 'en';
    }
    try {
      var qp = new URLSearchParams(window.location.search).get('lang');
      if (qp && COPY[qp]) return qp;
    } catch (e) { /* ignore */ }
    try {
      var stored = window.localStorage.getItem('v_lang');
      if (stored && COPY[stored]) return stored;
    } catch (e) { /* ignore */ }
    var nav = (navigator.language || 'en').slice(0, 2);
    if (COPY[nav]) return nav;
    if (window.I18N_DEFAULT_LANG && COPY[window.I18N_DEFAULT_LANG]) return window.I18N_DEFAULT_LANG;
    return 'en';
  }

  /* ── 5. Cookie cleanup on withdrawal (GA + Reddit) ── */
  function clearTrackingCookies() {
    var names = [];
    document.cookie.split(';').forEach(function (part) {
      var name = part.split('=')[0].trim();
      if (/^_ga/.test(name) || name === '_gid' || /^_rdt/.test(name)) names.push(name);
    });
    var domains = [undefined, window.location.hostname, '.' + window.location.hostname];
    names.forEach(function (name) {
      domains.forEach(function (domain) {
        var cookie = name + '=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        if (domain) cookie += '; domain=' + domain;
        document.cookie = cookie;
      });
    });
  }

  /* ── 6. Banner UI ── */
  var CSS_ID = 'v-consent-css';
  var BANNER_ID = 'v-consent-banner';

  function injectCss() {
    if (document.getElementById(CSS_ID)) return;
    var style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent =
      '#' + BANNER_ID + '{position:fixed;inset:auto 0 0 0;z-index:9999;' +
      'background:var(--surface,#1A1A1A);border-top:1px solid var(--border,#2E2E2E);' +
      'padding:1rem 1.25rem;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;' +
      'box-shadow:0 -4px 24px rgba(0,0,0,0.35);}' +
      '#' + BANNER_ID + ' .v-consent-inner{max-width:960px;margin:0 auto;display:flex;' +
      'align-items:center;gap:1.25rem;flex-wrap:wrap;}' +
      '#' + BANNER_ID + ' .v-consent-text{flex:1 1 320px;min-width:0;}' +
      '#' + BANNER_ID + ' .v-consent-title{font-weight:600;font-size:0.95rem;' +
      'color:var(--text,#F2F2F2);margin:0 0 0.25rem;}' +
      '#' + BANNER_ID + ' .v-consent-body{font-size:0.85rem;line-height:1.5;' +
      'color:var(--text2,#A0A0A0);margin:0;}' +
      '#' + BANNER_ID + ' .v-consent-body a{color:var(--primary,#6C63FF);text-decoration:none;}' +
      '#' + BANNER_ID + ' .v-consent-body a:hover{text-decoration:underline;}' +
      '#' + BANNER_ID + ' .v-consent-actions{display:flex;gap:0.6rem;flex:0 0 auto;flex-wrap:wrap;}' +
      '#' + BANNER_ID + ' button{font-family:inherit;font-size:0.85rem;font-weight:600;' +
      'padding:0.55rem 1.1rem;border-radius:8px;border:1px solid transparent;cursor:pointer;' +
      'min-width:96px;line-height:1.2;}' +
      '#' + BANNER_ID + ' .v-consent-accept{background:var(--primary,#6C63FF);color:#fff;}' +
      '#' + BANNER_ID + ' .v-consent-decline{background:#3A3A3A;color:var(--text,#F2F2F2);}' +
      '#' + BANNER_ID + ' button:focus-visible{outline:2px solid var(--primary,#6C63FF);outline-offset:2px;}' +
      '@media (max-width:480px){#' + BANNER_ID + ' .v-consent-actions{width:100%;}' +
      '#' + BANNER_ID + ' button{flex:1 1 0;min-width:0;}}';
    document.head.appendChild(style);
  }

  function removeBanner() {
    var el = document.getElementById(BANNER_ID);
    if (el) el.parentNode.removeChild(el);
  }

  /* Builds and mounts the banner. onDecline/onAccept are click handlers;
   * pass acceptDisabled:true for the "already accepted, offer withdrawal" state. */
  function buildBanner(onDecline, onAccept, acceptDisabled) {
    removeBanner();
    injectCss();
    var c = COPY[resolveLang()];

    var el = document.createElement('div');
    el.id = BANNER_ID;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'false');
    el.setAttribute('aria-label', c.aria);

    var inner = document.createElement('div');
    inner.className = 'v-consent-inner';

    var text = document.createElement('div');
    text.className = 'v-consent-text';
    var title = document.createElement('p');
    title.className = 'v-consent-title';
    title.textContent = c.title;
    var body = document.createElement('p');
    body.className = 'v-consent-body';
    body.textContent = c.body + ' ';
    var link = document.createElement('a');
    link.href = c.privacyHref;
    link.textContent = c.privacy;
    body.appendChild(link);
    text.appendChild(title);
    text.appendChild(body);

    var actions = document.createElement('div');
    actions.className = 'v-consent-actions';
    var declineBtn = document.createElement('button');
    declineBtn.type = 'button';
    declineBtn.className = 'v-consent-decline';
    declineBtn.textContent = c.decline;
    declineBtn.addEventListener('click', onDecline);
    var acceptBtn = document.createElement('button');
    acceptBtn.type = 'button';
    acceptBtn.className = 'v-consent-accept';
    acceptBtn.textContent = c.accept;
    if (acceptDisabled) {
      acceptBtn.disabled = true;
      acceptBtn.style.opacity = '0.5';
      acceptBtn.style.cursor = 'default';
    } else {
      acceptBtn.addEventListener('click', onAccept);
    }
    actions.appendChild(declineBtn);
    actions.appendChild(acceptBtn);

    inner.appendChild(text);
    inner.appendChild(actions);
    el.appendChild(inner);
    document.body.appendChild(el);
  }

  function render() {
    if (document.getElementById(BANNER_ID)) return;
    buildBanner(decline, accept, false);
  }

  /* ── 7. Decisions — one Accept/Decline covers Analytics and Advertising together ── */
  function accept() {
    write('granted');
    gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted'
    });
    loadGa();
    loadRdt();
    publishConsent('granted');
    removeBanner();
  }

  function decline() {
    write('denied');
    publishConsent('denied');
    removeBanner();
  }

  function withdraw() {
    write('denied');
    gtag('consent', 'update', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    clearTrackingCookies();
    publishConsent('denied');
    window.location.reload();
  }

  function open() {
    if (read() === 'granted') {
      /* Reopening after prior accept — offer to withdraw only. */
      buildBanner(withdraw, null, true);
    } else {
      buildBanner(decline, accept, false);
    }
  }

  /* ── 8. Re-open entry point — delegated, so no per-page wiring is needed ── */
  document.addEventListener('click', function (ev) {
    var target = ev.target.closest && ev.target.closest('a[href="#cookie-settings"], [data-consent-open]');
    if (!target) return;
    ev.preventDefault();
    open();
  });

  /* ── 9. Entry ── */
  var decision = read();
  if (decision === 'granted') {
    gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted'
    });
    loadGa();
    loadRdt();
    publishConsent('granted');
  } else if (decision === 'denied') {
    publishConsent('denied');
  } else {
    render();
  }
})();
