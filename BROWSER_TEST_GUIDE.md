# Browser Testing Guide - 4 Player Game

## Prerequisites
- Server running on http://localhost:3000
- At least 2 Google accounts (you can use the same account in different browser profiles)

## Step-by-Step Testing

### Setup: Create Game (Player 1 - Owner)

1. **Open Browser Window 1**
   - Navigate to http://localhost:3000
   - Sign in with Google Account 1
   - Click "New Game"
   - Enter game name: "Test Game - 4 Players"
   - Click "Create Game"
   - You should be redirected to `/game/[gameId]`
   - **Copy the game URL** from the address bar

2. **Verify Game Created**
   - You should see:
     - Game name at the top
     - "Live" badge
     - Leaderboard showing 1 player (you)
     - Round Controls panel on the right
     - "Share" and "Copy Link" buttons

### Add Players 2, 3, and 4

#### Option A: Multiple Browser Windows (Same Account)
1. **Browser Window 2** (can use same Google account)
   - Open a new window/tab
   - Navigate to the game URL you copied
   - If not signed in, click "Sign In to Join"
   - After signing in, you should be redirected back to the game
   - Click "Join Game"
   - Verify you appear in the leaderboard

2. **Browser Window 3**
   - Repeat steps from Window 2
   - Click "Join Game"
   - Verify 3 players total

3. **Browser Window 4**
   - Repeat steps from Window 2
   - Click "Join Game"
   - Verify 4 players total

#### Option B: Incognito/Private Windows (Different Accounts)
- Use incognito/private windows to sign in with different Google accounts
- Each window can use a different account
- Follow the same join process

### Test Round Play

1. **Start Round 1** (in Window 1 - Operator)
   - In Round Controls, click "Start Round 1"
   - Verify:
     - Round plan is generated
     - Cards: 1, Trump: S (Spades)
     - Input fields appear for bids

2. **Enter Bids for Round 1**
   - Enter bids for all 4 players
   - **Important**: Sum must equal cards per player (1)
   - Example valid bids: 1, 0, 0, 0 (sums to 1)
   - Example invalid bids: 0, 27 (will show error)
   - Click "Save Bids"
   - Verify:
     - Inputs clear
     - State changes to "Tricks"
     - Other windows update automatically (WebSocket)

3. **Verify WebSocket Updates**
   - Check Browser Windows 2, 3, 4
   - They should update automatically showing:
     - Bids entered
     - State changed to "Tricks"
     - No page refresh needed

4. **Enter Tricks for Round 1**
   - In Window 1, enter tricks for all 4 players
   - Example: 1, 0, 0, 0 (matches bids)
   - Click "Save Tricks"
   - Verify:
     - Scores calculated correctly
     - Round 1 appears in history
     - Leaderboard updates
     - Round advances to Round 2

5. **Verify Scoring**
   - Player 1: Bid 1, Tricks 1 → Made! Score = 1 + 4 = 5
   - Players 2-4: Bid 0, Tricks 0 → Made! Score = 0 + 4 = 4
   - Check leaderboard shows correct totals

### Continue Testing

6. **Play Round 2**
   - Cards: 2, Trump: D (Diamonds)
   - Enter bids (must sum to 2)
   - Example: 1, 1, 0, 0
   - Enter tricks
   - Verify scores update

7. **Test Invalid Bids**
   - Try entering bids that don't sum correctly
   - Should see error: "Sum of bids (X) must equal cards per player (Y)"
   - Inputs should NOT clear on error

8. **Test Multiple Rounds**
   - Continue through rounds 3, 4, 5
   - Verify trump cycle: S → D → C → H → NT → S...
   - Verify scoring is consistent

### Verify Google Sheet

9. **Check Google Drive**
   - Go to your Google Drive
   - Find folder "scorejudge"
   - Open the game's spreadsheet
   - Verify:
     - Players tab has all 4 players
     - Rounds tab has round plan
     - Scores tab has round results

## Expected Results

- ✅ All 4 players can join
- ✅ WebSocket updates work across all windows
- ✅ Bids validation works (sum must equal cards)
- ✅ Scoring is correct
- ✅ Round history displays correctly
- ✅ Google Sheet is updated
- ✅ Trump cycle is correct

## Troubleshooting

- **Can't join**: Check if you're signed in, try refreshing
- **WebSocket not updating**: Check browser console for errors
- **Validation errors**: Make sure sum of bids equals cards per player
- **Scores wrong**: Check that bids match tricks for scoring

