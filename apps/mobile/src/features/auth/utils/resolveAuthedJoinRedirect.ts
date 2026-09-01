export type AuthedJoinRedirect =
  | { pathname: '/trip/join-confirm'; params: { token: string } }
  | { pathname: '/(tabs)' };

// Decides where an already-authenticated user lands after AuthGate's segments
// effect sees them sitting in the (auth) group. This is the ONLY place that
// routes a live `/join` landing to join-confirm — it must not gate on
// handledInviteTokenRef (an already-seen token is still a valid redirect
// target): Expo Router resolves `/join` for both cold-start AND warm
// (backgrounded-app) deep links, so a ref-based skip here would silently
// swallow every warm-start invite tap. join-confirm only previews the token;
// redemption needs an explicit button press, so re-landing here is harmless.
export function resolveAuthedJoinRedirect(
  segments: readonly string[],
  token: string | string[] | undefined,
): AuthedJoinRedirect {
  const rawToken = segments[1] === 'join' ? token : undefined;
  const joinToken = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  if (joinToken) {
    return { pathname: '/trip/join-confirm', params: { token: joinToken } };
  }
  return { pathname: '/(tabs)' };
}
