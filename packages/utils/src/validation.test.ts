import { describe, it, expect } from 'vitest';
import { isValidUrl, splitTextIntoLinkSegments } from './validation';

describe('isValidUrl', () => {
  it('accepts https URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
  });

  it('rejects http URLs', () => {
    expect(isValidUrl('http://example.com')).toBe(false);
  });

  it('rejects other schemes', () => {
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
    expect(isValidUrl('data:text/html,x')).toBe(false);
  });

  it('rejects URLs over 2048 chars', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2048);
    expect(isValidUrl(longUrl)).toBe(false);
  });
});

describe('splitTextIntoLinkSegments', () => {
  it('returns an empty array for empty text', () => {
    expect(splitTextIntoLinkSegments('')).toEqual([]);
  });

  it('returns a single plain segment when there is no link', () => {
    expect(splitTextIntoLinkSegments('just some notes')).toEqual([
      { text: 'just some notes', isLink: false },
    ]);
  });

  it('detects a bare https link', () => {
    expect(splitTextIntoLinkSegments('https://example.com')).toEqual([
      { text: 'https://example.com', isLink: true },
    ]);
  });

  it('splits text with a link in the middle', () => {
    expect(splitTextIntoLinkSegments('see https://example.com for info')).toEqual([
      { text: 'see ', isLink: false },
      { text: 'https://example.com', isLink: true },
      { text: ' for info', isLink: false },
    ]);
  });

  it('does not linkify http (non-https) URLs', () => {
    expect(splitTextIntoLinkSegments('go to http://example.com now')).toEqual([
      { text: 'go to http://example.com now', isLink: false },
    ]);
  });

  it('does not linkify bare www. text', () => {
    expect(splitTextIntoLinkSegments('visit www.example.com')).toEqual([
      { text: 'visit www.example.com', isLink: false },
    ]);
  });

  it('trims trailing sentence punctuation off a link', () => {
    expect(splitTextIntoLinkSegments('check this out: https://example.com.')).toEqual([
      { text: 'check this out: ', isLink: false },
      { text: 'https://example.com', isLink: true },
      { text: '.', isLink: false },
    ]);
  });

  it('trims a trailing closing paren', () => {
    expect(splitTextIntoLinkSegments('(see https://example.com)')).toEqual([
      { text: '(see ', isLink: false },
      { text: 'https://example.com', isLink: true },
      { text: ')', isLink: false },
    ]);
  });

  it('handles multiple links in one string', () => {
    expect(splitTextIntoLinkSegments('https://a.com and https://b.com')).toEqual([
      { text: 'https://a.com', isLink: true },
      { text: ' and ', isLink: false },
      { text: 'https://b.com', isLink: true },
    ]);
  });

  it('handles a link at the very end with no trailing text', () => {
    expect(splitTextIntoLinkSegments('link: https://example.com')).toEqual([
      { text: 'link: ', isLink: false },
      { text: 'https://example.com', isLink: true },
    ]);
  });
});
