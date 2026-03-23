# Architecture Fixes Code Review

**Reviewer:** Senior Code Reviewer (Claude Opus 4.6)
**Date:** 2026-03-23
**Scope:** e137b45..d19d66e (20 commits, 45 files, +1237/-312)
**Test Suite:** 37 suites, 227 tests -- ALL PASSING

---

## Dimension Ratings

| Dimension         | Rating | Notes |
|-------------------|--------|-------|
| Architecture      | 8/10   | Strong patterns; in-memory store remains the structural risk |
| Code Quality      | 8/10   | Clean, DRY, well-documented; a few edge cases below |
| Security          | 8/10   | All known vulns fixed; one residual PII concern |
| Performance       | 8/10   | No bottlenecks; mutex is appropriate for single-instance |
| Testing           | 8/10   | Good coverage of new code; UNDO path untested for rollback |
| Game Logic        | 9/10   | Thorough validation, distribution checker is excellent |
| Error Handling    | 7/10   | Rollback pattern is solid; two actions lack it |

**Overall: 8/10** -- A very strong improvement. The issues below are all "should fix" or "nice to have"; nothing is broken.

---

## What Was Done Well

1. **Rollback pattern (`withStateRollback`)** is elegantly designed. The `structuredClone` fallback for jsdom is a nice touch. The `false`-as-failure convention avoids exception-driven control flow. Both BIDS and TRICKS are properly wrapped.

2. **Game lock (`withGameLock`)** is a textbook promise-chain mutex -- minimal code, correct cleanup in `finally`, proper per-game isolation. The cleanup check (`locks.get(gameId) === next`) prevents deleting a lock that a newer caller already replaced.

3. **CSRF fix** correctly rejects requests missing both Origin and Referer in production. Referer-as-fallback is a pragmatic choice for older clients. The test suite covers the key cases.

4. **`getFinalRoundNumber` extraction** achieved full DRY -- all 9 former duplicates now import from one source. The function is pure, well-tested, and handles the edge case of 0 players.

5. **Commit discipline** is exemplary -- 20 small, atomic commits with clear conventional-commit messages. Each commit has a focused scope and the test suite passes at every step.

6. **Dashboard decomposition** into GameCard, DiscoverableGameCard, and DiscoverGamesSection is clean. Each component has its own test file.

7. **sanitizeGameForBroadcast** is non-mutating (spread + destructure), type-safe with the `Omit` return type, and tested for immutability.

---

## Issues Found

### IMPORTANT: UNDO and START Actions Not Wrapped in `withStateRollback`

**File:** `/Users/mansoor/scorejudge/src/app/api/games/[gameId]/rounds/route.ts` lines 381-456

The UNDO action mutates player scores (subtracting points) and round state, then writes to Supabase -- but is NOT wrapped in `withStateRollback`. If the `saveGamePlayerScores` or Supabase `.update()` call fails, the in-memory state will be corrupted (scores reduced but DB unchanged). On restart, the old scores would reload.

Similarly, the START action calls `initializeRounds` (line 141) without checking its return value. If that DB write fails, rounds are assigned in memory but not persisted.

**Recommendation:** Wrap UNDO in `withStateRollback`. Check `initializeRounds` return value in START.

### IMPORTANT: `sanitizeGameForBroadcast` Still Leaks `ownerEmail` and `operatorEmail`

**File:** `/Users/mansoor/scorejudge/src/lib/sanitize-broadcast.ts`

The comment says "Keeps ownerEmail/operatorEmail at the top level for client auth checks." This is a deliberate design trade-off, but it means every WebSocket subscriber can see the game owner's email address. The original architecture review (I7) flagged bulk PII exposure. The player-level email strip is good, but the top-level emails are still broadcasted.

**Recommendation:** Replace `ownerEmail`/`operatorEmail` with player IDs in the broadcast and resolve ownership on the client side using the session-loaded player list (the plan described this as deferred -- it should be tracked).

### IMPORTANT: `broadcastDiscoveryUpdate` Sends Unsanitized Game State

**File:** `/Users/mansoor/scorejudge/server.ts` (the `broadcastDiscoveryUpdate` function)

The `broadcastGameUpdate` function correctly calls `sanitizeGameForBroadcast`. However, `broadcastDiscoveryUpdate` passes the raw `GameState` directly -- including all player emails. Every user on the discovery channel receives all players' emails for every game created/updated.

**Recommendation:** Apply `sanitizeGameForBroadcast` to `broadcastDiscoveryUpdate` payloads as well.

### SUGGESTION: NEXTAUTH_URL Race Condition Still Present

**File:** `/Users/mansoor/scorejudge/src/app/api/auth/[...nextauth]/route.ts` (not in diff)

The plan noted C4 (NEXTAUTH_URL TOCTOU race) as "Addressed by auth middleware." However, the middleware was subsequently removed (commit 35568a8) due to Next.js 16 deprecation. The underlying `process.env.NEXTAUTH_URL = detectedUrl` per-request mutation remains unfixed. This is low risk in practice (single-threaded event loop, auth routes are fast) but remains a correctness concern.

**Recommendation:** Accept the risk for now, or pass the URL via NextAuth's configuration object instead of mutating process.env.

### SUGGESTION: Game Lock Map Memory Leak Potential

**File:** `/Users/mansoor/scorejudge/src/lib/game-lock.ts`

The cleanup condition `if (locks.get(gameId) === next)` correctly avoids premature deletion when queued operations exist. However, if a game is accessed once and never again, the entry is properly deleted. No actual leak -- the implementation is correct. Noting this for completeness: in a multi-instance deployment, this lock provides no cross-instance serialization. The in-memory store architecture inherently limits this to single-instance.

### SUGGESTION: `global.d.ts` Uses `any` for Discovery Update Game Parameter

**File:** `/Users/mansoor/scorejudge/src/types/global.d.ts` line 9

```typescript
var broadcastDiscoveryUpdate: ((updateType: DiscoveryUpdateType, game: any) => void) | undefined;
```

The `game: any` weakens the type safety improvement. Should be `game: GameState` or a specific `DiscoveryPayload` type.

### SUGGESTION: Validation Could Be More Defensive

**File:** `/Users/mansoor/scorejudge/src/lib/validation.ts`

The HTML strip regex `/<[^>]*>/g` handles simple tags but does not handle edge cases like `<img src=x onerror=alert(1)>` where the tag content itself is dangerous. Since the stripped content goes into a database field and is rendered in React (which auto-escapes JSX), the XSS risk is minimal. The stripping is defense-in-depth, which is good.

---

## Summary

The architecture fixes implementation is thorough and well-executed. All 4 critical issues from the original review are addressed (CSRF bypass, data integrity rollback, race condition mutex, debug mode guard). All 8 important issues are covered. The code is clean, well-tested, and follows consistent patterns.

The two items that would push this to 9/10 or 10/10:
1. Wrap the UNDO action in `withStateRollback` (same pattern already applied to BIDS and TRICKS)
2. Sanitize the discovery broadcast channel (same function already exists, just not applied there)

Both are small, low-risk changes that complete the patterns already established.
