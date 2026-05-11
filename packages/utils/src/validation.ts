const ALLOWED_SCHEMES = ['https://'];

export function isValidUrl(url: string): boolean {
  if (url.length > 2048) return false;
  return ALLOWED_SCHEMES.some((scheme) => url.startsWith(scheme));
}
