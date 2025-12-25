# Full Game Test Plan

## Test Flow: 4-Player Game

### Step 1: Sign In
1. Navigate to http://localhost:3000
2. Click "Sign in with Google"
3. Complete Google OAuth flow
4. Should redirect to `/dashboard`

### Step 2: Create Game
1. Click "New Game" button
2. Enter game name: "Test Game - 4 Players"
3. Click "Create Game"
4. Should create Google Sheet and redirect to `/game/[gameId]`
5. Verify you see the game page with:
   - Game name displayed
   - "Live" badge
   - Leaderboard showing 1 player (you)
   - Round Controls panel on the right

### Step 3: Add 3 More Players (Simulate)
Since we can't easily simulate multiple Google accounts, we'll test by:
1. Opening the game URL in 3 different browser windows/tabs (or incognito)
2. Each tab should sign in with Google (can use same account for testing)
3. Each tab clicks "Join Game"
4. Verify all 4 players appear in the leaderboard

**Alternative**: Test joining via API calls if browser testing is limited.

### Step 4: Start First Round
1. In the Round Controls panel, click "Start Round 1"
2. Verify:
   - Round plan is generated
   - Current round shows: Cards: 1, Trump: S (Spades)
   - Input fields appear for bids

### Step 5: Enter Bids for Round 1
1. Enter bids for all 4 players (e.g., 1, 0, 0, 0)
2. Click "Save Bids"
3. Verify:
   - State changes to "Tricks" input
   - Bids are displayed (read-only)
   - Input fields for tricks appear

### Step 6: Enter Tricks for Round 1
1. Enter tricks for all 4 players (must match bids for scoring)
   - Example: Player 1 bid 1, tricks 1 (made bid)
   - Players 2-4 bid 0, tricks 0 (made bid)
2. Click "Save Tricks"
3. Verify:
   - Scores are calculated correctly
   - Round 1 shows as completed in history
   - Leaderboard updates with new totals
   - Current round advances to Round 2

### Step 7: Play Multiple Rounds
1. Continue playing rounds 2-5:
   - Round 2: Cards 2, Trump D (Diamonds)
   - Round 3: Cards 3, Trump C (Clubs)
   - Round 4: Cards 4, Trump H (Hearts)
   - Round 5: Cards 5, Trump NT (No Trump)
2. Verify trump cycle is correct: S → D → C → H → NT → S...
3. Verify scoring:
   - Made bid: points = bid + totalCardsDealt
   - Missed bid: points = 0

### Step 8: Verify WebSocket Updates
1. Open game in 2 browser windows
2. In one window, enter bids/tricks
3. Verify the other window updates automatically without refresh
4. Check browser console for WebSocket messages

### Step 9: Verify Google Sheet
1. Check your Google Drive for folder "scorejudge"
2. Open the game's Google Sheet
3. Verify tabs exist: Game, Players, Rounds, Scores
4. Verify data is being written:
   - Players tab has all 4 players
   - Rounds tab has round plan
   - Scores tab has round results

### Step 10: Test Round History
1. Scroll to "Round History" section
2. Verify completed rounds show:
   - Round number
   - Cards and Trump
   - Each player's bid/tricks
   - Pass/Fail status

## Expected Scoring Example (4 Players, Round 1)
- Cards per player: 1
- Total cards dealt: 4
- If Player 1 bids 1 and takes 1 trick: Score = 1 + 4 = 5
- If Player 2 bids 0 and takes 0 tricks: Score = 0 + 4 = 4
- If Player 3 bids 1 but takes 0 tricks: Score = 0 (missed bid)

## Issues to Watch For
- [ ] Game creation fails
- [ ] Players can't join
- [ ] Round plan not generated correctly
- [ ] Trump cycle incorrect
- [ ] Scoring calculation wrong
- [ ] WebSocket updates not working
- [ ] Google Sheet not created/updated
- [ ] Round history not displaying

