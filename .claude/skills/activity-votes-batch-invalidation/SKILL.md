---
name: activity-votes-batch-invalidation
description: Use when adding or touching any activity vote insert/update/delete (mutations or realtime handlers) — the ['activity-votes-batch'] query that drives blockedActivityIds and the Discuss section grouping is never auto-invalidated by per-entity vote cache changes and will silently go stale without an explicit invalidateQueries call.
---

# Activity votes batch invalidation

`['activity-votes-batch', ...sortedIds]` drives `blockedActivityIds` in the activities screen and therefore the Discuss section grouping. It is a **separate cache** from `['activities', activityId, 'votes']` and is never automatically invalidated when individual votes change.

**Why:** The realtime handler (`useActivityVotesRealtime`) and mutation `onSuccess` handlers only touch `['activities', activityId, 'votes']`. Without explicit batch invalidation, the Discuss section can lag indefinitely.

**How to apply:** Any time a vote is inserted, updated, or deleted (realtime or mutation success), also call:

```ts
queryClient.invalidateQueries({ queryKey: ['activity-votes-batch'] });
```

This pattern is already applied in: `useActivityVotesRealtime` (all three vote event handlers), `mutationDefaults.ts` `closeActivityVoting.onSuccess`, and `useRemoveVote.onSuccess`. Verify these are still present when touching vote logic, and add the same call to any new vote mutation/handler.

Accommodations and transfer flights use per-entity vote caches for their `isDiscuss` logic — they do **not** have this batch staleness issue, so this pattern is specific to activity votes.
