// Handles both vacationist://join?token=... and https://vacationist.app/join?token=...
// `new URL()` parses both forms identically (custom schemes support a `//host` authority
// the same way http(s) does) — this is the same engine expo-linking's own Linking.parse
// uses internally, so it stays behavior-equivalent without depending on expo-linking
// (which pulls in expo-constants and isn't safely importable outside a native runtime).
export function extractInviteToken(url: string): string | null {
  try {
    const token = new URL(url).searchParams.get('token');
    return token ? token : null;
  } catch {
    return null;
  }
}
