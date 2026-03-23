# Leaderboard Fix: Stale Data + Scrollable List

**Date:** 2026-03-23
**Status:** Approved
**Approach:** TDD

## Problem

1. **Stale data on `/leaderboard`**: The leaderboard shows old scores/players even after new games complete.
2. **No scroll**: With many players, the list overflows without a way to scroll to see lower-ranked players.

## Root Cause: Stale Data

The `/api/leaderboard/route.ts` is a Next.js App Router `GET` handler that does not access the `request` object. Next.js statically caches such routes at build time, so every request returns the same stale response regardless of database changes.

The in-memory cache (currently commented out) was a red herring — the real caching happens at the Next.js framework level.

## Design

### 1. Fix Stale Data — API Route

**File:** `src/app/api/leaderboard/route.ts`

- Add `export const dynamic = 'force-dynamic'` to opt out of Next.js static caching
- Re-enable the in-memory cache with a **30-second TTL** (balance between freshness and DB protection)
- Clean up leftover debug `console.log` statements in `src/lib/db.ts` `getGlobalLeaderboard()`

### 2. Scrollable Leaderboard — UI

**File:** `src/app/leaderboard/page.tsx`

- Add `max-h-[70vh] overflow-y-auto` to the table body container
- Use `-webkit-overflow-scrolling: touch` for smooth iOS momentum scrolling
- Keep the table header visible above the scrollable area (naturally stays outside the scroll container)
- **No visual changes** to rows, spacing, colors, or layout — preserve the current design exactly

**File:** `src/components/home/GlobalLeaderboard.tsx`

- No changes — the home widget keeps its `.slice(0, 10)` behavior (it's a preview widget)

### 3. Testing (TDD)

Write tests first, then implement:

- **API route test**: Verify `dynamic` export is `'force-dynamic'`, verify fresh data flow
- **UI scroll test**: Verify scroll container has correct overflow styles, verify all players render (not truncated)

## Files Changed

| File | Change |
|------|--------|
| `src/app/api/leaderboard/route.ts` | Add `force-dynamic`, re-enable 30s cache |
| `src/app/leaderboard/page.tsx` | Add scroll container to table body |
| `src/lib/db.ts` | Remove debug console.logs from `getGlobalLeaderboard()` |

## Out of Scope

- Pagination (YAGNI at current 20-50 player scale)
- Real-time polling / auto-refresh
- Changes to home page widget
- Changes to sharing/capture functionality
