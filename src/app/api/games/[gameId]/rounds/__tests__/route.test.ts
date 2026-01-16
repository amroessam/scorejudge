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
  initializeRounds: jest.fn(),
  saveRoundBids: jest.fn(),
  saveRoundTricks: jest.fn(),
  updateGame: jest.fn(),
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
});

