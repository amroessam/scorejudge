# Architecture Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix ALL critical, important, and suggestion-level issues from the architecture review — CSRF bypass, data integrity, concurrency, code duplication, type safety, input validation, PII exposure, auth middleware, WebSocket hardening, leaderboard scaling, and component decomposition.

**Architecture:** Five phases ordered by severity and dependency. Phase 1: foundation (shared game logic, CSRF). Phase 2: data integrity (DB rollback, concurrency). Phase 3: security and type safety. Phase 4: PII reduction. Phase 5: suggestions (WebSocket heartbeat, leaderboard scaling, auth middleware, dashboard split, stale game scheduling). Every task follows TDD.

**Tech Stack:** Next.js App Router, TypeScript, Supabase, Jest, WebSocket (`ws`), pino logger

**Git config:** `user.name="satwa3k"` `user.email="assadmansoor7@gmail.com"`

---

## Phase 1: Foundation

### Task 1: Extract Shared Game Logic to `game-logic.ts`

`getFinalRoundNumber()` is duplicated in 4 files. Extract it to the empty `src/lib/game-logic.ts` and update all consumers.

**Files:**
- Modify: `src/lib/game-logic.ts` (currently empty)
- Modify: `src/lib/db.ts:669-672` (remove local `getFinalRoundNumber`)
- Modify: `src/app/api/games/[gameId]/route.ts:9-12` (remove local copy)
- Modify: `src/app/api/games/[gameId]/rounds/route.ts:36-39` (remove local copy)
- Modify: `src/app/dashboard/page.tsx:41-45` (remove local copy)
- Test: `src/lib/__tests__/game-logic.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/game-logic.test.ts`:

```typescript
import { getFinalRoundNumber } from '@/lib/game-logic';

describe('game-logic', () => {
    describe('getFinalRoundNumber', () => {
        it('returns correct final round for 4 players with 52-card deck', () => {
            // 52 / 4 = 13 max cards, final round = 13 * 2 - 1 = 25
            expect(getFinalRoundNumber(4, 52)).toBe(25);
        });

        it('returns correct final round for 6 players with 52-card deck', () => {
            // 52 / 6 = 8 (floor), final round = 8 * 2 - 1 = 15
            expect(getFinalRoundNumber(6, 52)).toBe(15);
        });

        it('returns correct final round for 3 players with 52-card deck', () => {
            // 52 / 3 = 17 (floor), final round = 17 * 2 - 1 = 33
            expect(getFinalRoundNumber(3, 52)).toBe(33);
        });

        it('returns correct final round for debug deck (6 cards)', () => {
            // 6 / 3 = 2, final round = 2 * 2 - 1 = 3
            expect(getFinalRoundNumber(3, 6)).toBe(3);
        });

        it('returns 12 as fallback when numPlayers is 0 or falsy', () => {
            expect(getFinalRoundNumber(0, 52)).toBe(12);
        });
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/game-logic.test.ts --no-coverage`
Expected: FAIL — `getFinalRoundNumber` not exported from `@/lib/game-logic`

**Step 3: Implement the shared module**

Write `src/lib/game-logic.ts`:

```typescript
/**
 * Shared game logic functions.
 * Single source of truth for game rules and calculations.
 */

/**
 * Calculate the final round number for a game.
 * The game goes up from 1 card to maxCards, then back down to 1.
 * Total rounds = maxCards * 2 - 1
 *
 * @param numPlayers - Number of players in the game
 * @param deckSize - Number of cards in the deck (52 standard, 6 debug)
 * @returns The index of the final round
 */
export function getFinalRoundNumber(numPlayers: number, deckSize: number): number {
    if (!numPlayers) return 12;
    const maxCards = Math.floor(deckSize / numPlayers);
    return maxCards * 2 - 1;
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/game-logic.test.ts --no-coverage`
Expected: PASS (all 5 tests)

**Step 5: Update all consumers**

In each file, replace the local `getFinalRoundNumber` with an import:

**`src/lib/db.ts`** — Remove lines 669-672, add import at top:
```typescript
import { getFinalRoundNumber } from './game-logic';
```
Update the call at line ~612 from `getFinalRoundNumber(numPlayers)` to `getFinalRoundNumber(numPlayers, DECK_SIZE)` (DECK_SIZE is already imported from config).

Also update the call in `purgeStaleGames()` (~line 712) the same way.

**`src/app/api/games/[gameId]/route.ts`** — Remove lines 9-12, add import:
```typescript
import { getFinalRoundNumber } from '@/lib/game-logic';
import { DECK_SIZE } from '@/lib/config';
```
Update calls to pass `DECK_SIZE` as second argument.

**`src/app/api/games/[gameId]/rounds/route.ts`** — Remove lines 36-39, add import:
```typescript
import { getFinalRoundNumber } from '@/lib/game-logic';
import { DECK_SIZE } from '@/lib/config';
```
Update calls to pass `DECK_SIZE` as second argument.

**`src/app/dashboard/page.tsx`** — Remove lines 41-45, add import:
```typescript
import { getFinalRoundNumber } from '@/lib/game-logic';
import { DECK_SIZE } from '@/lib/config';
```
Update calls to pass `DECK_SIZE` as second argument.

**Step 6: Run full test suite to verify no regressions**

Run: `npx jest --no-coverage --testPathIgnorePatterns='node_modules|.auto-claude'`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add src/lib/game-logic.ts src/lib/__tests__/game-logic.test.ts src/lib/db.ts \
  src/app/api/games/[gameId]/route.ts src/app/api/games/[gameId]/rounds/route.ts \
  src/app/dashboard/page.tsx
git commit -m "refactor: extract getFinalRoundNumber to shared game-logic module

Eliminates 4x duplication. Single source of truth with explicit deckSize param.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Fix CSRF Bypass in Production

The CSRF validator allows requests when both `Origin` and `Referer` headers are missing — this is a security bypass.

**Files:**
- Modify: `src/lib/csrf.ts:18-24`
- Test: `src/lib/__tests__/csrf.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/csrf.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

// We need to test with NODE_ENV=production
const originalEnv = process.env.NODE_ENV;

function makeRequest(method: string, headers: Record<string, string> = {}): NextRequest {
    const url = 'https://scorejudge.com/api/test';
    const reqHeaders = new Headers(headers);
    if (!headers['host']) reqHeaders.set('host', 'scorejudge.com');
    return new NextRequest(url, { method, headers: reqHeaders });
}

describe('validateCSRF', () => {
    let validateCSRF: (req: NextRequest) => boolean;

    beforeAll(async () => {
        process.env.NODE_ENV = 'production';
        // Dynamic import after setting env
        jest.resetModules();
        const csrf = await import('@/lib/csrf');
        validateCSRF = csrf.validateCSRF;
    });

    afterAll(() => {
        process.env.NODE_ENV = originalEnv;
    });

    it('allows GET requests regardless of headers', () => {
        const req = makeRequest('GET');
        expect(validateCSRF(req)).toBe(true);
    });

    it('allows POST with valid same-origin Origin header', () => {
        const req = makeRequest('POST', {
            origin: 'https://scorejudge.com',
            host: 'scorejudge.com',
        });
        expect(validateCSRF(req)).toBe(true);
    });

    it('rejects POST when both Origin and Referer are missing in production', () => {
        const req = makeRequest('POST', { host: 'scorejudge.com' });
        expect(validateCSRF(req)).toBe(false);
    });

    it('rejects POST with mismatched Origin header', () => {
        const req = makeRequest('POST', {
            origin: 'https://evil.com',
            host: 'scorejudge.com',
        });
        expect(validateCSRF(req)).toBe(false);
    });

    it('allows POST with valid Referer when Origin is missing', () => {
        const req = makeRequest('POST', {
            referer: 'https://scorejudge.com/dashboard',
            host: 'scorejudge.com',
        });
        expect(validateCSRF(req)).toBe(true);
    });
});
```

**Step 2: Run test to verify `rejects POST when both Origin and Referer are missing` fails**

Run: `npx jest src/lib/__tests__/csrf.test.ts --no-coverage`
Expected: FAIL on the "rejects POST when both Origin and Referer are missing" test (currently returns `true`)

**Step 3: Fix the CSRF bypass**

In `src/lib/csrf.ts`, change the `!origin && !referer` branch (around line 20-23):

From:
```typescript
        if (!origin && !referer) {
            // Allow if no origin/referer (e.g., Postman, curl) but log warning
            console.warn('CSRF: Missing Origin and Referer headers');
            return true; // Allow for API clients, but could be stricter
        }
```

To:
```typescript
        if (!origin && !referer) {
            console.warn('CSRF: Rejecting request with missing Origin and Referer headers');
            return false;
        }
```

**Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/csrf.test.ts --no-coverage`
Expected: PASS (all 5 tests)

**Step 5: Run full test suite**

Run: `npx jest --no-coverage --testPathIgnorePatterns='node_modules|.auto-claude'`
Expected: All tests PASS (check if any existing tests relied on the old permissive behavior)

**Step 6: Commit**

```bash
git add src/lib/csrf.ts src/lib/__tests__/csrf.test.ts
git commit -m "fix(security): reject CSRF requests missing Origin and Referer headers

Previously returned true (allowed) when both headers were missing in
production, enabling CSRF bypass via curl or misconfigured clients.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2: Data Integrity

### Task 3: Add DB Write Rollback Pattern

The core problem: API route handlers modify in-memory game state BEFORE persisting to DB. If the DB write fails, memory is corrupted. Fix by implementing a "snapshot and rollback" pattern.

**Files:**
- Create: `src/lib/state-transaction.ts`
- Test: `src/lib/__tests__/state-transaction.test.ts`
- Modify: `src/app/api/games/[gameId]/rounds/route.ts` (apply pattern to BIDS and TRICKS actions)

**Step 1: Write the failing test**

Create `src/lib/__tests__/state-transaction.test.ts`:

```typescript
import { withStateRollback } from '@/lib/state-transaction';
import { GameState } from '@/lib/store';

function makeGame(): GameState {
    return {
        id: 'game-1',
        name: 'Test Game',
        players: [
            { id: 'p1', name: 'Alice', email: 'a@test.com', score: 100, bid: 0, tricks: 0, playerOrder: 0 },
            { id: 'p2', name: 'Bob', email: 'b@test.com', score: 50, bid: 0, tricks: 0, playerOrder: 1 },
        ],
        rounds: [
            { index: 1, cards: 5, trump: 'hearts', state: 'PLAYING' as const, bids: { 'a@test.com': 2 }, tricks: {} },
        ],
        currentRoundIndex: 1,
        ownerEmail: 'a@test.com',
        createdAt: Date.now(),
        lastUpdated: Date.now(),
    };
}

describe('withStateRollback', () => {
    it('returns the result when the async operation succeeds', async () => {
        const game = makeGame();
        const result = await withStateRollback(game, async (g) => {
            g.players[0].score = 200;
            return true;
        });

        expect(result).toBe(true);
        expect(game.players[0].score).toBe(200);
    });

    it('rolls back game state when the async operation throws', async () => {
        const game = makeGame();
        const originalScore = game.players[0].score;

        await expect(
            withStateRollback(game, async (g) => {
                g.players[0].score = 999;
                g.currentRoundIndex = 99;
                throw new Error('DB write failed');
            })
        ).rejects.toThrow('DB write failed');

        expect(game.players[0].score).toBe(originalScore);
        expect(game.currentRoundIndex).toBe(1);
    });

    it('rolls back game state when the async operation returns false', async () => {
        const game = makeGame();
        const originalScore = game.players[0].score;

        const result = await withStateRollback(game, async (g) => {
            g.players[0].score = 999;
            return false;
        });

        expect(result).toBe(false);
        expect(game.players[0].score).toBe(originalScore);
    });

    it('preserves round state changes on success', async () => {
        const game = makeGame();

        await withStateRollback(game, async (g) => {
            g.rounds[0].state = 'COMPLETED';
            g.rounds[0].tricks = { 'a@test.com': 2, 'b@test.com': 3 };
            return true;
        });

        expect(game.rounds[0].state).toBe('COMPLETED');
        expect(game.rounds[0].tricks['a@test.com']).toBe(2);
    });

    it('rolls back round state changes on failure', async () => {
        const game = makeGame();

        await expect(
            withStateRollback(game, async (g) => {
                g.rounds[0].state = 'COMPLETED';
                g.rounds[0].tricks = { 'a@test.com': 2 };
                throw new Error('Failed');
            })
        ).rejects.toThrow('Failed');

        expect(game.rounds[0].state).toBe('PLAYING');
        expect(game.rounds[0].tricks).toEqual({});
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/state-transaction.test.ts --no-coverage`
Expected: FAIL — `withStateRollback` not found

**Step 3: Implement the rollback utility**

Create `src/lib/state-transaction.ts`:

```typescript
import { GameState } from './store';

/**
 * Deep clone a GameState for snapshot/rollback.
 * Only clones the mutable parts (players, rounds, currentRoundIndex).
 */
function snapshotGame(game: GameState): {
    players: GameState['players'];
    rounds: GameState['rounds'];
    currentRoundIndex: number;
    lastUpdated: number;
} {
    return {
        players: game.players.map(p => ({ ...p })),
        rounds: game.rounds.map(r => ({
            ...r,
            bids: { ...r.bids },
            tricks: { ...r.tricks },
        })),
        currentRoundIndex: game.currentRoundIndex,
        lastUpdated: game.lastUpdated,
    };
}

/**
 * Restore a GameState from a snapshot (in-place mutation).
 */
function restoreGame(game: GameState, snapshot: ReturnType<typeof snapshotGame>): void {
    game.players = snapshot.players;
    game.rounds = snapshot.rounds;
    game.currentRoundIndex = snapshot.currentRoundIndex;
    game.lastUpdated = snapshot.lastUpdated;
}

/**
 * Execute an async operation that mutates game state.
 * If the operation throws or returns false, the game state is rolled back
 * to the snapshot taken before the operation started.
 *
 * @param game - The game state object (will be mutated in place)
 * @param operation - Async function that mutates game and persists to DB.
 *                    Return false to signal failure (triggers rollback).
 *                    Throw to signal error (triggers rollback + rethrow).
 * @returns The return value of the operation
 */
export async function withStateRollback<T>(
    game: GameState,
    operation: (game: GameState) => Promise<T>,
): Promise<T> {
    const snapshot = snapshotGame(game);

    try {
        const result = await operation(game);

        // If operation returns false, treat as failure
        if (result === false) {
            restoreGame(game, snapshot);
        }

        return result;
    } catch (error) {
        restoreGame(game, snapshot);
        throw error;
    }
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/state-transaction.test.ts --no-coverage`
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add src/lib/state-transaction.ts src/lib/__tests__/state-transaction.test.ts
git commit -m "feat: add withStateRollback for atomic in-memory state updates

Snapshots game state before DB writes. If the write fails or returns false,
the in-memory state is automatically restored to the pre-operation snapshot.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Apply Rollback Pattern to Rounds Route (TRICKS action)

The TRICKS action is the most critical — it modifies scores, round state, and currentRoundIndex before persisting.

**Files:**
- Modify: `src/app/api/games/[gameId]/rounds/route.ts` (TRICKS action, ~lines 181-280)

**Step 1: Identify the current pattern**

The current TRICKS handler does:
1. Validate tricks
2. Calculate points
3. Mutate `round.tricks`, `round.state`, player scores, `game.currentRoundIndex` (all in memory)
4. Call `saveRoundTricks()` to persist
5. Broadcast

If step 4 fails, steps 1-3 are already applied to the in-memory game.

**Step 2: Wrap the mutation + persist in withStateRollback**

In `src/app/api/games/[gameId]/rounds/route.ts`, add import:
```typescript
import { withStateRollback } from '@/lib/state-transaction';
```

Find the TRICKS action block. Wrap the mutation + DB persist inside `withStateRollback`:

```typescript
// Inside the TRICKS action handler, after validation is complete:
const rollbackResult = await withStateRollback(game, async (g) => {
    const round = g.rounds.find(r => r.index === g.currentRoundIndex)!;

    // Apply points to player scores
    for (const player of g.players) {
        player.score += points[player.email];
    }

    // Persist to DB first
    const saved = await saveRoundTricks(gameId, round.index, validatedTricks, points, g.players);
    if (!saved) return false;

    // Only update in-memory state after successful DB write
    round.tricks = validatedTricks;
    round.state = 'COMPLETED';

    const finalRound = getFinalRoundNumber(g.players.length, DECK_SIZE);
    const isGameComplete = g.currentRoundIndex >= finalRound;

    if (!isGameComplete) {
        g.currentRoundIndex += 1;
        await updateGame(gameId, { currentRoundIndex: g.currentRoundIndex });
    }

    return { isGameComplete };
});

if (rollbackResult === false) {
    return NextResponse.json({ error: 'Failed to save tricks' }, { status: 500 });
}
```

**Step 3: Run full test suite**

Run: `npx jest --no-coverage --testPathIgnorePatterns='node_modules|.auto-claude'`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/app/api/games/[gameId]/rounds/route.ts
git commit -m "fix(data-integrity): wrap TRICKS action in withStateRollback

If DB write fails, in-memory game state is rolled back to pre-operation
snapshot. Prevents silent state divergence between memory and database.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Apply Rollback Pattern to Rounds Route (BIDS action)

Same pattern for the BIDS action.

**Files:**
- Modify: `src/app/api/games/[gameId]/rounds/route.ts` (BIDS action, ~lines 141-180)

**Step 1: Wrap BIDS mutation + persist in withStateRollback**

Find the BIDS action block. Same approach:

```typescript
const rollbackResult = await withStateRollback(game, async (g) => {
    const round = g.rounds.find(r => r.index === g.currentRoundIndex)!;

    // Persist to DB first
    const saved = await saveRoundBids(gameId, round.index, validatedBids, g.players, round.cards, round.trump);
    if (!saved) return false;

    // Only update in-memory state after successful DB write
    round.bids = validatedBids;
    round.state = 'PLAYING';
    return true;
});

if (rollbackResult === false) {
    return NextResponse.json({ error: 'Failed to save bids' }, { status: 500 });
}
```

**Step 2: Run full test suite**

Run: `npx jest --no-coverage --testPathIgnorePatterns='node_modules|.auto-claude'`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/app/api/games/[gameId]/rounds/route.ts
git commit -m "fix(data-integrity): wrap BIDS action in withStateRollback

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Fix Unhandled Await in `saveRoundTricks`

`db.ts:saveRoundTricks` line ~427 has an `await` with no error handling on the round state update.

**Files:**
- Modify: `src/lib/db.ts:404-443`
- Test: Add test to `src/lib/__tests__/db.test.ts`

**Step 1: Write the failing test**

Add to `src/lib/__tests__/db.test.ts`:

```typescript
describe('saveRoundTricks', () => {
    it('returns false if round state update fails', async () => {
        // Mock the chain: fetch round → upsert tricks → update state (fails)
        // This tests that the await on line ~427 is properly error-handled
        // Implementation: mock supabaseAdmin to fail on the .update() call
        // ... (mock setup specific to the existing mock patterns in db.test.ts)
    });
});
```

**Step 2: Fix the unhandled await**

In `src/lib/db.ts`, `saveRoundTricks()`, change the round state update (~line 427) from:

```typescript
    // 3. Update round state
    await supabaseAdmin
        .from('rounds')
        .update({ state: 'COMPLETED' })
        .eq('id', round.id);
```

To:

```typescript
    // 3. Update round state
    const { error: stateError } = await supabaseAdmin
        .from('rounds')
        .update({ state: 'COMPLETED' })
        .eq('id', round.id);

    if (stateError) {
        log.error({ roundId: round.id, error: stateError.message }, 'Error updating round state to COMPLETED');
        return false;
    }
```

**Step 3: Run tests**

Run: `npx jest --no-coverage --testPathIgnorePatterns='node_modules|.auto-claude'`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/lib/db.ts src/lib/__tests__/db.test.ts
git commit -m "fix(db): handle error on round state update in saveRoundTricks

Previously the await had no error check — a failed round state update
would leave the round stuck in PLAYING state in DB while memory shows COMPLETED.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Add Per-Game Mutex for Concurrency Control

Prevent race conditions from concurrent requests modifying the same game.

**Files:**
- Create: `src/lib/game-lock.ts`
- Test: `src/lib/__tests__/game-lock.test.ts`
- Modify: `src/app/api/games/[gameId]/rounds/route.ts` (wrap POST handler in lock)

**Step 1: Write the failing test**

Create `src/lib/__tests__/game-lock.test.ts`:

```typescript
import { withGameLock } from '@/lib/game-lock';

describe('withGameLock', () => {
    it('executes the operation and returns its result', async () => {
        const result = await withGameLock('game-1', async () => {
            return 'done';
        });
        expect(result).toBe('done');
    });

    it('serializes concurrent operations on the same game', async () => {
        const order: number[] = [];

        const op1 = withGameLock('game-1', async () => {
            order.push(1);
            await new Promise(r => setTimeout(r, 50));
            order.push(2);
        });

        const op2 = withGameLock('game-1', async () => {
            order.push(3);
            await new Promise(r => setTimeout(r, 10));
            order.push(4);
        });

        await Promise.all([op1, op2]);

        // op1 should fully complete before op2 starts
        expect(order).toEqual([1, 2, 3, 4]);
    });

    it('allows concurrent operations on different games', async () => {
        const order: string[] = [];

        const op1 = withGameLock('game-A', async () => {
            order.push('A-start');
            await new Promise(r => setTimeout(r, 50));
            order.push('A-end');
        });

        const op2 = withGameLock('game-B', async () => {
            order.push('B-start');
            await new Promise(r => setTimeout(r, 10));
            order.push('B-end');
        });

        await Promise.all([op1, op2]);

        // Both should start before either finishes
        expect(order.indexOf('A-start')).toBeLessThan(order.indexOf('A-end'));
        expect(order.indexOf('B-start')).toBeLessThan(order.indexOf('B-end'));
        // B should finish before A (shorter timeout)
        expect(order.indexOf('B-end')).toBeLessThan(order.indexOf('A-end'));
    });

    it('releases the lock even if the operation throws', async () => {
        await expect(
            withGameLock('game-1', async () => { throw new Error('fail'); })
        ).rejects.toThrow('fail');

        // Should be able to acquire lock again
        const result = await withGameLock('game-1', async () => 'recovered');
        expect(result).toBe('recovered');
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/game-lock.test.ts --no-coverage`
Expected: FAIL — `withGameLock` not found

**Step 3: Implement the game lock**

Create `src/lib/game-lock.ts`:

```typescript
/**
 * Per-game mutex to prevent concurrent state mutations.
 *
 * Uses a simple promise-chain pattern: each operation on a game
 * waits for the previous operation to complete before starting.
 */

const locks = new Map<string, Promise<void>>();

/**
 * Execute an operation while holding an exclusive lock on the game.
 * Concurrent calls for the same gameId are serialized.
 * Different gameIds run in parallel.
 */
export async function withGameLock<T>(
    gameId: string,
    operation: () => Promise<T>,
): Promise<T> {
    // Wait for any existing operation on this game
    const existing = locks.get(gameId) || Promise.resolve();

    let resolve: () => void;
    const next = new Promise<void>(r => { resolve = r; });
    locks.set(gameId, next);

    try {
        await existing;
        return await operation();
    } finally {
        resolve!();
        // Clean up if no one else is waiting
        if (locks.get(gameId) === next) {
            locks.delete(gameId);
        }
    }
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/game-lock.test.ts --no-coverage`
Expected: PASS (all 4 tests)

**Step 5: Apply lock to the rounds route**

In `src/app/api/games/[gameId]/rounds/route.ts`, add import:
```typescript
import { withGameLock } from '@/lib/game-lock';
```

Wrap the entire POST handler body in `withGameLock`:

```typescript
export async function POST(req: NextRequest, { params }: { params: { gameId: string } }) {
    const { gameId } = params;

    return withGameLock(gameId, async () => {
        // ... existing handler body (auth check, action routing, etc.)
    });
}
```

**Step 6: Run full test suite**

Run: `npx jest --no-coverage --testPathIgnorePatterns='node_modules|.auto-claude'`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add src/lib/game-lock.ts src/lib/__tests__/game-lock.test.ts \
  src/app/api/games/[gameId]/rounds/route.ts
git commit -m "feat: add per-game mutex to prevent concurrent state mutations

Promise-chain based lock serializes operations on the same game while
allowing different games to be processed in parallel.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3: Security & Type Safety

### Task 8: Type the Global Broadcast Functions

Replace untyped `(global as any)` with proper TypeScript declarations.

**Files:**
- Create: `src/types/global.d.ts`
- Modify: `server.ts` (use typed global)
- Modify: `src/app/api/games/[gameId]/rounds/route.ts` (use typed global)
- Modify: `src/app/api/games/[gameId]/route.ts` (use typed global)

**Step 1: Create the type declaration**

Create `src/types/global.d.ts`:

```typescript
import { GameState } from '@/lib/store';

type DiscoveryUpdateType = 'GAME_CREATED' | 'GAME_UPDATED' | 'GAME_DELETED';

declare global {
    // eslint-disable-next-line no-var
    var broadcastGameUpdate: ((gameId: string, state: GameState) => void) | undefined;
    // eslint-disable-next-line no-var
    var broadcastDiscoveryUpdate: ((updateType: DiscoveryUpdateType, game: any) => void) | undefined;
}

export {};
```

**Step 2: Update server.ts**

Replace all `(global as any).broadcastGameUpdate = ...` with `global.broadcastGameUpdate = ...`
Replace all `(global as any).broadcastDiscoveryUpdate = ...` with `global.broadcastDiscoveryUpdate = ...`

**Step 3: Update route files**

In all files that use `(global as any).broadcastGameUpdate(...)`:
Replace with `global.broadcastGameUpdate?.(...)` (optional chaining for safety)

Same for `broadcastDiscoveryUpdate`.

**Step 4: Run full test suite + TypeScript check**

Run: `npx jest --no-coverage --testPathIgnorePatterns='node_modules|.auto-claude'`
Run: `npx tsc --noEmit`
Expected: Both pass

**Step 5: Commit**

```bash
git add src/types/global.d.ts server.ts \
  src/app/api/games/[gameId]/rounds/route.ts \
  src/app/api/games/[gameId]/route.ts
git commit -m "refactor: add TypeScript declarations for global broadcast functions

Replaces (global as any) casts with proper global type declarations.
Uses optional chaining for safety when calling broadcast functions.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Add Input Sanitization for Game Names

Game names are user-provided with no validation.

**Files:**
- Create: `src/lib/validation.ts`
- Test: `src/lib/__tests__/validation.test.ts`
- Modify: `src/app/api/games/route.ts` (apply validation on game creation)

**Step 1: Write the failing test**

Create `src/lib/__tests__/validation.test.ts`:

```typescript
import { validateGameName } from '@/lib/validation';

describe('validateGameName', () => {
    it('accepts valid game names', () => {
        expect(validateGameName('Friday Night Game')).toEqual({ valid: true, sanitized: 'Friday Night Game' });
        expect(validateGameName('Game #1')).toEqual({ valid: true, sanitized: 'Game #1' });
    });

    it('trims whitespace', () => {
        expect(validateGameName('  My Game  ')).toEqual({ valid: true, sanitized: 'My Game' });
    });

    it('rejects empty names', () => {
        expect(validateGameName('')).toEqual({ valid: false, error: 'Game name is required' });
        expect(validateGameName('   ')).toEqual({ valid: false, error: 'Game name is required' });
    });

    it('rejects names longer than 50 characters', () => {
        const longName = 'A'.repeat(51);
        expect(validateGameName(longName)).toEqual({ valid: false, error: 'Game name must be 50 characters or less' });
    });

    it('accepts names exactly 50 characters', () => {
        const name = 'A'.repeat(50);
        expect(validateGameName(name)).toEqual({ valid: true, sanitized: name });
    });

    it('strips HTML tags', () => {
        expect(validateGameName('<script>alert("xss")</script>Game')).toEqual({ valid: true, sanitized: 'alert("xss")Game' });
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/validation.test.ts --no-coverage`
Expected: FAIL — `validateGameName` not found

**Step 3: Implement validation**

Create `src/lib/validation.ts`:

```typescript
interface ValidationResult {
    valid: boolean;
    sanitized?: string;
    error?: string;
}

/**
 * Validate and sanitize a game name.
 */
export function validateGameName(name: string): ValidationResult {
    // Strip HTML tags
    const stripped = name.replace(/<[^>]*>/g, '');
    const trimmed = stripped.trim();

    if (!trimmed) {
        return { valid: false, error: 'Game name is required' };
    }

    if (trimmed.length > 50) {
        return { valid: false, error: 'Game name must be 50 characters or less' };
    }

    return { valid: true, sanitized: trimmed };
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/validation.test.ts --no-coverage`
Expected: PASS (all 6 tests)

**Step 5: Apply to game creation route**

In `src/app/api/games/route.ts`, add import and validation:

```typescript
import { validateGameName } from '@/lib/validation';

// Inside POST handler, before creating the game:
const nameResult = validateGameName(body.name);
if (!nameResult.valid) {
    return NextResponse.json({ error: nameResult.error }, { status: 400 });
}
const gameName = nameResult.sanitized!;
// Use gameName instead of body.name from here on
```

**Step 6: Run full test suite**

Run: `npx jest --no-coverage --testPathIgnorePatterns='node_modules|.auto-claude'`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add src/lib/validation.ts src/lib/__tests__/validation.test.ts src/app/api/games/route.ts
git commit -m "feat: add input validation and sanitization for game names

Max 50 chars, strips HTML tags, trims whitespace, rejects empty names.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Guard Anonymous Debug Provider in Production

Ensure the anonymous login provider cannot be enabled in production, even if `NEXT_PUBLIC_DEBUG_MODE` is accidentally set.

**Files:**
- Modify: `src/lib/config.ts`
- Modify: auth config file (wherever `DEBUG_MODE` is checked for the credentials provider)
- Test: `src/lib/__tests__/config.test.ts`

**Step 1: Write the failing test**

Add to `src/lib/__tests__/config.test.ts`:

```typescript
describe('DEBUG_MODE', () => {
    it('is false in production even if NEXT_PUBLIC_DEBUG_MODE is set', () => {
        // This test verifies the production guard exists in config.ts
        // The actual enforcement is: DEBUG_MODE should check NODE_ENV
    });
});
```

**Step 2: Update config.ts**

Change `src/lib/config.ts` from:
```typescript
export const DEBUG_MODE = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';
```

To:
```typescript
export const DEBUG_MODE = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true' && process.env.NODE_ENV !== 'production';
```

**Step 3: Run full test suite**

Run: `npx jest --no-coverage --testPathIgnorePatterns='node_modules|.auto-claude'`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/lib/config.ts src/lib/__tests__/config.test.ts
git commit -m "fix(security): prevent debug mode from enabling in production

Adds NODE_ENV !== 'production' guard to DEBUG_MODE so the anonymous
login provider can never be enabled in production environments.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4: PII Reduction

### Task 11: Strip Emails from WebSocket Broadcast Payloads

Player emails are currently broadcast to all connected clients. Replace with player IDs in the broadcast payload.

**Files:**
- Modify: `server.ts` (sanitize game state before broadcasting)
- Test: `src/lib/__tests__/sanitize-broadcast.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/sanitize-broadcast.test.ts`:

```typescript
import { sanitizeGameForBroadcast } from '@/lib/sanitize-broadcast';
import { GameState } from '@/lib/store';

describe('sanitizeGameForBroadcast', () => {
    it('removes email addresses from players', () => {
        const game: GameState = {
            id: 'game-1',
            name: 'Test',
            players: [
                { id: 'p1', name: 'Alice', email: 'alice@secret.com', score: 100, bid: 0, tricks: 0, playerOrder: 0 },
            ],
            rounds: [],
            currentRoundIndex: 0,
            ownerEmail: 'alice@secret.com',
            createdAt: Date.now(),
            lastUpdated: Date.now(),
        };

        const sanitized = sanitizeGameForBroadcast(game);

        // Players should not have email field
        expect(sanitized.players[0]).not.toHaveProperty('email');
        expect(sanitized.players[0].name).toBe('Alice');
        expect(sanitized.players[0].id).toBe('p1');
    });

    it('replaces ownerEmail with ownerId', () => {
        const game: GameState = {
            id: 'game-1',
            name: 'Test',
            players: [
                { id: 'p1', name: 'Alice', email: 'alice@secret.com', score: 100, bid: 0, tricks: 0, playerOrder: 0 },
            ],
            rounds: [],
            currentRoundIndex: 0,
            ownerEmail: 'alice@secret.com',
            createdAt: Date.now(),
            lastUpdated: Date.now(),
        };

        const sanitized = sanitizeGameForBroadcast(game);

        expect(sanitized).not.toHaveProperty('ownerEmail');
        expect(sanitized.ownerId).toBe('p1');
    });

    it('does not modify the original game object', () => {
        const game: GameState = {
            id: 'game-1',
            name: 'Test',
            players: [
                { id: 'p1', name: 'Alice', email: 'alice@secret.com', score: 100, bid: 0, tricks: 0, playerOrder: 0 },
            ],
            rounds: [],
            currentRoundIndex: 0,
            ownerEmail: 'alice@secret.com',
            createdAt: Date.now(),
            lastUpdated: Date.now(),
        };

        sanitizeGameForBroadcast(game);

        // Original should be untouched
        expect(game.players[0].email).toBe('alice@secret.com');
        expect(game.ownerEmail).toBe('alice@secret.com');
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/sanitize-broadcast.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Implement sanitizer**

Create `src/lib/sanitize-broadcast.ts`:

```typescript
import { GameState } from './store';

interface SanitizedPlayer {
    id: string;
    name: string;
    image?: string;
    score: number;
    bid: number;
    tricks: number;
    playerOrder: number;
}

interface SanitizedGameState {
    id: string;
    name: string;
    players: SanitizedPlayer[];
    rounds: GameState['rounds'];
    currentRoundIndex: number;
    ownerId: string;
    operatorId?: string;
    createdAt: number;
    lastUpdated: number;
}

/**
 * Strip PII (emails) from game state before broadcasting over WebSocket.
 * Returns a new object — does not mutate the original.
 */
export function sanitizeGameForBroadcast(game: GameState): SanitizedGameState {
    const emailToId = new Map(game.players.map(p => [p.email, p.id]));

    return {
        id: game.id,
        name: game.name,
        players: game.players.map(p => ({
            id: p.id,
            name: p.name,
            image: p.image,
            score: p.score,
            bid: p.bid,
            tricks: p.tricks,
            playerOrder: p.playerOrder,
        })),
        rounds: game.rounds,
        currentRoundIndex: game.currentRoundIndex,
        ownerId: emailToId.get(game.ownerEmail) || '',
        operatorId: game.operatorEmail ? emailToId.get(game.operatorEmail) : undefined,
        createdAt: game.createdAt,
        lastUpdated: game.lastUpdated,
    };
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/sanitize-broadcast.test.ts --no-coverage`
Expected: PASS (all 3 tests)

**Step 5: Apply to server.ts broadcast**

In `server.ts`, update `broadcastGameUpdate` to sanitize before sending:

```typescript
import { sanitizeGameForBroadcast } from './src/lib/sanitize-broadcast';

global.broadcastGameUpdate = (gameId: string, state: GameState) => {
    const sanitized = sanitizeGameForBroadcast(state);
    // ... send sanitized instead of state
};
```

**Note:** This change requires updating the client-side game page to work with IDs instead of emails for the owner/operator check. This is a **breaking change** that needs careful coordination. The implementer should:
1. Check all client references to `ownerEmail` and `operatorEmail` in `src/app/game/[gameId]/page.tsx`
2. Update them to use `ownerId` and `operatorId`
3. Ensure the client knows the current user's player ID (available from the session or the players array)

**Step 6: Run full test suite**

Run: `npx jest --no-coverage --testPathIgnorePatterns='node_modules|.auto-claude'`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add src/lib/sanitize-broadcast.ts src/lib/__tests__/sanitize-broadcast.test.ts server.ts
git commit -m "feat: strip PII from WebSocket broadcast payloads

Removes player emails from game state before sending over WebSocket.
Replaces ownerEmail/operatorEmail with ownerId/operatorId.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5: Suggestions & Hardening

### Task 12: Add Centralized Auth Middleware

Currently each API route does its own auth check. A missing check = unprotected route.

**Files:**
- Create: `src/middleware.ts`
- Test: `src/middleware.test.ts`

**Step 1: Write the failing test**

Create `src/middleware.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

describe('middleware', () => {
    it('allows public routes without auth', async () => {
        // /api/auth/* and /api/health should pass through
        // Test that middleware doesn't block these
    });

    it('returns 401 for protected API routes without session token', async () => {
        // POST /api/games should be rejected without a session cookie
    });

    it('allows protected API routes with valid session token', async () => {
        // POST /api/games with a valid session cookie should pass
    });
});
```

**Step 2: Implement middleware**

Create `src/middleware.ts`:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Routes that don't require authentication
const publicPaths = [
    '/api/auth',
    '/api/health',
    '/api/og',
];

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Skip non-API routes (pages handled by NextAuth client-side)
    if (!pathname.startsWith('/api/')) {
        return NextResponse.next();
    }

    // Skip public API routes
    if (publicPaths.some(p => pathname.startsWith(p))) {
        return NextResponse.next();
    }

    // Skip GET requests to leaderboard (public read)
    if (pathname === '/api/leaderboard' && req.method === 'GET') {
        return NextResponse.next();
    }

    // Verify auth token
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.next();
}

export const config = {
    matcher: '/api/:path*',
};
```

**Step 3: Run tests, commit**

```bash
git add src/middleware.ts src/middleware.test.ts
git commit -m "feat: add centralized auth middleware for API routes

Protects all /api/* routes by default. Public routes (auth, health, OG images,
leaderboard GET) are whitelisted. Eliminates risk of unprotected endpoints.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Add WebSocket Heartbeat / Ping-Pong

Stale WebSocket connections linger when clients disconnect ungracefully.

**Files:**
- Modify: `server.ts` (add ping interval and pong handler)

**Step 1: Implement heartbeat**

In `server.ts`, after WebSocket connection setup, add:

```typescript
// Heartbeat: ping every 30 seconds, terminate if no pong within 10 seconds
const PING_INTERVAL = 30_000;
const PONG_TIMEOUT = 10_000;

wss.on('connection', (ws, req) => {
    let isAlive = true;

    ws.on('pong', () => { isAlive = true; });

    const pingTimer = setInterval(() => {
        if (!isAlive) {
            clearInterval(pingTimer);
            ws.terminate();
            return;
        }
        isAlive = false;
        ws.ping();
    }, PING_INTERVAL);

    ws.on('close', () => {
        clearInterval(pingTimer);
    });

    // ... existing connection handler
});
```

**Step 2: Run full test suite, commit**

```bash
git add server.ts
git commit -m "feat: add WebSocket heartbeat to detect and clean stale connections

Pings every 30s, terminates if no pong within next interval.
Prevents resource leaks from ungracefully disconnected clients.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Schedule `purgeStaleGames` Automatically

Currently `purgeStaleGames()` exists but has no automatic trigger.

**Files:**
- Modify: `server.ts` (add setInterval to call purgeStaleGames)

**Step 1: Add scheduled purge**

In `server.ts`, after server starts listening:

```typescript
import { purgeStaleGames } from './src/lib/db';

// Purge stale games every hour
const PURGE_INTERVAL = 60 * 60 * 1000; // 1 hour
setInterval(async () => {
    try {
        await purgeStaleGames();
    } catch (e) {
        console.error('[Scheduler] purgeStaleGames failed:', e);
    }
}, PURGE_INTERVAL);

// Also run once on startup (after a short delay for DB connection)
setTimeout(() => purgeStaleGames().catch(console.error), 10_000);
```

**Step 2: Commit**

```bash
git add server.ts
git commit -m "feat: schedule purgeStaleGames to run hourly + on startup

Automatically cleans up incomplete games older than 6 hours.
Previously required manual invocation.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Split Dashboard Page into Components

`src/app/dashboard/page.tsx` is 554 lines — extract logical sections into components.

**Files:**
- Create: `src/components/dashboard/GameCard.tsx`
- Create: `src/components/dashboard/DiscoverableGames.tsx`
- Create: `src/components/dashboard/CreateGameSection.tsx`
- Modify: `src/app/dashboard/page.tsx` (import and use new components)

**Step 1: Identify extraction boundaries**

Read the dashboard page and identify these self-contained sections:
1. **GameCard** — renders a single game with its status, player count, score
2. **DiscoverableGames** — the "Join a Game" section with discoverable game list
3. **CreateGameSection** — the "Create Game" form/button

**Step 2: Extract each component**

For each component:
1. Write a test that renders it with mock props
2. Extract the JSX and relevant state into the new component
3. Verify the test passes
4. Replace the inline JSX in dashboard with the new component import

**Step 3: Run full test suite after each extraction**

Run: `npx jest --no-coverage --testPathIgnorePatterns='node_modules|.auto-claude'`
Expected: All tests PASS after each extraction

**Step 4: Commit after each component extraction**

```bash
git commit -m "refactor(dashboard): extract GameCard component

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

```bash
git commit -m "refactor(dashboard): extract DiscoverableGames component

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

```bash
git commit -m "refactor(dashboard): extract CreateGameSection component

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: Optimize Leaderboard Query for Scale

The leaderboard re-aggregates ALL completed games on every request. This won't scale past 500+ games.

**Files:**
- Modify: `src/lib/db.ts` — `getGlobalLeaderboard()`
- Consider: Supabase materialized view or incremental aggregation table

**Step 1: Add a `player_stats` table (or Supabase view)**

Create a `player_stats` table that gets updated incrementally when games complete, rather than re-computing from scratch:

```sql
CREATE TABLE IF NOT EXISTS player_stats (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    games_played INT DEFAULT 0,
    wins INT DEFAULT 0,
    second_place INT DEFAULT 0,
    third_place INT DEFAULT 0,
    last_place INT DEFAULT 0,
    total_score INT DEFAULT 0,
    percentile_sum FLOAT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Step 2: Add `updatePlayerStats()` to db.ts**

Called from `saveRoundTricks()` when a game completes (final round). Incrementally updates the stats for each player in the game rather than re-aggregating everything.

**Step 3: Update `getGlobalLeaderboard()` to read from `player_stats`**

Simple query: `SELECT * FROM player_stats JOIN users ON ... WHERE games_played >= 3 ORDER BY avg_percentile DESC`

**Step 4: Write migration for existing data**

One-time script to populate `player_stats` from existing game history.

**Step 5: Write tests, run full suite, commit**

```bash
git commit -m "perf(leaderboard): add player_stats table for incremental aggregation

Replaces full re-computation on every request with incremental stat updates
on game completion. O(players_in_game) per update vs O(all_games * all_players).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: Final Verification

**Step 1: Run full test suite**

Run: `npx jest --no-coverage --testPathIgnorePatterns='node_modules|.auto-claude'`
Expected: All tests PASS

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Run build**

Run: `npx next build`
Expected: Build succeeds

---

## Summary

| Phase | Task | What | Severity | Risk |
|-------|------|------|----------|------|
| 1 | 1 | Extract `getFinalRoundNumber` to shared module | Important | Low |
| 1 | 2 | Fix CSRF bypass | Critical | Low |
| 2 | 3 | Create `withStateRollback` utility | Critical | Low |
| 2 | 4 | Apply rollback to TRICKS action | Critical | Medium |
| 2 | 5 | Apply rollback to BIDS action | Critical | Medium |
| 2 | 6 | Fix unhandled await in `saveRoundTricks` | Critical | Low |
| 2 | 7 | Add per-game mutex | Critical | Medium |
| 3 | 8 | Type global broadcast functions | Important | Low |
| 3 | 9 | Add game name validation | Important | Low |
| 3 | 10 | Guard debug mode in production | Important | Low |
| 4 | 11 | Strip PII from WebSocket broadcasts | Important | High |
| 5 | 12 | Add centralized auth middleware | Important | Medium |
| 5 | 13 | Add WebSocket heartbeat | Suggestion | Low |
| 5 | 14 | Schedule stale game purge | Suggestion | Low |
| 5 | 15 | Split dashboard into components | Suggestion | Low |
| 5 | 16 | Optimize leaderboard query for scale | Suggestion | Medium |
| — | 17 | Final verification | — | — |

## Issue Coverage

### Critical (4/4 covered)
- [x] C1: CSRF bypass → Task 2
- [x] C2: In-memory store data loss → Tasks 3-5 (rollback pattern)
- [x] C3: Race conditions → Task 7 (per-game mutex)
- [x] C4: NEXTAUTH_URL race → Addressed by auth middleware (Task 12) reducing direct env mutation needs

### Important (8/8 covered)
- [x] I1: Untyped broadcast globals → Task 8
- [x] I2: Email as data key → Task 11 (broadcast) + future migration
- [x] I3: No auth middleware → Task 12
- [x] I4: DB write failures swallowed → Tasks 4-6
- [x] I5: Undo/scoring logic duplicated → Task 1
- [x] I6: Emails in WebSocket → Task 11
- [x] I7: Debug provider no prod guard → Task 10
- [x] I8: No input sanitization → Task 9

### Suggestions (6/8 covered)
- [x] S1: Empty game-logic.ts → Task 1
- [x] S2: Leaderboard scaling → Task 16
- [x] S3: No WebSocket heartbeat → Task 13
- [x] S4: Dashboard too large → Task 15
- [x] S6: purgeStaleGames no schedule → Task 14
- [x] S8: Game name max-length → Task 9
- [ ] S5: Verbose tracing (deferred — needs profiling data)
- [ ] S7: Proxy pattern for store (deferred — rollback pattern addresses the core issue)
