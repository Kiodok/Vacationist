/**
 * Vacationist landing page i18n
 *
 * To add a new language:
 *  1. Create docs/i18n/<code>.js that assigns window.VACATIONIST_I18N = { __lang: '<code>', ... }
 *  2. Add the code to SUPPORTED below
 *  3. Add a <button data-lang="<code>"> to the switcher in each HTML file
 *
 * Cache busting: bump CACHE_VER whenever translation files change.
 */
(function () {
  var SUPPORTED = ['en', 'de'];
  var DEFAULT_LANG = 'en';
  var STORAGE_KEY = 'v_lang';
  var CACHE_VER = '20260612';

  function detect() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;
    var browser = (navigator.language || '').split('-')[0].toLowerCase();
    return SUPPORTED.indexOf(browser) !== -1 ? browser : DEFAULT_LANG;
  }

  function apply(t) {
    // Text content
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = t[el.getAttribute('data-i18n')];
      if (v !== undefined) el.textContent = v;
    });
    // HTML content (headings with <em>, etc.)
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var v = t[el.getAttribute('data-i18n-html')];
      if (v !== undefined) el.innerHTML = v;
    });
    // Attributes
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var v = t[el.getAttribute('data-i18n-title')];
      if (v !== undefined) el.title = v;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var v = t[el.getAttribute('data-i18n-placeholder')];
      if (v !== undefined) el.placeholder = v;
    });

    // html lang + SEO tags
    var lang = t.__lang || DEFAULT_LANG;
    document.documentElement.lang = lang;
    if (t['meta.title']) document.title = t['meta.title'];
    ['description', 'og:title', 'og:description', 'twitter:title', 'twitter:description'].forEach(function (name) {
      var key = 'meta.' + name.replace(':', '_');
      if (!t[key]) return;
      var isProperty = name.indexOf('og:') === 0 || name.indexOf('twitter:') === 0;
      var sel = isProperty
        ? 'meta[property="' + name + '"],meta[name="' + name + '"]'
        : 'meta[name="' + name + '"]';
      var el = document.querySelector(sel);
      if (el) el.setAttribute('content', t[key]);
    });

    // Switcher active state
    document.querySelectorAll('[data-lang]').forEach(function (btn) {
      btn.classList.toggle('lang-active', btn.getAttribute('data-lang') === lang);
    });

    // Dev-mode key parity check (localhost only)
    if (lang !== DEFAULT_LANG && typeof console !== 'undefined' &&
        window.location && window.location.hostname === 'localhost') {
      var missing = [];
      var expected = window._VACATIONIST_I18N_EN_KEYS;
      if (expected) {
        for (var i = 0; i < expected.length; i++) {
          if (!(expected[i] in t)) missing.push(expected[i]);
        }
        if (missing.length) console.warn('[i18n] Missing keys in "' + lang + '":', missing);
      }
    }
  }

  function loadLang(lang) {
    // Remove any previously injected lang script
    document.querySelectorAll('script[data-lang-script]').forEach(function (s) { s.remove(); });
    var s = document.createElement('script');
    s.setAttribute('data-lang-script', lang);
    s.src = (document.querySelector('base') ? '' : './') + 'i18n/' + lang + '.js?v=' + CACHE_VER;
    s.onload = function () {
      if (window.VACATIONIST_I18N) {
        // Store EN keys for parity checks on subsequent language switches
        if (lang === DEFAULT_LANG) {
          window._VACATIONIST_I18N_EN_KEYS = Object.keys(window.VACATIONIST_I18N);
        }
        apply(window.VACATIONIST_I18N);
      }
    };
    document.head.appendChild(s);
  }

  function setLang(lang) {
    if (SUPPORTED.indexOf(lang) === -1) return;
    localStorage.setItem(STORAGE_KEY, lang);
    loadLang(lang);
  }

  window.I18n = { setLang: setLang, detect: detect, supported: SUPPORTED };

  document.addEventListener('DOMContentLoaded', function () {
    loadLang(detect());
    document.querySelectorAll('[data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () { setLang(btn.getAttribute('data-lang')); });
    });
  });
})();
