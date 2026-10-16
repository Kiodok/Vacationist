---
name: swipetodismiss-ondismiss-may-not-dismiss
description: Use before creating or editing any sheet whose close handler can conditionally NOT close (a dirty-form discard guard, a confirmation step) — SwipeToDismiss.tsx's swipe gesture slides the panel fully off-screen BEFORE calling onDismiss, which leaves the panel invisible and the app looking stuck if onDismiss decides not to actually dismiss. Fixed 2026-10-16 via an opt-in dismissGuard/onDismissBlocked pair.
---

`apps/mobile/src/components/SwipeToDismiss.tsx`'s pan gesture, on a dismiss-qualifying drag,
animates the panel's `translateY` all the way off-screen and only calls `onDismiss` once that
slide finishes. This assumes `onDismiss` always actually closes the sheet — true for ~54 ordinary
sheets, but not for one whose close handler can decide, at the last second, to show a confirmation
instead (the v1.39.6 discard-guard expense sheets). By the time that decision runs, the panel has
already slid fully off-screen, so the confirm UI renders invisibly and the app looks stuck — the
backdrop tap works by comparison only because it calls `onDismiss` directly, with no animation
involved at all.

**Why:** found during the Tech Lead's manual QA pass against the v1.39.6 checklist. Root-caused by
re-reading `SwipeToDismiss.tsx` directly, not guessed — see `project_v1_39_6_batch` memory and
`engineering/implementation_guide.md`'s v1.39.6 entry for the full story.

**How to apply:**
- Any sheet whose close handler can conditionally not close must pass `dismissGuard` (a reanimated
  `SharedValue<boolean>`, true = block the dismiss) and `onDismissBlocked` (fires instead of the
  slide-away animation, while the panel is still fully visible) to `<SwipeToDismiss>`. Mirror the
  "should block" boolean into the shared value with a plain `useEffect` — the gesture's `onEnd`
  runs as a worklet on the UI thread and cannot read ordinary React state.
- The guard must be checked **before** the slide-away animation is chosen — never try to fix this
  class of bug by changing what `onDismiss` does after the animation runs; the panel is already
  gone by then.
- Both props are optional and default to "never block" — every sheet that doesn't pass them is
  completely unaffected. See `CreateExpenseSheet.tsx`/`EditExpenseSheet.tsx` for the reference
  wiring (a `useSharedValue` mirror of the sheet's own `hasUnsavedInput`).

See also [[sheet-swipe-to-dismiss]] for the base component's general conventions.
