/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { setGame, getGame, type GameState, type Player } from '@/lib/store';
import { getAuthToken } from '@/lib/auth-utils';
import { validateCSRF } from '@/lib/csrf';

// Mock dependencies
jest.mock('@/lib/auth-utils', () => ({
  getAuthToken: jest.fn(),
}));

jest.mock('@/lib/csrf', () => ({
  validateCSRF: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  getGame: jest.fn(),
  initializeRounds: jest.fn().mockResolvedValue(true),
  saveRoundBids: jest.fn().mockResolvedValue(true),
  saveRoundTricks: jest.fn().mockResolvedValue(true),
  saveGamePlayerScores: jest.fn().mockResolvedValue(true),
  updateGame: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ error: null }),
        })),
      })),
    })),
  },
}));

describe('/api/games/[gameId]/rounds', () => {
  beforeEach(() => {
    // Clear the store before each test
    const globalForStore = globalThis as any;
    if (globalForStore.gameStore) {
      globalForStore.gameStore.clear();
    }
    if (globalForStore.tempIdMap) {
      globalForStore.tempIdMap.clear();
    }
    jest.clearAllMocks();
    (validateCSRF as jest.Mock).mockReturnValue(true);
  });

  const createMockPlayer = (overrides?: Partial<Player>): Player => ({
    id: 'player1',
    name: 'Player One',
    email: 'player1@test.com',
    tricks: 0,
    bid: 0,
    score: 0,
    playerOrder: 0,
    ...overrides,
  });

  const createGameState = (numPlayers: number = 3, overrides?: Partial<GameState>): GameState => {
    const players: Player[] = Array.from({ length: numPlayers }, (_, i) =>
      createMockPlayer({
        id: `player${i + 1}`,
        name: `Player ${i + 1}`,
        email: `player${i + 1}@test.com`,
      })
    );

    return {
      id: 'game1',
      name: 'Test Game',
      players,
      rounds: [],
      currentRoundIndex: 0,
      ownerEmail: 'player1@test.com',
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      ...overrides,
    };
  };

  describe('Round functionality', () => {
    it('should initialize rounds and set currentRoundIndex to 1 on START', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player One',
        email: 'player1@test.com',
      });

      const gameState = createGameState(3);
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'START' }),
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.game.currentRoundIndex).toBe(1);
      expect(data.game.rounds.length).toBeGreaterThan(0);
    });

    it('should return 400 if game has less than 3 players', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player One',
        email: 'player1@test.com',
      });

      const gameState = createGameState(2); // Only 2 players
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'START' }),
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Minimum 3 players');
    });

    it('should return 401 if user is not authenticated', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue(null);

      const gameState = createGameState(3);
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'START' }),
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });

    it('should return 403 if user is not owner or operator', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player99',
        name: 'Random User',
        email: 'random@test.com',
      });

      const gameState = createGameState(3);
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'START' }),
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Forbidden');
    });

    it('should return 403 if CSRF validation fails', async () => {
      (validateCSRF as jest.Mock).mockReturnValue(false);
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player One',
        email: 'player1@test.com',
      });

      const gameState = createGameState(3);
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'START' }),
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('CSRF validation failed');
    });

    it('should return 404 if game not found', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player One',
        email: 'player1@test.com',
      });

      const req = new NextRequest('http://localhost:3000/api/games/nonexistent/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'START' }),
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Game not found');
    });
  });

  describe('Zero bids validation', () => {
    it('should reject all 3 players missed when only 1 card dealt and all bid 0', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player One',
        email: 'player1@test.com',
      });

      // Create game where all bid 0 and only 1 card dealt
      const gameState = createGameState(3, {
        currentRoundIndex: 1,
        rounds: [
          {
            index: 1,
            cards: 1, // Only 1 card dealt
            trump: 'S',
            state: 'PLAYING',
            bids: {
              'player1@test.com': 0,
              'player2@test.com': 0,
              'player3@test.com': 0,
            },
            tricks: {},
          },
        ],
      });
      setGame('game1', gameState);

      // Try to mark all 3 as missed (only max 1 can miss with 1 card)
      const req = new NextRequest('http://localhost:3000/api/games/game1/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TRICKS',
          inputs: {
            'player1@test.com': -1, // Missed
            'player2@test.com': -1, // Missed
            'player3@test.com': -1, // Missed - INVALID! Max 1 can miss
          },
        }),
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('at most 1 player(s) can miss');
    });

    it('should reject all 3 players missed when only 2 cards dealt and all bid 0', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player One',
        email: 'player1@test.com',
      });

      // Create game where all bid 0 and 2 cards dealt
      const gameState = createGameState(3, {
        currentRoundIndex: 1,
        rounds: [
          {
            index: 1,
            cards: 2, // 2 cards dealt
            trump: 'S',
            state: 'PLAYING',
            bids: {
              'player1@test.com': 0,
              'player2@test.com': 0,
              'player3@test.com': 0,
            },
            tricks: {},
          },
        ],
      });
      setGame('game1', gameState);

      // Try to mark all 3 as missed (only max 2 can miss with 2 cards)
      const req = new NextRequest('http://localhost:3000/api/games/game1/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TRICKS',
          inputs: {
            'player1@test.com': -1, // Missed
            'player2@test.com': -1, // Missed
            'player3@test.com': -1, // Missed - INVALID! Max 2 can miss
          },
        }),
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('at most 2 player(s) can miss');
    });

    it('should allow 2 players made and 1 missed when 1 card dealt and all bid 0', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player One',
        email: 'player1@test.com',
      });

      // Create game where all bid 0 and only 1 card dealt
      const gameState = createGameState(3, {
        currentRoundIndex: 1,
        rounds: [
          {
            index: 1,
            cards: 1, // Only 1 card dealt
            trump: 'S',
            state: 'PLAYING',
            bids: {
              'player1@test.com': 0,
              'player2@test.com': 0,
              'player3@test.com': 0,
            },
            tricks: {},
          },
        ],
      });
      setGame('game1', gameState);

      // 2 made, 1 missed - VALID
      const req = new NextRequest('http://localhost:3000/api/games/game1/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TRICKS',
          inputs: {
            'player1@test.com': 0, // Made
            'player2@test.com': 0, // Made
            'player3@test.com': -1, // Missed (took the 1 trick)
          },
        }),
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.game.rounds[0].state).toBe('COMPLETED');
    });

    it('should allow 1 player made and 2 missed when 2 cards dealt and all bid 0', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player One',
        email: 'player1@test.com',
      });

      // Create game where all bid 0 and 2 cards dealt
      const gameState = createGameState(3, {
        currentRoundIndex: 1,
        rounds: [
          {
            index: 1,
            cards: 2, // 2 cards dealt
            trump: 'S',
            state: 'PLAYING',
            bids: {
              'player1@test.com': 0,
              'player2@test.com': 0,
              'player3@test.com': 0,
            },
            tricks: {},
          },
        ],
      });
      setGame('game1', gameState);

      // 1 made, 2 missed - VALID
      const req = new NextRequest('http://localhost:3000/api/games/game1/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TRICKS',
          inputs: {
            'player1@test.com': 0, // Made
            'player2@test.com': -1, // Missed
            'player3@test.com': -1, // Missed
          },
        }),
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.game.rounds[0].state).toBe('COMPLETED');
    });

    it('should reject trick submission if a player score is missing', async () => {
      const gameState = createGameState(3);
      gameState.rounds = [
        {
          index: 1,
          cards: 5,
          trump: 'S',
          state: 'PLAYING',
          bids: {
            'player1@test.com': 2,
            'player2@test.com': 1,
            'player3@test.com': 2,
          },
          tricks: {},
        }
      ];
      gameState.currentRoundIndex = 1;
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TRICKS',
          inputs: {
            'player1@test.com': 2,
            'player2@test.com': 1,
            // player3 is missing
          },
        }),
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing tricks for Player 3');
    });

    it('should reject impossible trick distribution in 1-card round', async () => {
      const gameState = createGameState(3);
      gameState.rounds = [
        {
          index: 1,
          cards: 1, // EXACTLY 1 card total
          trump: 'S',
          state: 'PLAYING',
          bids: {
            'player1@test.com': 0,
            'player2@test.com': 1,
            'player3@test.com': 1,
          },
          tricks: {},
        }
      ];
      gameState.currentRoundIndex = 1;
      setGame('game1', gameState);

      // p1 made 0 (correct)
      // p2 missed 1 (taken 0 or >1, but only 1 available)
      // p3 missed 1 (taken 0 or >1, but only 1 available)
      // SUM of tricks must be 1. 
      // Combo (0, 0, 1) -> p3 hit bid 1. 
      // Combo (0, 1, 0) -> p2 hit bid 1.
      // So impossible.
      const req = new NextRequest('http://localhost:3000/api/games/game1/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TRICKS',
          inputs: {
            'player1@test.com': 0, // Made
            'player2@test.com': -1, // Missed
            'player3@test.com': -1, // Missed
          },
        }),
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid distribution');
    });
  });

  describe('REWIND action', () => {
    const setupAuthAsOwner = () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player One',
        email: 'player1@test.com',
      });
    };

    const createGameWithCompletedRounds = (numCompletedRounds: number) => {
      const rounds = [];
      for (let i = 1; i <= numCompletedRounds + 1; i++) {
        const isCompleted = i <= numCompletedRounds;
        rounds.push({
          index: i,
          cards: 3,
          trump: ['S', 'D', 'C'][i % 3],
          state: isCompleted ? 'COMPLETED' as const : 'BIDDING' as const,
          bids: isCompleted ? {
            'player1@test.com': 1,
            'player2@test.com': 1,
            'player3@test.com': 0,
          } : {},
          tricks: isCompleted ? {
            'player1@test.com': 1,
            'player2@test.com': 1,
            'player3@test.com': -1, // Missed — took remaining trick(s)
          } : {},
        });
      }

      // Scores: 3 cards, bid 1 got 1 → points = 1+3 = 4
      // p1 & p2 made every round, p3 missed (bid 0, marked -1)
      const gameState = createGameState(3, {
        currentRoundIndex: numCompletedRounds + 1,
        rounds,
        players: [
          createMockPlayer({ id: 'player1', email: 'player1@test.com', name: 'Player 1', score: numCompletedRounds * 4, playerOrder: 0 }),
          createMockPlayer({ id: 'player2', email: 'player2@test.com', name: 'Player 2', score: numCompletedRounds * 4, playerOrder: 1 }),
          createMockPlayer({ id: 'player3', email: 'player3@test.com', name: 'Player 3', score: 0, playerOrder: 2 }),
        ],
      });

      setGame('game1', gameState);
      return gameState;
    };

    it('should rewind a completed round to PLAYING state', async () => {
      setupAuthAsOwner();
      createGameWithCompletedRounds(3);

      const req = new NextRequest('http://localhost:3000/api/games/game1/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REWIND', targetRoundIndex: 2 }),
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Target round should be PLAYING with bids preserved and tricks cleared
      const rewoundRound = data.game.rounds.find((r: any) => r.index === 2);
      expect(rewoundRound.state).toBe('PLAYING');
      expect(rewoundRound.bids).toEqual({
        'player1@test.com': 1,
        'player2@test.com': 1,
        'player3@test.com': 0,
      });
      expect(rewoundRound.tricks).toEqual({});

      // currentRoundIndex should be set to the target
      expect(data.game.currentRoundIndex).toBe(2);
    });

    it('should recalculate all scores correctly after rewind', async () => {
      setupAuthAsOwner();
      createGameWithCompletedRounds(3);

      const req = new NextRequest('http://localhost:3000/api/games/game1/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REWIND', targetRoundIndex: 2 }),
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      // After rewinding round 2, only round 1 is COMPLETED
      // Round 1: player1 bid 1 got 1 → 4 pts, player2 bid 1 got 1 → 4 pts, player3 bid 0 got 1 → 0 pts
      // Round 2 is now PLAYING (not counted), Round 3 still COMPLETED but shouldn't count
      // because recalculate only counts COMPLETED rounds and round 2 is now PLAYING
      // Actually round 3 is still COMPLETED so its score counts
      // Score = round1 (4) + round3 (4) = 8 for player1 and player2
      const p1 = data.game.players.find((p: any) => p.email === 'player1@test.com');
      const p2 = data.game.players.find((p: any) => p.email === 'player2@test.com');
      const p3 = data.game.players.find((p: any) => p.email === 'player3@test.com');

      // Rounds 1 and 3 are still COMPLETED, round 2 is PLAYING
      expect(p1.score).toBe(8); // 4 + 4
      expect(p2.score).toBe(8); // 4 + 4
      expect(p3.score).toBe(0); // 0 + 0
    });

    it('should reject REWIND for non-COMPLETED round', async () => {
      setupAuthAsOwner();
      createGameWithCompletedRounds(3);

      // Try to rewind round 4 which is BIDDING (not completed)
      const req = new NextRequest('http://localhost:3000/api/games/game1/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REWIND', targetRoundIndex: 4 }),
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('can only rewind COMPLETED rounds');
    });

    it('should reject REWIND without targetRoundIndex', async () => {
      setupAuthAsOwner();
      createGameWithCompletedRounds(3);

      const req = new NextRequest('http://localhost:3000/api/games/game1/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REWIND' }),
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('targetRoundIndex is required');
    });

    it('should auto-advance through subsequent completed rounds after fixing tricks', async () => {
      setupAuthAsOwner();
      createGameWithCompletedRounds(3);

      // First rewind to round 2
      const rewindReq = new NextRequest('http://localhost:3000/api/games/game1/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REWIND', targetRoundIndex: 2 }),
      });

      await POST(rewindReq, { params: Promise.resolve({ gameId: 'game1' }) });

      // Now submit corrected tricks for round 2
      // Valid distribution: p1 bid 1 got 1, p2 bid 1 got 1, p3 bid 0 missed (got some tricks)
      const tricksReq = new NextRequest('http://localhost:3000/api/games/game1/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TRICKS',
          inputs: {
            'player1@test.com': 1,
            'player2@test.com': 1,
            'player3@test.com': -1, // Missed — took remaining 1 trick
          },
        }),
      });

      const response = await POST(tricksReq, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);

      // Round 2 should now be COMPLETED again
      const round2 = data.game.rounds.find((r: any) => r.index === 2);
      expect(round2.state).toBe('COMPLETED');

      // Auto-advance should have detected round 3 has bids+tricks and re-scored it
      // With DECK_SIZE=6 and 3 players, finalRound=3, so game is now complete
      // currentRoundIndex stays at 3 (the last round)
      expect(data.game.currentRoundIndex).toBe(3);

      // All scores recalculated: 3 rounds × 4 pts each for p1 and p2
      const p1 = data.game.players.find((p: any) => p.email === 'player1@test.com');
      expect(p1.score).toBe(12); // 3 × 4
    });
  });
});

