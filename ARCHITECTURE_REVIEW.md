# ScoreJudge -- Architecture & Code Quality Review

**Date:** 2026-03-23
**Scope:** Full codebase review (not diff-based)
**Reviewer:** Claude Opus 4.6

---

## 1. System Overview

ScoreJudge is a real-time multiplayer card-game scoring tracker built with:

- **Next.js 14** (App Router) with a **custom `server.ts`** entry point
- **Supabase** (PostgreSQL) for persistence
- **In-memory `Map`** (`store.ts`) as a hot cache / primary working state
- **WebSocket** (via `ws` library, not Supabase Realtime) for live game updates
- **NextAuth** (Google OAuth + optional anonymous debug provider) for authentication
- **OpenTelemetry** tracing + **pino** structured logging

### Architecture Diagram (Logical)

```
Browser (Next.js client)
    |
    +-- REST API (Next.js Route Handlers)
    |       |
    |       +-- Auth check (getAuthToken / validateCSRF)
    |       +-- In-memory store (store.ts) -- read/write
    |       +-- Supabase DB (db.ts) -- persist
    |       +-- global.broadcastGameUpdate() --> WebSocket
    |
    +-- WebSocket (/ws)
            |
            +-- Auth check (JWT from cookie)
            +-- Read-only: sends GAME_UPDATE on broadcast
            +-- Discovery channel for lobby updates
```

### Game Flow (State Machine)

```
LOBBY (currentRoundIndex=0, rounds=[])
  |-- START action (>= 3 players) --> generates round plan
  v
ROUND N: BIDDING
  |-- BIDS action --> saves bids, transitions round to PLAYING
  v
ROUND N: PLAYING
  |-- TRICKS action --> validates tricks, scores, transitions to COMPLETED
  v
ROUND N: COMPLETED
  |-- If not final round: currentRoundIndex++, next round starts BIDDING
  |-- If final round: game is done
```

### Scoring Rule

```
If bid == tricks: points = bid + cards_in_round
If bid != tricks (missed): points = 0
Special: tricks == -1 means "missed" (did not make bid)
```

---

## 2. CRITICAL Issues

### C1. CSRF Bypass in Production

**File:** `src/lib/csrf.ts`

The CSRF validator returns `true` when both `Origin` and `Referer` headers are missing:

```typescript
if (!origin && !referer) {
    console.warn('CSRF: Missing Origin and Referer headers');
    return true; // <-- allows request through
}
```

Any HTTP client (curl, Postman, a malicious server-side script) can send state-mutating requests without CSRF headers and bypass the check entirely. This undermines the purpose of CSRF validation for all POST/PATCH/DELETE endpoints.

**Recommendation:** Reject requests with missing Origin/Referer in production. If API clients need access, use a separate API-key auth mechanism.

### C2. In-Memory Store as Source of Truth -- Data Loss on Restart

**Files:** `src/lib/store.ts`, `server.ts`, all API routes

The in-memory `Map` is the primary working state. All game mutations (bids, tricks, scoring) happen in memory first, then selectively persist to Supabase. On server restart or crash:

1. All active/in-progress games lose their current state
2. The `getGame` DB reconstruction does exist, but it only gets called when a game is not in the memory store (cache miss fallback)
3. During normal gameplay, memory and DB can diverge -- e.g., if a DB write fails silently (several places only `console.error` on DB failures without rolling back the in-memory state)

**Impact:** A server restart mid-game causes data loss for all active games. DB write failures create silent data divergence.

**Recommendation:** Treat the database as the source of truth. Write to DB first, then update memory. If DB write fails, fail the request. Add a startup routine to warm the cache from DB for active games.

### C3. Race Condition: No Concurrency Control on Game State

**Files:** `src/app/api/games/[gameId]/rounds/route.ts`, `src/lib/store.ts`

The rounds route follows this pattern:

```
1. Read game from memory
2. Validate action
3. Mutate game object in memory
4. Write to DB (async, no lock)
5. Broadcast via WebSocket
```

There is no locking, no optimistic concurrency (version column), and no transaction wrapping. If two requests hit concurrently (e.g., operator submits tricks while another request reads stale state), the in-memory object can be corrupted. Since JavaScript's async operations yield at `await` points, the read-modify-write cycle is not atomic.

**Recommendation:** Add an optimistic lock (version/`lastUpdated` check-and-set) or serialize writes per game using a per-game mutex.

### C4. NEXTAUTH_URL Override Creates Race Condition

**File:** `src/app/api/auth/[...nextauth]/route.ts`

The auth route mutates `process.env.NEXTAUTH_URL` per-request:

```typescript
process.env.NEXTAUTH_URL = detectedUrl;
try {
    return await NextAuth(authOptions)(req, context);
} finally {
    process.env.NEXTAUTH_URL = originalNextAuthUrl;
}
```

Under concurrent requests, Request A may set the env var, then Request B overwrites it before Request A's handler completes. This is a textbook TOCTOU race condition in a single-process Node.js server.

**Recommendation:** Use NextAuth's `NEXTAUTH_URL_INTERNAL` or pass the URL via request context rather than mutating a global.

---

## 3. IMPORTANT Issues

### I1. Global Broadcast Functions via `(global as any)`

**File:** `server.ts`, all API routes

`broadcastGameUpdate` and `broadcastDiscoveryUpdate` are attached to `global` as untyped `any`:

```typescript
(global as any).broadcastGameUpdate = (gameId, state) => { ... }
```

This pattern:
- Has zero type safety
- Fails silently if the function is not attached (all call sites check `if ((global as any).broadcastGameUpdate)`)
- Makes it invisible to the type system and impossible to test
- Breaks in multi-process deployments

**Recommendation:** Use a typed EventEmitter or a shared module that both `server.ts` and API routes import. For multi-instance, use Redis pub/sub.

### I2. Email Used as Player Key in Round Data

**Files:** `store.ts` (Round type), `rounds/route.ts`

Round bids and tricks are keyed by email:

```typescript
bids: Record<string, number>; // playerId -> bid (comment says playerId, but actually uses email)
tricks: Record<string, number>; // playerId -> tricks
```

The comment says `playerId` but the code uses `p.email` everywhere. If a user changes their email (possible with Google account updates), their in-game data breaks. Using email as a key also exposes PII in game state JSON sent over WebSocket to all players.

**Recommendation:** Use player UUID (`p.id`) as the key for bids/tricks/points. Update the comment to match reality or fix the key.

### I3. No Middleware for Route Protection

**File:** No `middleware.ts` exists

There is no Next.js middleware to protect routes. Every API route must manually call `getAuthToken()` and check for null. The dashboard and game pages are client-side rendered and check `useSession()`, but the underlying API routes are the actual security boundary.

This means:
- A single forgotten auth check in a new route = unauthenticated access
- No centralized rate limiting
- No centralized CORS enforcement

**Recommendation:** Add Next.js middleware to protect `/api/*` routes (except `/api/auth/*` and `/api/health`) and `/dashboard`, `/game/*` pages.

### I4. DB Write Failures Are Swallowed

**Files:** `src/app/api/games/[gameId]/rounds/route.ts`, `src/lib/db.ts`

Multiple DB functions return `false` on error but callers don't always check:

```typescript
// In rounds/route.ts -- initializeRounds return value not checked
await initializeRounds(gameId, rounds, game.players);
```

```typescript
// In db.ts -- saveRoundTricks logs error but calling code doesn't rollback memory
if (tricksError) {
    console.error('Error saving player tricks:', tricksError);
    return false;
}
```

**Impact:** The in-memory state advances (round completed, scores updated) but the database may not have the data. On server restart, the game reconstructs from DB and loses the round.

**Recommendation:** Check all DB return values. On failure, roll back the in-memory change and return an error to the client.

### I5. Undo Logic Duplicated Between Client and Server

**Files:** `src/app/game/[gameId]/page.tsx` (client), `src/app/api/games/[gameId]/rounds/route.ts` (server)

The undo/score-reversion logic exists in two places:
- Client-side: `handleUndo()` in the game page calculates score reversions
- Server-side: The `UNDO` action in the rounds route also calculates reversions

The scoring formula is reimplemented in both places. If one changes and the other doesn't, scores will be inconsistent.

**Recommendation:** The server should be the single source of truth for all scoring math. The client should just send the action and accept the server's response.

### I6. `getFinalRoundNumber` Duplicated in 4+ Files

**Files:** `src/app/api/games/route.ts`, `src/app/api/games/[gameId]/route.ts`, `src/app/api/games/[gameId]/rounds/route.ts`, `src/components/game/RoundControls.tsx`, `src/app/dashboard/page.tsx`

This function is copy-pasted across at least 5 files:

```typescript
function getFinalRoundNumber(numPlayers: number): number {
    if (!numPlayers) return 12;
    const maxCards = Math.floor(DECK_SIZE / numPlayers);
    return maxCards * 2 - 1;
}
```

**Recommendation:** Extract to a shared `src/lib/game-logic.ts` (the file already exists but is empty).

### I7. Player Email Exposure via WebSocket

**File:** `server.ts`

The full game state (including all player emails) is broadcast to all connected WebSocket clients:

```typescript
ws.send(JSON.stringify({ type: 'GAME_UPDATE', state }));
```

The discovery channel also broadcasts `ownerEmail` to all authenticated users. This leaks PII to every connected user.

**Recommendation:** Strip or hash emails before broadcasting. Send only names and IDs to non-owner clients.

### I8. Anonymous Debug Provider in Production Risk

**File:** `src/lib/auth.ts`

```typescript
if (DEBUG_MODE) {
    providers.push(CredentialsProvider({ ... }));
}
```

If `DEBUG_MODE` env var is accidentally set in production, anyone can authenticate as an anonymous user with fabricated email addresses. The generated email (`anonymous-{id}@debug.local`) could bypass email-based checks.

**Recommendation:** Add an explicit `process.env.NODE_ENV !== 'production'` guard in addition to the `DEBUG_MODE` check.

---

## 4. Suggestions

### S1. `game-logic.ts` Is Empty

The file exists but has no content. All game logic (scoring, round plans, trump assignment, validation) is scattered across API routes and components. This is the natural home for shared game logic.

### S2. Supabase Client Uses Proxy Pattern

**File:** `src/lib/supabase.ts`

Both `supabase` and `supabaseAdmin` use `Proxy` for lazy initialization. While this avoids build-time errors, it means errors surface at runtime (first use) rather than startup. The Proxy also breaks instanceof checks and makes debugging harder.

### S3. Dashboard Page Is Extremely Large (~450 lines)

**File:** `src/app/dashboard/page.tsx`

This single file handles: game listing, game creation, game deletion, game discovery, WebSocket discovery connection, profile settings, history toggle, and responsive layout. It should be decomposed into smaller components.

### S4. Verbose Tracing / Logging in Hot Paths

Every API call creates spans with 10+ attributes and multiple log lines. While valuable for debugging, this adds overhead to every game action. Consider reducing attribute count in production or sampling.

### S5. No Input Sanitization on Game Name

**File:** `src/app/api/games/route.ts`

```typescript
const { name } = body;
if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
```

No length limit, no character validation. A user could create a game named with 10MB of text, HTML/script tags, or Unicode exploits.

### S6. WebSocket Has No Heartbeat/Ping

**File:** `server.ts`

There is no ping/pong heartbeat mechanism. Stale connections from disconnected clients will accumulate in the `clients` Map and `discoveryClients` Set, consuming memory and causing failed broadcast attempts.

### S7. Leaderboard Fetches Up to 500 Games + All Players

**File:** `src/lib/db.ts` (`getGlobalLeaderboard`)

The leaderboard computation:
1. Fetches up to 500 games with their rounds
2. Filters to completed games client-side
3. Fetches all game_players for those games
4. Fetches all users
5. Computes stats in-memory

This is an N+1-ish pattern that will degrade as the dataset grows. Consider a materialized view or incremental stats table.

### S8. `purgeStaleGames` Only Runs on One Instance

**File:** `server.ts`

The hourly purge runs via `setInterval` in the Node process. In a multi-instance deployment, all instances would run it simultaneously. Use a distributed lock or a scheduled job (cron) instead.

---

## 5. What's Done Well

### W1. Clean Separation of Concerns

The codebase has a clear layered structure: `store.ts` (cache), `db.ts` (persistence), route handlers (orchestration), components (presentation). The split between API routes and the WebSocket server is well-defined.

### W2. Comprehensive Auth on WebSocket

The WebSocket connection validates JWT from cookies, checks both production and development cookie names, and verifies the user is a player in the requested game before sending state. This is more thorough than many WebSocket implementations.

### W3. Thoughtful Game Logic Validation

The `TRICKS` action handler has sophisticated validation: it checks that tricks sum correctly, validates that "missed" players' remaining tricks can be distributed without accidentally hitting their bids (`isDistributionPossible`), and handles zero-bidders specially. This shows deep domain understanding.

### W4. Soft Delete / Hide for Completed Games

The DELETE handler distinguishes between completed and incomplete games, uses soft delete (hide) for completed games to preserve leaderboard history, and allows non-owners to leave incomplete games. This is a thoughtful UX decision.

### W5. Structured Logging + Distributed Tracing

The pino + OpenTelemetry setup with trace context propagation, child loggers with game/user context, and span attributes on every API call is production-grade observability infrastructure.

### W6. Automatic Schema Migrations

The `db-admin.ts` migration runner applies SQL files on startup, tracks applied migrations, and handles the case where DATABASE_URL is not configured. This is a solid pattern for a small application.

### W7. CSRF Protection Exists (Even If Imperfect)

Origin-header CSRF validation is in place for all mutating endpoints. While the implementation has gaps (see C1), the pattern is correct and consistently applied.

### W8. Good Error Context in Logs

Error logs include game ID, user email, action type, and relevant state. The DELETE handler logs the full decision path (isOwner, isCompleted, deleteType). This makes debugging straightforward.

---

## Summary Table

| Severity | Count | Key Items |
|----------|-------|-----------|
| Critical | 4 | CSRF bypass, data loss on restart, race conditions, NEXTAUTH_URL race |
| Important | 8 | Global broadcast typing, email as key, no middleware, DB failures swallowed, undo duplication, code duplication, PII exposure, debug provider |
| Suggestions | 8 | Empty game-logic.ts, Proxy pattern, large pages, verbose tracing, no input sanitization, no WS heartbeat, leaderboard scaling, purge scheduling |
| Done Well | 8 | Clean separation, WS auth, game validation, soft delete, logging, migrations, CSRF pattern, error context |
