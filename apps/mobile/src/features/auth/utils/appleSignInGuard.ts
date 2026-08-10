// Module-level (not component-scoped) guard against concurrent Apple Sign-In attempts.
// Mirrors googleSignInGuard.ts — see its comment for why this must be module-level rather
// than a per-component ref. Kept as a separate sibling rather than generalizing the Google
// guard into a shared one: Apple and Google are independent native SDKs with their own
// concurrency semantics, and a shared guard would incorrectly block a user from starting an
// Apple sign-in while a stale Google attempt is still in flight (or vice versa).
let inFlight = false;

export function tryStartAppleSignIn(): boolean {
  if (inFlight) return false;
  inFlight = true;
  return true;
}

export function endAppleSignIn() {
  inFlight = false;
}
