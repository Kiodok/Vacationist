const ALLOWED_SCHEMES = ['https://'];

export function isValidUrl(url: string): boolean {
  if (url.length > 2048) return false;
  return ALLOWED_SCHEMES.some((scheme) => url.startsWith(scheme));
}

export interface TextSegment {
  text: string;
  isLink: boolean;
}

// Matches only https:// links — deliberately not http://, www., or any other scheme.
// Mirrors the DB's *_url_https CHECK constraints and the app's httpsUrlSchema (§15 Input
// Sanitization): only https:// is ever treated as a followable link anywhere in the app.
const HTTPS_URL_PATTERN = /https:\/\/[^\s]+/g;

// Trailing punctuation that's almost always sentence punctuation, not part of the URL
// (e.g. "check this out: https://example.com." should not swallow the period).
const TRAILING_PUNCTUATION = /[.,;:!?)\]}]+$/;

/**
 * Splits free text into plain-text and https:// link segments, for rendering as
 * tappable links (RichText). Pure function — no React/RN dependency — so it is
 * unit-testable independent of the native Text component that consumes it.
 */
export function splitTextIntoLinkSegments(text: string): TextSegment[] {
  if (!text) return [];

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(HTTPS_URL_PATTERN)) {
    const rawUrl = match[0];
    const trailing = rawUrl.match(TRAILING_PUNCTUATION)?.[0] ?? '';
    const url = trailing ? rawUrl.slice(0, -trailing.length) : rawUrl;
    if (!url) continue;

    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ text: text.slice(lastIndex, start), isLink: false });
    }
    segments.push({ text: url, isLink: true });
    lastIndex = start + url.length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), isLink: false });
  }

  return segments;
}
