// Module-level (not component-scoped) guard against concurrent Google Sign-In
// attempts. A per-component ref is insufficient here: useGoogleSignIn.ts (login)
// and useGuestUpgrade.ts (guest upgrade) are two independent call sites, and a
// stray double-mount of either screen creates two independent ref instances —
// this is the one place that's actually shared across all of them, matching the
// native GoogleSignin module's own promise tracking, which is a process-wide
// singleton, not tied to any particular React component.
let inFlight = false;

export function tryStartGoogleSignIn(): boolean {
  if (inFlight) return false;
  inFlight = true;
  return true;
}

export function endGoogleSignIn() {
  inFlight = false;
}
