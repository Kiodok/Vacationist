// Single source of truth for web.vacationist.app's <title>/description, used by
// both apps/mobile/app/+html.tsx (static fallback, first paint) and
// apps/mobile/app/_layout.tsx (Head/Helmet, populates the framework's own
// title slot) — keeping them in two places with independently hardcoded
// strings is exactly the kind of drift that produced the empty-title bug
// this pair is meant to prevent.
export const WEB_TITLE = 'Group Trip Planner — Vote & Split Expenses | Vacationist';
export const WEB_DESCRIPTION =
  'Plan group trips together: vote on activities, split travel expenses, and share packing lists. Free, and no account needed to join.';
