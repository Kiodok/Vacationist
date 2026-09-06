import { AppState, Platform } from 'react-native';

// The Turnstile browser fallback (ASWebAuthenticationSession on iOS) resolves its
// promise *while its own presentation is still tearing down*. Calling
// `GoogleSignin.signIn()` in that window hits `RCTPresentedViewController() == nil`
// and the native SDK raises an un-catchable
// `NSInvalidArgumentException: |presentingViewController| must be set.`
// (Sentry REACT-NATIVE-E). Android re-checks AppState around the same window; iOS
// did not.
//
// This waits (briefly, iOS only) for the app to be foreground-`active` and for the
// presented-VC teardown to finish, so a subsequent native sign-in call has a root
// view controller to present from.

const SETTLE_MS = 350;
const MAX_WAIT_MS = 4000;
const POLL_MS = 100;

/**
 * @returns true if the app is (or became) active and it's safe to present native
 *   UI; false if it stayed backgrounded past the timeout (caller should abort).
 */
export async function awaitAppActiveForNativePresent(): Promise<boolean> {
  if (Platform.OS !== 'ios') return true;

  const deadline = Date.now() + MAX_WAIT_MS;
  while (AppState.currentState !== 'active' && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  if (AppState.currentState !== 'active') return false;

  // Even once 'active', the dismissing auth-session VC needs a beat to fully
  // detach before the window has a presentable root VC again.
  await new Promise((r) => setTimeout(r, SETTLE_MS));
  return true;
}
