/* Vacationist — first-party funnel tracking: page visits, outbound CTA clicks, and the
 * attribution handoff that lets a Reddit ad click get credited all the way through to a
 * native sign-up (Reddit's own pixel can only ever see the web side of that journey).
 *
 * This file is copied byte-for-byte to docs/assets/track.js by build.mjs and loaded right
 * after consent.js on every page — see CLAUDE.md "Marketing Site" for the asset pipeline.
 * Every code path here no-ops unless window.__vConsent === 'granted'. consent.js is the only
 * place that reads/writes the consent decision itself; this file never touches it directly,
 * only window.__vConsent and the "v:consent" event it publishes.
 */
(function () {
  'use strict';

  var TRACK_URL = 'https://fsfsqghbejwvgxujoyne.supabase.co/functions/v1/track-event';
  var ATTR_KEY = 'v_attr';

  function consentGranted() {
    return window.__vConsent === 'granted';
  }

  function qp(name) {
    try {
      return new URLSearchParams(window.location.search).get(name) || null;
    } catch (e) {
      return null;
    }
  }

  function readAttribution() {
    try {
      var raw = window.localStorage.getItem(ATTR_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /* First-touch wins: once an rdt_cid or utm_source is captured for this browser, later
   * visits never overwrite it, so a visitor who clicks a Reddit ad and then browses back in
   * organically later still gets credited to the original ad click. */
  function captureAttribution() {
    if (!consentGranted() || readAttribution()) return;
    var attr = {
      rdt_cid: qp('rdt_cid'),
      utm_source: qp('utm_source'),
      utm_medium: qp('utm_medium'),
      utm_campaign: qp('utm_campaign'),
      utm_content: qp('utm_content')
    };
    if (!attr.rdt_cid && !attr.utm_source) return;
    try {
      window.localStorage.setItem(ATTR_KEY, JSON.stringify(attr));
    } catch (e) { /* Safari private mode etc. — attribution just won't persist this visit */ }
  }

  function referrerHost() {
    try {
      return document.referrer ? new URL(document.referrer).host : null;
    } catch (e) {
      return null;
    }
  }

  function send(eventName) {
    if (!consentGranted()) return;
    var attr = readAttribution() || {};
    var body = {
      event_name: eventName,
      surface: 'marketing',
      path: window.location.pathname,
      referrer_host: referrerHost()
    };
    ['rdt_cid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (key) {
      if (attr[key]) body[key] = attr[key];
    });
    try {
      fetch(TRACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true // request must survive the page navigating away right after a click
      }).catch(function () {});
    } catch (e) { /* fetch unavailable/blocked — tracking must never break the page */ }
  }

  /* ── Play Store link rewrite — the CAPI handoff ───────────────────────────────────────
   * Google Play preserves a custom `referrer` query param through install and hands it back
   * to the app via Application.getInstallReferrerAsync() on first launch (Android). Encoding
   * rdt_cid here is the only mechanism by which a Reddit click ID survives from an ad click
   * to a native sign-up — see supabase/functions/attribution-capi (Part C). ── */
  function rewritePlayStoreLinks() {
    if (!consentGranted()) return;
    var attr = readAttribution();
    if (!attr) return;

    var params = [];
    ['rdt_cid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (key) {
      if (attr[key]) params.push(key + '=' + encodeURIComponent(attr[key]));
    });
    if (!params.length) return;
    var referrer = encodeURIComponent(params.join('&'));

    var links = document.querySelectorAll('a[href*="play.google.com/store/apps/details"]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      if (!href || href.indexOf('referrer=') !== -1) continue;
      links[i].setAttribute('href', href + (href.indexOf('?') === -1 ? '?' : '&') + 'referrer=' + referrer);
    }
  }

  /* ── Web App link rewrite — same handoff as Play Store, for the browser case ──────────────
   * web.vacationist.app is a different origin, so localStorage never carries rdt_cid across —
   * without this, a click_id captured here would simply vanish before web.vacationist.app
   * could ever report a CAPI-attributed sign-up. Plain query params (not the Play Store
   * `referrer=` encoding, which is Android-install-referrer-specific); web.vacationist.app
   * captures them from window.location.search on load. ── */
  function rewriteWebAppLinks() {
    if (!consentGranted()) return;
    var attr = readAttribution();
    if (!attr) return;

    var params = [];
    ['rdt_cid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (key) {
      if (attr[key]) params.push(key + '=' + encodeURIComponent(attr[key]));
    });
    if (!params.length) return;

    var links = document.querySelectorAll('a[href*="web.vacationist.app"]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      if (!href || href.indexOf('rdt_cid=') !== -1) continue;
      links[i].setAttribute('href', href + (href.indexOf('?') === -1 ? '?' : '&') + params.join('&'));
    }
  }

  /* ── Delegated click tracking ──────────────────────────────────────────────────────────
   * iOS is now GA — the App Store badges (previously dead "Coming Soon" <div>s with no
   * href, tracked as app_store_interest) are real apps.apple.com links now, so they're
   * caught by the plain a[href] branch below like the Play Store link. ── */
  document.addEventListener('click', function (ev) {
    if (!consentGranted()) return;
    var target = ev.target.closest && ev.target.closest('a[href]');
    if (!target) return;

    var href = target.getAttribute && target.getAttribute('href');
    if (href && href.indexOf('play.google.com/store/apps/details') !== -1) {
      send('play_store_click');
      if (window.rdt) window.rdt('track', 'Lead');
      return;
    }
    if (href && href.indexOf('apps.apple.com') !== -1) {
      send('app_store_click');
      if (window.rdt) window.rdt('track', 'Lead');
      return;
    }
    if (href && href.indexOf('web.vacationist.app') !== -1) {
      send('web_app_click');
      if (window.rdt) window.rdt('track', 'Lead');
      return;
    }
  });

  /* ── Entry ─────────────────────────────────────────────────────────────────────────────
   * Runs immediately if consent was already granted on a prior visit; otherwise waits for
   * the "v:consent" event consent.js fires the moment the visitor clicks Accept. The
   * listener stays attached for the lifetime of the page, so accepting later in the same
   * visit (e.g. after reopening cookie settings) still fires everything below. ── */
  function init() {
    captureAttribution();
    rewritePlayStoreLinks();
    rewriteWebAppLinks();
    send('page_visit');
  }

  if (consentGranted()) {
    init();
  } else {
    document.addEventListener('v:consent', function (ev) {
      if (ev.detail === 'granted') init();
    });
  }
})();
