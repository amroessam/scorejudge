## PRD: Judgement Live Scorekeeper (Next.js + Google Login + WebSockets + Google Sheets)

### 1) Overview

A Next.js (TypeScript) web app for the Judgement card game where **all players sign in with Google**, join a game, and see **instant live updates in the app**. The **first player to create the game** becomes the **Game Owner**. The app automatically creates a Google Drive folder named **`judgement`** in the owner’s Drive, creates a **Google Sheet** for the game inside it, and shares that sheet with all joined players as **view-only**.

The app is the live UI; the sheet is the persisted audit log + record.

---

## 2) Rules (as implemented)

### Trump rotation (corrected)

Round trump type cycles as:

* `trumpCycle = [S, D, C, H, NT]` and repeats back to Spades.

So: **Spades → Diamonds → Clubs → Hearts → No Trump → Spades → …**

### Scoring

For each round, per player:

* If `tricksTaken == bid`:
  **points = bid + totalCardsDealtThisRound**
* Else: **0**

Where:

* `totalCardsDealtThisRound = cardsPerPlayerThisRound * numPlayers`

### Round plan

* `maxCardsPerPlayer = floor(52 / numPlayers)`
* Cards-per-player sequence:

  * `1..maxCardsPerPlayer` then `maxCardsPerPlayer-1..1`
* Total rounds:

  * `totalRounds = 2 * maxCardsPerPlayer - 1`

---

## 3) Goals / Non-goals

### Goals

* Google login required for everyone.
* Any player can create a game; creator becomes owner.
* Live updates are instant in-app (WebSockets).
* Game sheet created in owner Drive, in `judgement/`, shared view-only to joined players.
* Fast operator workflow to input bids + tricks taken after each round.
* Resume a game reliably after refresh or reconnect.

### Non-goals

* Trick-by-trick tracking.
* Player-entered bids from their own devices (v1: operator enters all).
* Status tracking (explicitly not needed).

---

## 4) Roles & permissions

### Roles

* **Owner**: created the game; owns the Drive folder/sheet; can invite players by email; can transfer operator role.
* **Operator**: can enter/update round results (default: owner; transferable).
* **Viewer**: sees live updates only.

### Permissions

* All users must be authenticated (Google).
* Only `operator` (and optionally owner) can write round updates.
* Everyone who joined the game can read the live game state.
* The Google Sheet is shared as **Viewer** with joined players (by email).

---

## 5) User journeys

### A) Sign in

1. Open app → Sign in with Google.
2. After sign-in: “Create game” or “Join game”.

### B) Create game (first player)

1. Create game → enter game name.
2. Add invited player emails (optional now; can invite later).
3. Create:

   * Game created on server.
   * Server creates Drive folder `judgement` (if missing) in owner’s Drive.
   * Server creates game Google Sheet in that folder.
   * Server shares sheet view-only to invited emails.
4. Owner lands on live game screen (as operator).

### C) Join game

1. Player signs in with Google.
2. Enters game code or opens invite link.
3. Server adds them to the game roster.
4. Server shares the sheet view-only to the player email (if not already shared).
5. Player sees live game view instantly.

### D) Run rounds (operator)

For each round:

1. Enter each player’s bid.
2. Enter each player’s tricks taken.
3. Save round:

   * Server validates.
   * Server calculates points + totals.
   * Server broadcasts update to all players via WebSockets.
   * Server appends round rows to Google Sheet.

### E) Transfer operator

Owner/operator selects another joined player → server updates operator → broadcast.

### F) Finish

Final leaderboard shown; game remains accessible in “My games”.

---

## 6) Functional requirements

### Core

* Create/join games
* Live scoreboard (WebSockets)
* Operator input: bids + tricks taken per round
* Automatic scoring + totals
* Round plan generation
* Operator transfer

### Validation

* All bids and tricksTaken must be integers ≥ 0.
* Optional hard validation: `sum(tricksTaken) == cardsPerPlayerThisRound` (recommended ON).
* Prevent saving incomplete round.

### Google Sheets / Drive

* Create/find Drive folder `judgement` in owner Drive
* Create a spreadsheet per game in that folder
* Share spreadsheet as `role=reader` to all joined player emails
* Append round results on every round save

### Game persistence / resume

* Game state is stored server-side (not only in memory) so reconnect/refresh works.
* Players who joined can reopen and see latest state instantly.

---

## 7) Data model (server)

### Entities

**User**

* id
* email
* name
* googleSub (provider id)

**Game**

* id (short code + UUID internally)
* name
* ownerUserId
* operatorUserId
* createdAt
* sheetFileId
* driveFolderId
* numPlayers (derived from roster)
* maxCardsPerPlayer
* totalRounds
* currentRoundIndex

**GamePlayer**

* gameId
* userId
* email
* displayName
* joinedAt

**Round**

* gameId
* roundIndex
* cardsPerPlayer
* totalCardsDealt
* trumpType (S/D/C/H/NT)
* bids (per player)
* tricksTaken (per player)
* pointsAwarded (per player)
* totalsAfterRound (per player)
* createdAt

---

## 8) Google Sheet structure (single sheet per game)

Tabs:

* `Game` (metadata: owner, config, sheet created time)
* `Players` (name/email)
* `Rounds` (round plan: index, cardsPerPlayer, trumpType)
* `Scores` (append-only log: roundIndex, playerEmail, bid, tricksTaken, madeBid, points, totalCardsDealt)
* `Leaderboard` (can be formulas or written by server)

---

# Tech details (single stack, no alternatives)

## 1) Stack

* **Next.js (TypeScript)** (App Router)
* **NextAuth.js** (Google provider) for authentication
* **PostgreSQL** (persist games/rounds/players)
* **Prisma** (ORM for Postgres, typed models)
* **WebSockets** using a Next.js custom server (Node) + `ws` (or Socket.IO) to broadcast updates

> WebSockets need a long-lived Node process. This means you run Next.js in **Node runtime** (not edge/serverless-only).

---

## 2) Why a backend is required (for this spec)

* “Instant updates” implies a push channel (WebSockets) → requires a server.
* Creating/sharing Drive files “as the owner” requires server-side access to the owner’s OAuth tokens (refresh token) to reliably call Drive/Sheets APIs during gameplay.

---

## 3) Google OAuth scopes and token handling

### Authentication (login)

* NextAuth Google provider for identity.

### Drive/Sheets access (owner operations)

Request scopes on Google provider:

* `https://www.googleapis.com/auth/drive.file`
* `https://www.googleapis.com/auth/spreadsheets`

Token requirements:

* Configure Google OAuth to return a **refresh token**:

  * `access_type=offline`
  * `prompt=consent` (at least first time)
* Store refresh token encrypted in DB for the owner (server-side only).
* Server uses refresh token to mint access tokens when calling Drive/Sheets.

Security:

* Never store Google access tokens in localStorage.
* Never expose refresh token to the client.

---

## 4) WebSocket design

### Connection

* Client connects to `wss://<host>/ws?gameId=<id>`
* Authentication:

  * On connect, client sends a signed session token (from NextAuth session) or cookie-based auth checked by server.
  * Server validates session → checks membership in game.

### Channels

* One room per gameId.
* Broadcast events:

  * `GAME_STATE` (full snapshot on join)
  * `ROUND_SAVED` (delta + updated totals)
  * `OPERATOR_CHANGED`
  * `PLAYER_JOINED`

### Consistency model

* Server is authoritative.
* Client submits commands via HTTPS API routes; server writes DB; server broadcasts result via WS.
* On reconnect: client requests latest snapshot.

---

## 5) Next.js server/runtime setup

Because WebSockets require a persistent server:

* Run Next.js with a **custom Node server** (e.g., `server.ts`) that:

  * boots Next.js
  * attaches a WebSocket server (`ws`) on the same HTTP server
* Deploy on infrastructure that supports long-lived connections (a standard VM/container).

---

## 6) API routes (Next.js)

All routes require authenticated session.

### Game lifecycle

* `POST /api/games`

  * body: `{ name, invitedEmails[] }`
  * creates game in DB
  * creates Drive folder + Sheet (server-side)
  * writes initial tabs + round plan
  * shares sheet to invitedEmails (viewer)
  * returns `{ gameId, joinCode }`

* `POST /api/games/:gameId/join`

  * adds player to DB
  * shares sheet with player email (viewer)
  * broadcasts `PLAYER_JOINED`

* `POST /api/games/:gameId/operator`

  * body: `{ operatorUserId }`
  * updates operator in DB
  * broadcasts `OPERATOR_CHANGED`

### Round updates

* `POST /api/games/:gameId/rounds/:roundIndex`

  * body: `{ bidsByEmail, tricksTakenByEmail }`
  * validates operator permission
  * validates inputs
  * computes points + totals
  * persists Round rows
  * appends to Google Sheet (`Scores` tab)
  * broadcasts `ROUND_SAVED`

### State fetch

* `GET /api/games/:gameId`

  * returns snapshot (used for initial render and fallback)

---

## 7) Computation details (server)

For round `i`:

* `cardsPerPlayer = roundPlan[i]`
* `totalCardsDealt = cardsPerPlayer * playerCount`
* `trumpType = trumpCycle[(i-1) % 5]`

Per player:

* `madeBid = (tricksTaken == bid)`
* `points = madeBid ? (bid + totalCardsDealt) : 0`
* `total = previousTotal + points`

---

## 8) UI pages (Next.js)

* `/` sign-in / landing
* `/create` create game wizard
* `/join` enter code
* `/game/[gameId]` live game view

  * shows roster, operator badge
  * current round inputs (operator only)
  * live leaderboard
  * per-round history accordion

---

## 9) Deployment requirements

* Must run as a **Node server** (not edge-only) to support WebSockets.
* One Postgres database.
* Environment variables:

  * `DATABASE_URL`
  * `NEXTAUTH_URL`
  * `NEXTAUTH_SECRET`
  * `GOOGLE_CLIENT_ID`
  * `GOOGLE_CLIENT_SECRET`

---

## 10) Acceptance criteria (MVP)

* Trump cycle is exactly `[S, D, C, H, NT]` repeating.
* Missed bid always yields 0.
* Anyone can create a game after Google login.
* All players must login to join; they see live updates instantly in-app.
* Owner creates sheet in `judgement/` folder; all joined players are shared as view-only.
* Operator can run rounds end-to-end; all clients stay in sync.
* Refresh/reconnect resumes current state correctly.

If you want, I can produce the concrete Prisma schema + the `server.ts` WebSocket bootstrap + the exact Google Drive/Sheets calls (TypeScript) in the same structure you’d drop into a Next.js repo.
