---
name: native-form-control-icon-suppression
description: Use when a task asks to hide, replace, or restyle part of what a native HTML form control renders on web (e.g. a browser's built-in icon inside <input type="time">, type="date", type="color", checkboxes, radios) while keeping the rest of its native behavior. Explains which techniques look right in local testing but fail for real users, and which one is actually reliable.
---

# Suppressing part of a native form control's own rendering on web

To hide one piece of what a native HTML form control renders internally (e.g. `<input
type="time">`'s built-in clock/calendar icon) while keeping the control itself fully functional,
only one technique is structurally reliable: set `opacity: 0` directly on the control itself
(absolutely positioned, full-size, still focusable/interactive) and render a separate, purely
presentational sibling element underneath to show whatever the control's own rendering was
providing (the typed value, a placeholder, etc.). Pair it with a real custom affordance (an icon
button, a styled overlay) for the visible UI.

**Why other approaches that look correct actually fail:**
1. A CSS pseudo-element hook (e.g. `::-webkit-calendar-picker-indicator { display: none }`) only
   ever covers the engines that define that specific pseudo-element. Firefox has no `-moz-`
   equivalent for many native-control sub-parts at all — the rule silently does nothing there.
   It can also fail to reliably hide the target even in the engines it's meant to cover.
2. An opaque, same-background `<div>` absolutely positioned over the icon's expected location,
   leaving the real control fully visible/opaque, can fail even when verified: some browsers
   paint a native form control's own internal chrome in a layer that wins over ordinary sibling
   DOM content regardless of normal CSS stacking/z-index rules — the overlay is correctly present
   and styled, but the native icon still paints on top of it anyway.

Only making the control itself `opacity: 0` — not a covering overlay, not a pseudo-element
rule — is guaranteed to work, because `opacity` operates on the element's own paint output:
nothing about that element, including any native sub-parts a browser renders as part of it, can
visually "leak through," unlike a separate element competing in the normal stacking order.

**How to apply:**
- When a request is "hide/replace part of what a native HTML form control renders on web, keep
  the rest of its behavior," reach for the opacity-the-real-control + custom-visual-sibling
  pattern first — not a CSS pseudo-element hook or a covering overlay. Those look plausible, can
  pass a quick single-browser local check, and then fail for real users.
- Concretely: `position: absolute; inset: 0; opacity: 0` on the real `<input>` (kept focusable
  and receiving the actual value/onChange), plus a sibling `<div aria-hidden
  style={{pointerEvents:'none', ...}}>` showing the value or placeholder, positioned in the same
  box. Any existing custom icon/button elsewhere in the component becomes the sole visible
  affordance automatically, since the native one is now fully invisible.
- More generally: a single local browser (or single engine) confirming a UI fix visually is not
  sufficient signal that the fix holds for every user. Cross-engine-sensitive UI logic —
  especially anything touching native form control internals — needs either real multi-browser
  verification or a technique that's engine-agnostic by construction, like this one. Don't treat
  "it looks fixed in my one test browser" as proof; say so plainly if that's the extent of the
  verification, and prefer the structurally-reliable technique over one that merely tested clean.

Concrete precedent: Vacationist's `apps/mobile/src/components/DateTimePickerField.tsx` web time
input — this exact bug took three attempts (CSS pseudo-element rule, then a covering-div mask,
both reported still broken by the user despite passing local `claude-in-chrome` verification in
both dark and light theme) before the opacity-on-the-real-input rewrite was confirmed working.
See [[v1-33-0-batch]] for the full blow-by-blow and [[project_v1_33_0_batch]] for context.
