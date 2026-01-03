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
  addPlayer: jest.fn().mockResolvedValue(true),
  getUserByEmail: jest.fn().mockImplementation((email: string) => Promise.resolve({ id: 'user1', email, display_name: 'Test User' })),
  upsertUser: jest.fn().mockImplementation((u: any) => Promise.resolve({ id: u.id || 'user1', email: u.email, display_name: u.name })),
}));

describe('/api/games/[gameId]/join', () => {
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
    ...overrides,
  });

  const createGameState = (overrides?: Partial<GameState>): GameState => ({
    id: 'game1',
    name: 'Test Game',
    players: [createMockPlayer()],
    rounds: [],
    currentRoundIndex: 0,
    ownerEmail: 'player1@test.com',
    createdAt: Date.now(),
    lastUpdated: Date.now(),
    ...overrides,
  });

  describe('Join game functionality', () => {
    it('should add player to game when not already joined', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player2',
        name: 'Player Two',
        email: 'player2@test.com',
      });

      const gameState = createGameState();
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.game.players).toHaveLength(2);
      expect(data.game.players[1].email).toBe('player2@test.com');

      // Verify the game was updated in store
      const updatedGame = getGame('game1');
      expect(updatedGame?.players).toHaveLength(2);
    });

    it('should return already joined message if player already in game', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player One',
        email: 'player1@test.com',
      });

      const gameState = createGameState();
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Already joined');
      expect(data.game.players).toHaveLength(1);
    });

    it('should return 400 if game is full (12 players max)', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player13',
        name: 'Player Thirteen',
        email: 'player13@test.com',
      });

      const players: Player[] = Array.from({ length: 12 }, (_, i) =>
        createMockPlayer({
          id: `player${i + 1}`,
          name: `Player ${i + 1}`,
          email: `player${i + 1}@test.com`,
        })
      );
      const gameState = createGameState({ players });
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('full');
    });

    it('should return 401 if user is not authenticated', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue(null);

      const gameState = createGameState();
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });

    it('should return 403 if CSRF validation fails', async () => {
      (validateCSRF as jest.Mock).mockReturnValue(false);
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player2',
        name: 'Player Two',
        email: 'player2@test.com',
      });

      const gameState = createGameState();
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('CSRF validation failed');
    });

    it('should return 404 if game not found and is a temp ID', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player2',
        name: 'Player Two',
        email: 'player2@test.com',
      });

      const req = new NextRequest('http://localhost:3000/api/games/temp_123456/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'temp_123456' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('still being created');
    });
  });
});

