# Leaderboard Fix: Stale Data + Scrollable List — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix stale leaderboard data caused by Next.js static caching and add scrollable container so all players are visible.

**Architecture:** Force the API route to be dynamic (not statically cached), re-enable a 30-second in-memory cache for DB protection, and wrap the leaderboard table body in a scrollable container with iOS touch support.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Supabase, Jest + React Testing Library

---

## Task 1: Fix API Route — Force Dynamic + Re-enable Cache

**Files:**
- Modify: `src/app/api/leaderboard/route.ts`
- Create: `src/app/api/leaderboard/__tests__/route.test.ts`

**Step 1: Write the failing test**

Create `src/app/api/leaderboard/__tests__/route.test.ts`:

```typescript
import { GET } from '../route';

// We need to verify the module exports force-dynamic
// Import the module to check its exports
import * as leaderboardRoute from '../route';

// Mock the db module
jest.mock('@/lib/db', () => ({
    getGlobalLeaderboard: jest.fn(() => Promise.resolve([
        {
            email: 'player1@test.com',
            name: 'Player 1',
            image: null,
            gamesPlayed: 5,
            wins: 3,
            secondPlace: 1,
            thirdPlace: 0,
            averagePercentile: 80,
            podiumRate: 80,
            winRate: 60,
            totalScore: 500,
            lastPlaceCount: 0,
        }
    ])),
}));

describe('/api/leaderboard route', () => {
    it('exports dynamic = "force-dynamic" to prevent Next.js static caching', () => {
        expect((leaderboardRoute as any).dynamic).toBe('force-dynamic');
    });

    it('returns leaderboard data from the database', async () => {
        const response = await GET();
        const data = await response.json();

        expect(data.leaderboard).toBeDefined();
        expect(data.leaderboard).toHaveLength(1);
        expect(data.leaderboard[0].name).toBe('Player 1');
    });

    it('returns cached: false on first request', async () => {
        const response = await GET();
        const data = await response.json();

        expect(data.cached).toBe(false);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/app/api/leaderboard/__tests__/route.test.ts --no-coverage`
Expected: FAIL — `dynamic` export doesn't exist yet, and test file doesn't exist

**Step 3: Write minimal implementation**

Replace `src/app/api/leaderboard/route.ts` with:

```typescript
import { NextResponse } from 'next/server';
import { getGlobalLeaderboard, LeaderboardEntry } from '@/lib/db';

// Force Next.js to treat this route as dynamic (not statically cached)
export const dynamic = 'force-dynamic';

// In-memory cache: 30 seconds TTL
let cachedLeaderboard: LeaderboardEntry[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 30 * 1000; // 30 seconds

export async function GET() {
    try {
        const now = Date.now();

        // Return cached data if fresh
        if (cachedLeaderboard && (now - cacheTimestamp) < CACHE_DURATION) {
            return NextResponse.json({
                leaderboard: cachedLeaderboard,
                cached: true,
                cacheAge: Math.round((now - cacheTimestamp) / 1000),
            });
        }

        // Fetch fresh data
        const leaderboard = await getGlobalLeaderboard();

        // Update cache
        cachedLeaderboard = leaderboard;
        cacheTimestamp = now;

        return NextResponse.json({
            leaderboard,
            cached: false,
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/leaderboard/__tests__/route.test.ts --no-coverage`
Expected: PASS (all 3 tests)

**Step 5: Commit**

```bash
git add src/app/api/leaderboard/__tests__/route.test.ts src/app/api/leaderboard/route.ts
git commit -m "fix(leaderboard): add force-dynamic to prevent stale cached responses

Next.js App Router statically caches GET route handlers that don't access
the request object. This was the root cause of stale leaderboard data.
Re-enables 30-second in-memory cache for DB protection."
```

---

## Task 2: Clean Up Debug Logs in db.ts

**Files:**
- Modify: `src/lib/db.ts:530-531,547,562,649` (remove debug console.logs from `getGlobalLeaderboard`)

**Step 1: Remove debug console.log statements**

In `src/lib/db.ts`, inside `getGlobalLeaderboard()`, remove these 4 lines:
- Line 530: `console.log(\`[Leaderboard] Found ${completedGameIds.length}...\`);`
- Line 547: `console.log(\`[Leaderboard] Fetched ${gamePlayers.length}...\`);`
- Line 562: `console.log(\`[Leaderboard] Fetched ${users.length}...\`);`
- Line 649: `console.log(\`[Leaderboard] Aggregation complete...\`);`

Keep the `log.info()` call on line 576 — that uses the structured logger and is appropriate for production.

**Step 2: Run existing db tests to verify nothing breaks**

Run: `npx jest src/lib/__tests__/db.test.ts --no-coverage`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "chore: remove debug console.logs from getGlobalLeaderboard"
```

---

## Task 3: Add Scrollable Container to Leaderboard Page

**Files:**
- Modify: `src/app/leaderboard/page.tsx`
- Create: `src/app/leaderboard/__tests__/page.test.tsx`

**Step 1: Write the failing test**

Create `src/app/leaderboard/__tests__/page.test.tsx`:

```tsx
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import LeaderboardPage from '../page';

// Mock next/image
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => <img {...props} />,
}));

// Mock html-to-image
jest.mock('html-to-image', () => ({
    toBlob: jest.fn(),
}));

// Mock ShareableLeaderboard
jest.mock('@/components/sharing/ShareableLeaderboard', () => ({
    ShareableLeaderboard: React.forwardRef((_props: any, ref: any) => (
        <div ref={ref} data-testid="shareable-leaderboard" />
    )),
}));

// Mock getAvatarUrl
jest.mock('@/lib/utils', () => ({
    getAvatarUrl: (url: string | null) => url || '/default-avatar.png',
}));

// Generate many players to test scroll behavior
function generatePlayers(count: number) {
    return Array.from({ length: count }, (_, i) => ({
        email: `player${i + 1}@test.com`,
        name: `Player ${i + 1}`,
        image: null,
        gamesPlayed: 10 - i,
        wins: 5 - Math.min(i, 4),
        secondPlace: 2,
        thirdPlace: 1,
        averagePercentile: 90 - i * 5,
        podiumRate: 80,
        winRate: 50 - i * 3,
        totalScore: 1000 - i * 50,
        lastPlaceCount: i,
    }));
}

describe('LeaderboardPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders all players without truncation (no .slice)', async () => {
        const players = generatePlayers(15);
        global.fetch = jest.fn(() =>
            Promise.resolve({
                json: () => Promise.resolve({ leaderboard: players }),
            })
        ) as any;

        const { getAllByText } = render(<LeaderboardPage />);

        await waitFor(() => {
            // All 15 players should render — not just top 10
            expect(getAllByText(/Player \d+/)).toHaveLength(15);
        });
    });

    it('has a scrollable container for the leaderboard rows', async () => {
        const players = generatePlayers(20);
        global.fetch = jest.fn(() =>
            Promise.resolve({
                json: () => Promise.resolve({ leaderboard: players }),
            })
        ) as any;

        const { container } = render(<LeaderboardPage />);

        await waitFor(() => {
            // Find the scrollable div wrapping the player rows
            const scrollContainer = container.querySelector('[data-testid="leaderboard-scroll"]');
            expect(scrollContainer).toBeInTheDocument();

            const style = window.getComputedStyle(scrollContainer!);
            // Check overflow-y is set for scrolling
            expect(scrollContainer).toHaveClass('overflow-y-auto');
        });
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/app/leaderboard/__tests__/page.test.tsx --no-coverage`
Expected: FAIL — `data-testid="leaderboard-scroll"` doesn't exist yet, test file doesn't exist

**Step 3: Write minimal implementation**

In `src/app/leaderboard/page.tsx`, wrap the table body div (the one with `className="divide-y divide-[var(--border)]"`) in a scrollable container.

Change the leaderboard table section (around line 196-261) from:

```tsx
<div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-lg">
    {/* Table Header */}
    <div className="grid grid-cols-[32px_1fr_40px_40px_44px_32px] gap-1 px-3 py-2 bg-[var(--muted)]/30 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
        ...header columns...
    </div>

    {/* Table Body */}
    <div className="divide-y divide-[var(--border)]">
        {leaderboard.map((player, index) => (
            ...rows...
        ))}
    </div>
</div>
```

To:

```tsx
<div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-lg">
    {/* Table Header */}
    <div className="grid grid-cols-[32px_1fr_40px_40px_44px_32px] gap-1 px-3 py-2 bg-[var(--muted)]/30 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
        ...header columns (unchanged)...
    </div>

    {/* Table Body — scrollable */}
    <div
        data-testid="leaderboard-scroll"
        className="divide-y divide-[var(--border)] max-h-[70vh] overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
    >
        {leaderboard.map((player, index) => (
            ...rows (unchanged)...
        ))}
    </div>
</div>
```

The only changes are:
1. Added `data-testid="leaderboard-scroll"` for testing
2. Added `max-h-[70vh] overflow-y-auto` classes
3. Added `style={{ WebkitOverflowScrolling: 'touch' }}` for iOS

**Step 4: Run test to verify it passes**

Run: `npx jest src/app/leaderboard/__tests__/page.test.tsx --no-coverage`
Expected: PASS (both tests)

**Step 5: Run all tests to ensure no regressions**

Run: `npx jest --no-coverage`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/app/leaderboard/__tests__/page.test.tsx src/app/leaderboard/page.tsx
git commit -m "feat(leaderboard): add scrollable container for long player lists

Wraps leaderboard table body in max-h-[70vh] overflow-y-auto container
with iOS touch scrolling support. Header stays visible while rows scroll."
```

---

## Task 4: Final Verification

**Step 1: Run full test suite**

Run: `npx jest --no-coverage`
Expected: All tests PASS

**Step 2: Run build to verify no type errors**

Run: `npx next build`
Expected: Build succeeds

**Step 3: Manual smoke test (if dev server available)**

- Visit `/leaderboard` — should show fresh data, not stale
- Scroll down — should be able to see all players
- On mobile viewport — scroll should feel smooth (iOS touch scrolling)
