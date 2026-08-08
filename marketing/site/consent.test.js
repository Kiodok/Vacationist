#!/usr/bin/env node
/**
 * Behavioral tests for marketing/site/consent.js — the opt-in cookie-consent banner
 * that gates Google Analytics across all 43 site pages. No DOM/test framework
 * dependency: consent.js is plain vanilla JS (matching docs/i18n.js's own style), so
 * this uses a small hand-rolled DOM shim rather than pulling in jsdom.
 *
 * Run: node marketing/site/consent.test.js
 * Exits non-zero on any failure — wired into `npm test` at the repo root.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CONSENT_JS_PATH = path.join(__dirname, 'consent.js');
const SRC = fs.readFileSync(CONSENT_JS_PATH, 'utf8');

let failures = 0;
function assert(condition, message) {
  if (!condition) {
    failures++;
    console.error(`  ✗ ${message}`);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

/* ── Minimal DOM shim ── */
function makeEl(tag) {
  const el = {
    tagName: tag.toUpperCase(),
    children: [],
    attrs: {},
    style: {},
    listeners: {},
    _text: '',
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k]; },
    addEventListener(evt, fn) { (this.listeners[evt] = this.listeners[evt] || []).push(fn); },
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
    removeChild(child) { this.children = this.children.filter((c) => c !== child); child.parentNode = null; return child; },
    click() { (this.listeners.click || []).forEach((fn) => fn({ target: this, preventDefault() {} })); },
    get textContent() { return this._text; },
    set textContent(v) { this._text = v; },
    get href() { return this.attrs.href; },
    set href(v) { this.attrs.href = v; },
    get src() { return this.attrs.src; },
    set src(v) { this.attrs.src = v; },
    get id() { return this.attrs.id; },
    set id(v) { this.attrs.id = v; },
    get disabled() { return this.attrs.disabled; },
    set disabled(v) { this.attrs.disabled = v; },
  };
  return el;
}

/**
 * Loads and executes consent.js against a fresh mock environment.
 * opts: { htmlLang, hasI18nScript, search, navLang, i18nDefault, preset, presetCookies }
 * Returns handles for inspecting/driving the resulting page state.
 */
function load(opts) {
  opts = opts || {};
  const storage = {};
  if (opts.preset) storage['v_consent'] = JSON.stringify(opts.preset);

  let cookieJar = opts.presetCookies || '';
  let reloaded = false;
  const dataLayerRef = {};
  const documentListeners = {};
  const head = makeEl('head');
  const body = makeEl('body');
  const htmlEl = makeEl('html');
  htmlEl.lang = opts.htmlLang || 'en';

  const documentObj = {
    documentElement: htmlEl,
    head, body,
    createElement: (t) => makeEl(t),
    getElementById(id) {
      const find = (el) => {
        if (el.attrs && el.attrs.id === id) return el;
        for (const c of el.children) { const r = find(c); if (r) return r; }
        return null;
      };
      return find(body) || find(head);
    },
    querySelector(sel) {
      if (!opts.hasI18nScript) return null;
      // consent.js queries for the exact known i18n.js src forms; any match means "found".
      return sel.indexOf(opts.i18nScriptSrc || './i18n.js') !== -1 ? { src: opts.i18nScriptSrc || './i18n.js' } : null;
    },
    addEventListener(evt, fn) { (documentListeners[evt] = documentListeners[evt] || []).push(fn); },
    dispatchClick(target) { (documentListeners.click || []).forEach((fn) => fn({ target, preventDefault() {} })); },
  };
  Object.defineProperty(documentObj, 'cookie', {
    get() { return cookieJar; },
    set(v) {
      const name = v.split('=')[0].trim();
      if (/expires=Thu, 01 Jan 1970/.test(v)) {
        cookieJar = cookieJar.split(';').map((s) => s.trim()).filter((s) => s && !s.startsWith(name + '=')).join('; ');
      } else {
        cookieJar += (cookieJar ? '; ' : '') + v.split(';')[0];
      }
    },
  });

  const windowObj = {
    location: { search: opts.search || '', hostname: 'localhost', reload() { reloaded = true; } },
    localStorage: opts.storageThrows
      ? { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }
      : {
          getItem: (k) => (k in storage ? storage[k] : null),
          setItem: (k, v) => { storage[k] = v; },
        },
    I18N_DEFAULT_LANG: opts.i18nDefault,
  };
  const navigatorObj = { language: opts.navLang || 'en-US' };

  const fn = new Function('document', 'window', 'navigator', 'URLSearchParams', 'Date', SRC);
  let threw = null;
  try {
    fn(documentObj, windowObj, navigatorObj, URLSearchParams, Date);
  } catch (e) {
    threw = e;
  }

  return {
    threw,
    documentObj,
    windowObj,
    storage,
    banner: () => documentObj.getElementById('v-consent-banner'),
    gaScript: () => {
      const find = (el) => {
        if (el.tagName === 'SCRIPT' && el.attrs.src && el.attrs.src.includes('googletagmanager')) return el;
        for (const c of el.children) { const r = find(c); if (r) return r; }
        return null;
      };
      return find(head) || find(body);
    },
    rdtScript: () => {
      const find = (el) => {
        if (el.tagName === 'SCRIPT' && el.attrs.src && el.attrs.src.includes('redditstatic.com')) return el;
        for (const c of el.children) { const r = find(c); if (r) return r; }
        return null;
      };
      return find(head) || find(body);
    },
    cookies: () => cookieJar,
    reloaded: () => reloaded,
  };
}

function bannerButtons(env) {
  const b = env.banner();
  const actions = b.children[0].children[1]; // outer > inner > actions
  return { decline: actions.children[0], accept: actions.children[1] };
}

console.log('consent.js behavioral tests\n');

console.log('Fresh visit — no GA request until interaction:');
{
  const env = load({ htmlLang: 'en' });
  assert(!env.threw, 'does not throw on a clean page');
  assert(env.windowObj.dataLayer[0][1] === 'default' && env.windowObj.dataLayer[0][2].analytics_storage === 'denied',
    'pushes Consent Mode v2 defaults (analytics_storage: denied) before anything else');
  assert(!env.gaScript(), 'requests no GA script before any interaction');
  assert(!env.rdtScript(), 'requests no Reddit Pixel script before any interaction');
  assert(!!env.banner(), 'renders the banner');
}

console.log('\nLanguage resolution:');
{
  let env = load({ htmlLang: 'de' });
  assert(bannerButtons(env).decline.textContent === 'Ablehnen', 'static DE page (no i18n.js) renders German banner');

  env = load({ htmlLang: 'en', hasI18nScript: true, i18nScriptSrc: '/i18n.js', navLang: 'de-DE' });
  assert(bannerButtons(env).decline.textContent === 'Ablehnen', 'dynamic page follows navigator.language when no stored/query lang');

  env = load({ htmlLang: 'en', hasI18nScript: true, i18nScriptSrc: '/i18n.js', search: '?lang=de', navLang: 'en-US' });
  assert(bannerButtons(env).decline.textContent === 'Ablehnen', '?lang= query param wins over navigator.language');

  env = load({ htmlLang: 'de', hasI18nScript: true, i18nScriptSrc: 'i18n.js', navLang: 'fr-FR', i18nDefault: 'de' });
  assert(bannerButtons(env).decline.textContent === 'Ablehnen', 'falls back to I18N_DEFAULT_LANG when navigator.language is unsupported (fr)');

  env = load({ htmlLang: 'en', hasI18nScript: false });
  assert(bannerButtons(env).decline.textContent === 'Decline', 'static page with unrelated non-i18n script stays on <html lang>');
}

console.log('\nAccept flow:');
{
  const env = load({ htmlLang: 'en' });
  bannerButtons(env).accept.click();
  assert(!!env.gaScript(), 'GA script is requested only after Accept');
  assert(env.gaScript().attrs.src.includes('G-4DRBWGQHE3'), 'requests the correct GA measurement ID');
  assert(!!env.rdtScript(), 'Reddit Pixel script is requested only after Accept');
  assert(typeof env.windowObj.rdt === 'function', 'window.rdt is installed after Accept');
  assert(JSON.parse(env.storage['v_consent']).analytics === 'granted', 'localStorage records granted');
  assert(!env.banner(), 'banner is removed after Accept');
}

console.log('\nDecline flow:');
{
  const env = load({ htmlLang: 'en' });
  bannerButtons(env).decline.click();
  assert(!env.gaScript(), 'GA script is never requested after Decline');
  assert(!env.rdtScript(), 'Reddit Pixel script is never requested after Decline');
  assert(JSON.parse(env.storage['v_consent']).analytics === 'denied', 'localStorage records denied');
  assert(!env.banner(), 'banner is removed after Decline');
}

console.log('\nRepeat visits (no re-prompt flash):');
{
  let env = load({ htmlLang: 'en', preset: { v: 2, analytics: 'granted', ts: new Date().toISOString() } });
  assert(!!env.gaScript(), 'prior grant loads GA immediately, no click needed');
  assert(!!env.rdtScript(), 'prior grant loads the Reddit Pixel immediately, no click needed');
  assert(!env.banner(), 'prior grant does not render the banner (no flash)');

  env = load({ htmlLang: 'en', preset: { v: 2, analytics: 'denied', ts: new Date().toISOString() } });
  assert(!env.gaScript(), 'prior denial never loads GA');
  assert(!env.rdtScript(), 'prior denial never loads the Reddit Pixel');
  assert(!env.banner(), 'prior denial does not render the banner');
}

console.log('\nSchema migration (analytics-only consent must not silently cover advertising):');
{
  // Schema bumped 1 -> 2 when the Reddit Pixel was added: a decision recorded under the old
  // analytics-only banner copy must not be reused to also enable advertising cookies.
  const env = load({ htmlLang: 'en', preset: { v: 1, analytics: 'granted', ts: new Date().toISOString() } });
  assert(!!env.banner(), 'a v1 (pre-Reddit-Pixel) grant re-prompts under the new combined banner');
  assert(!env.gaScript(), 'GA stays gated until the visitor re-consents under the new schema');
  assert(!env.rdtScript(), 'Reddit Pixel stays gated until the visitor re-consents under the new schema');
}

console.log('\nExpiry and corrupt-storage safety:');
{
  const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
  const env = load({ htmlLang: 'en', preset: { v: 2, analytics: 'granted', ts: old } });
  assert(!!env.banner(), 'consent older than 365 days re-prompts');
  assert(!env.gaScript(), 'GA stays gated until fresh consent is given');
}
{
  // Corrupt value present BEFORE consent.js runs (the real-world case).
  const storage = { v_consent: 'not json{{{' };
  const head = makeEl('head'), body = makeEl('body'), htmlEl = makeEl('html');
  htmlEl.lang = 'en';
  const documentObj = {
    documentElement: htmlEl, head, body,
    createElement: (t) => makeEl(t),
    getElementById(id) {
      const find = (el) => { if (el.attrs && el.attrs.id === id) return el; for (const c of el.children) { const r = find(c); if (r) return r; } return null; };
      return find(body) || find(head);
    },
    querySelector: () => null,
    addEventListener() {},
  };
  const windowObj = {
    location: { search: '', hostname: 'localhost', reload() {} },
    localStorage: { getItem: (k) => storage[k] || null, setItem: (k, v) => { storage[k] = v; } },
  };
  let threw = null;
  try {
    new Function('document', 'window', 'navigator', 'URLSearchParams', 'Date', SRC)(documentObj, windowObj, { language: 'en-US' }, URLSearchParams, Date);
  } catch (e) { threw = e; }
  assert(!threw, 'pre-existing garbage localStorage value at load time does not throw');
  assert(!!documentObj.getElementById('v-consent-banner'), 'and safely re-prompts');
}

console.log('\nStorage-blocked (Safari private mode) safety:');
{
  const env = load({ htmlLang: 'en', storageThrows: true });
  assert(!env.threw, 'does not throw when localStorage is fully blocked');
  assert(!!env.banner(), 'still renders the banner');
  const btns = bannerButtons(env);
  btns.accept.click();
  assert(!!env.gaScript(), 'Accept still loads GA even without persistent storage (in-memory fallback)');
}

console.log('\nWithdrawal flow:');
{
  const env = load({
    htmlLang: 'en',
    preset: { v: 2, analytics: 'granted', ts: new Date().toISOString() },
    presetCookies: '_ga=GA1.1.123; _ga_4DRBWGQHE3=GS1.1.456; _rdt_uuid=1786190000.abc123; unrelated=keep-me',
  });
  assert(!!env.gaScript(), 'sanity: GA loaded on entry from prior grant');
  assert(!!env.rdtScript(), 'sanity: Reddit Pixel loaded on entry from prior grant');

  const footerLink = { attrs: { href: '#cookie-settings' }, parentNode: null };
  footerLink.closest = function (sel) { return this.attrs.href === '#cookie-settings' ? this : null; };
  env.documentObj.dispatchClick(footerLink);

  assert(!!env.banner(), 'clicking #cookie-settings reopens the banner');
  const btns = bannerButtons(env);
  assert(!!btns.decline && btns.accept.disabled, 'reopened banner after a prior grant only offers Decline (withdrawal), Accept is disabled');

  btns.decline.click();
  assert(JSON.parse(env.storage['v_consent']).analytics === 'denied', 'withdrawal records denied');
  assert(env.cookies() === 'unrelated=keep-me', 'withdrawal sweeps _ga*/_gid/_rdt* cookies, leaves unrelated cookies untouched');
  assert(env.reloaded(), 'withdrawal triggers a page reload (only way to guarantee no further GA/Reddit hits)');
}

console.log('\nReopen on a fresh visit (no prior decision):');
{
  const env = load({ htmlLang: 'en' });
  const footerLink = { attrs: { href: '#cookie-settings' }, parentNode: null };
  footerLink.closest = function (sel) { return this.attrs.href === '#cookie-settings' ? this : null; };
  env.documentObj.dispatchClick(footerLink);
  const btns = bannerButtons(env);
  assert(!btns.accept.disabled, 'reopening before any decision offers the normal Accept/Decline pair');
}

console.log(`\n${failures === 0 ? '✓ All checks passed.' : `✗ ${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
