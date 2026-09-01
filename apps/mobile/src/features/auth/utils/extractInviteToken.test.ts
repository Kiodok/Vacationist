import { describe, it, expect } from 'vitest';
import { extractInviteToken } from './extractInviteToken';

describe('extractInviteToken', () => {
  it('extracts the token from the custom-scheme deep link', () => {
    expect(extractInviteToken('vacationist://join?token=abc123')).toBe('abc123');
  });

  it('extracts the token from the https universal link', () => {
    expect(extractInviteToken('https://vacationist.app/join?token=abc123')).toBe('abc123');
  });

  it('extracts the token from the web app fallback link', () => {
    expect(extractInviteToken('https://web.vacationist.app/join?token=abc123')).toBe('abc123');
  });

  it('decodes a URL-encoded token', () => {
    expect(extractInviteToken('vacationist://join?token=a%2Fb%3Dc')).toBe('a/b=c');
  });

  it('returns null when the token param is missing', () => {
    expect(extractInviteToken('vacationist://join')).toBeNull();
  });

  it('returns null when the token param is present but empty', () => {
    expect(extractInviteToken('vacationist://join?token=')).toBeNull();
  });

  it('returns null for an unparseable URL', () => {
    expect(extractInviteToken('not a url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractInviteToken('')).toBeNull();
  });

  it('ignores unrelated query params and picks out token', () => {
    expect(extractInviteToken('vacationist://join?ref=share&token=abc123&utm_source=x')).toBe('abc123');
  });

  it('is unaffected by additional path segments', () => {
    expect(extractInviteToken('https://vacationist.app/join/extra?token=abc123')).toBe('abc123');
  });
});
