/**
 * Test script to simulate a 4-player game flow
 * Run with: tsx test-game-flow.ts
 * 
 * Note: This requires actual Google OAuth tokens, so you'll need to:
 * 1. Sign in via browser to get session cookies
 * 2. Extract cookies/tokens for testing
 * 
 * For manual testing, follow the steps in TEST_PLAN.md
 */

import { getGame, setGame } from './src/lib/store';

// Simulated test data
const testGameId = 'test-game-123';
const testPlayers = [
    { id: 'user1', name: 'Player 1', email: 'player1@test.com', tricks: 0, bid: 0, score: 0 },
    { id: 'user2', name: 'Player 2', email: 'player2@test.com', tricks: 0, bid: 0, score: 0 },
    { id: 'user3', name: 'Player 3', email: 'player3@test.com', tricks: 0, bid: 0, score: 0 },
    { id: 'user4', name: 'Player 4', email: 'player4@test.com', tricks: 0, bid: 0, score: 0 },
];

console.log('=== ScoreJudge Game Flow Test ===\n');

// Test 1: Create game state
console.log('1. Creating initial game state...');
const initialGame = {
    id: testGameId,
    name: 'Test Game - 4 Players',
    players: [testPlayers[0]],
    rounds: [],
    currentRoundIndex: 0,
    ownerEmail: testPlayers[0].email,
    operatorEmail: testPlayers[0].email,
    lastUpdated: Date.now()
};
setGame(testGameId, initialGame);
console.log('✓ Game created with 1 player\n');

// Test 2: Simulate 3 more players joining
console.log('2. Simulating players joining...');
for (let i = 1; i < 4; i++) {
    const game = getGame(testGameId);
    if (game) {
        game.players.push({
            ...testPlayers[i],
            score: 0,
            bid: 0,
            tricks: 0
        });
        setGame(testGameId, game);
        console.log(`✓ ${testPlayers[i].name} joined (${game.players.length} players)`);
    }
}
console.log('');

// Test 3: Generate round plan for 4 players
console.log('3. Generating round plan for 4 players...');
function getRoundPlan(numPlayers: number): { cards: number, trump: string }[] {
    const maxCards = Math.floor(52 / numPlayers);
    const rounds: { cards: number, trump: string }[] = [];
    const TRUMPS = ['S', 'D', 'C', 'H', 'NT'];
    
    for (let i = 1; i <= maxCards; i++) rounds.push({ cards: i, trump: '' });
    for (let i = maxCards - 1; i >= 1; i--) rounds.push({ cards: i, trump: '' });
    
    return rounds.map((r, i) => ({ ...r, trump: TRUMPS[i % 5] }));
}

const game = getGame(testGameId);
if (game) {
    const plan = getRoundPlan(4);
    game.rounds = plan.map((p, i) => ({
        index: i + 1,
        cards: p.cards,
        trump: p.trump,
        state: 'BIDDING' as const,
        bids: {},
        tricks: {}
    }));
    game.currentRoundIndex = 1;
    setGame(testGameId, game);
    console.log(`✓ Generated ${plan.length} rounds`);
    console.log(`  First 5 rounds: ${plan.slice(0, 5).map(r => `${r.cards} cards (${r.trump})`).join(', ')}`);
    console.log(`  Trump cycle: ${plan.slice(0, 5).map(r => r.trump).join(' → ')} → ...\n`);
}

// Test 4: Simulate Round 1 bidding
console.log('4. Testing Round 1 bidding...');
const round1 = game?.rounds.find(r => r.index === 1);
let bids: Record<string, number> = {};
if (round1) {
    console.log(`  Cards per player: ${round1.cards}`);
    console.log(`  Trump: ${round1.trump}`);
    
    // Example bids that sum to cards per player (1)
    bids = { 
        [testPlayers[0].email]: 1,
        [testPlayers[1].email]: 0,
        [testPlayers[2].email]: 0,
        [testPlayers[3].email]: 0
    };
    const sumBids = Object.values(bids).reduce((a, b) => a + b, 0);
    console.log(`  Bids: ${Object.entries(bids).map(([email, bid]) => `${testPlayers.find(p => p.email === email)?.name}: ${bid}`).join(', ')}`);
    console.log(`  Sum: ${sumBids} (should equal ${round1.cards})`);
    
    if (sumBids === round1.cards) {
        console.log('  ✓ Bids are valid\n');
    } else {
        console.log('  ✗ Bids are invalid!\n');
    }
}

// Test 5: Simulate Round 1 scoring
console.log('5. Testing Round 1 scoring...');
if (round1 && game) {
    const tricks = {
        [testPlayers[0].email]: 1, // Made bid
        [testPlayers[1].email]: 0, // Made bid
        [testPlayers[2].email]: 0, // Made bid
        [testPlayers[3].email]: 0  // Made bid
    };
    
    const totalCards = round1.cards * game.players.length; // 1 * 4 = 4
    
    game.players.forEach(p => {
        const bid = bids[p.email];
        const trick = tricks[p.email];
        if (bid === trick) {
            p.score += (bid + totalCards);
            console.log(`  ${p.name}: Bid ${bid}, Tricks ${trick} → Made! Score: ${bid} + ${totalCards} = ${p.score}`);
        } else {
            console.log(`  ${p.name}: Bid ${bid}, Tricks ${trick} → Missed! Score: 0`);
        }
    });
    console.log('');
}

console.log('=== Test Complete ===');
console.log('\nFor full browser testing:');
console.log('1. Open http://localhost:3000 in browser');
console.log('2. Sign in with Google account 1');
console.log('3. Create a game');
console.log('4. Copy the game URL');
console.log('5. Open 3 more browser windows/tabs (or use incognito)');
console.log('6. Sign in with different Google accounts in each');
console.log('7. Navigate to the game URL in each window');
console.log('8. Click "Join Game" in each window');
console.log('9. Verify all 4 players appear in leaderboard');
console.log('10. Play rounds and verify WebSocket updates work');

