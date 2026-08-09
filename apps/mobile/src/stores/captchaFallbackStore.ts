import { create } from 'zustand';

// Backs the browser-tab fallback for the embedded native Turnstile challenge
// (see useCaptchaToken.ts / captchaBrowserFallback.ts). As of the invisible-
// mode + real-origin rewrite (see TurnstileWidget.tsx), this fallback is
// triggered only from a submit handler — never automatically on a mount-time
// timer — so it stays a rare recovery path rather than the default flow.
export type CaptchaFallbackStatus = 'idle' | 'pending' | 'resolved' | 'failed';

export interface CaptchaReturnTarget {
  pathname: string;
  params?: Record<string, string>;
}

// Turnstile tokens are single-use and short-lived server-side — no point holding
// on to a resolved token indefinitely if nothing consumes it right away.
const TOKEN_TTL_MS = 120_000;

interface CaptchaFallbackState {
  status: CaptchaFallbackStatus;
  token: string | null;
  resolvedAt: number | null;
  returnTo: CaptchaReturnTarget | null;
  failureReason: string | null;
  // Survives consumeToken()'s reset to idle, unlike `token` — guards against a
  // duplicate/delayed signal (e.g. more than one Linking 'url' event firing for
  // the same redirect) re-opening a token that's already been handed out once.
  lastHandledToken: string | null;

  begin: (returnTo: CaptchaReturnTarget | null) => void;
  resolve: (token: string) => void;
  fail: (reason: string) => void;
  consumeToken: () => string | null;
  consumeFailure: () => string | null;
  reset: () => void;
}

const initialState = {
  status: 'idle' as CaptchaFallbackStatus,
  token: null as string | null,
  resolvedAt: null as number | null,
  returnTo: null as CaptchaReturnTarget | null,
  failureReason: null as string | null,
};

export const useCaptchaFallbackStore = create<CaptchaFallbackState>((set, get) => ({
  ...initialState,
  lastHandledToken: null,

  begin: (returnTo) => {
    set({ ...initialState, status: 'pending', returnTo, lastHandledToken: null });
  },

  resolve: (token) => {
    // Idempotent — a late/duplicate signal (e.g. the redundant Linking capture
    // alongside the callback route firing more than once for the same redirect)
    // must never clobber an already-resolved token, nor re-open one that a
    // widget has already consumed once (status is back to 'idle' by then, so
    // status alone can't guard against that — lastHandledToken can).
    const s = get();
    if (s.status === 'resolved' || token === s.lastHandledToken) return;
    set({ status: 'resolved', token, resolvedAt: Date.now(), failureReason: null, lastHandledToken: token });
  },

  fail: (reason) => {
    // A late dismissal/timeout signal must not overwrite a token that already
    // arrived via a different path.
    if (get().status === 'resolved') return;
    set({ status: 'failed', token: null, resolvedAt: null, failureReason: reason });
  },

  consumeToken: () => {
    const { status, token, resolvedAt } = get();
    if (status !== 'resolved' || !token) return null;
    const stale = resolvedAt !== null && Date.now() - resolvedAt > TOKEN_TTL_MS;
    set({ ...initialState });
    return stale ? null : token;
  },

  consumeFailure: () => {
    const { status, failureReason } = get();
    if (status !== 'failed') return null;
    set({ ...initialState });
    return failureReason;
  },

  reset: () => set({ ...initialState, lastHandledToken: null }),
}));
