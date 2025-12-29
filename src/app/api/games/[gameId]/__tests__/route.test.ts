/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { DELETE } from '../route';
import { setGame, getGame, removeGame, type GameState, type Player } from '@/lib/store';
import { getAuthToken } from '@/lib/auth-utils';
import { validateCSRF } from '@/lib/csrf';

// Mock dependencies
jest.mock('@/lib/auth-utils', () => ({
  getAuthToken: jest.fn(),
}));

jest.mock('@/lib/csrf', () => ({
  validateCSRF: jest.fn(),
}));

// Mock Google APIs
jest.mock('@/lib/google', () => ({
  getGoogleFromToken: jest.fn(),
}));

jest.mock('googleapis', () => ({
  google: {
    drive: jest.fn(() => ({
      files: {
        delete: jest.fn().mockResolvedValue({}),
      },
    })),
  },
}));

// Mock game-logic to prevent actual Google Sheets calls
jest.mock('@/lib/game-logic', () => ({
  fetchGameFromSheet: jest.fn(),
}));

describe('/api/games/[gameId] DELETE', () => {
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
    
    // Mock broadcastDiscoveryUpdate
    (global as any).broadcastDiscoveryUpdate = jest.fn();
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
    players: [
      createMockPlayer(),
      createMockPlayer({ id: 'player2', name: 'Player Two', email: 'player2@test.com' }),
      createMockPlayer({ id: 'player3', name: 'Player Three', email: 'player3@test.com' }),
    ],
    rounds: [],
    currentRoundIndex: 0,
    ownerEmail: 'player1@test.com',
    createdAt: Date.now(),
    lastUpdated: Date.now(),
    ...overrides,
  });

  describe('Delete permissions by game state', () => {
    it('should allow owner to delete a game that has not started', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player One',
        email: 'player1@test.com',
      });

      const gameState = createGameState({ currentRoundIndex: 0, rounds: [] });
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1', {
        method: 'DELETE',
      });

      const response = await DELETE(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(getGame('game1')).toBeUndefined();
    });

    it('should allow owner to delete a COMPLETED game', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player One',
        email: 'player1@test.com',
      });

      // Create a completed game (all rounds completed)
      const gameState = createGameState({
        currentRoundIndex: 3,
        rounds: [
          { index: 1, cards: 2, trump: 'S', state: 'COMPLETED', bids: {}, tricks: {} },
          { index: 2, cards: 1, trump: 'D', state: 'COMPLETED', bids: {}, tricks: {} },
          { index: 3, cards: 2, trump: 'C', state: 'COMPLETED', bids: {}, tricks: {} },
        ],
      });
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1', {
        method: 'DELETE',
      });

      const response = await DELETE(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(getGame('game1')).toBeUndefined();
    });

    it('should allow owner to delete a PAUSED game (in progress but between rounds)', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player One',
        email: 'player1@test.com',
      });

      // Create a paused game (some rounds completed, current round in BIDDING)
      const gameState = createGameState({
        currentRoundIndex: 2,
        rounds: [
          { index: 1, cards: 2, trump: 'S', state: 'COMPLETED', bids: {}, tricks: {} },
          { index: 2, cards: 1, trump: 'D', state: 'BIDDING', bids: {}, tricks: {} },
        ],
      });
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1', {
        method: 'DELETE',
      });

      const response = await DELETE(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(getGame('game1')).toBeUndefined();
    });

    it('should allow owner to delete a game currently in PLAYING state', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player One',
        email: 'player1@test.com',
      });

      // Create a game with current round in PLAYING state
      const gameState = createGameState({
        currentRoundIndex: 1,
        rounds: [
          { index: 1, cards: 2, trump: 'S', state: 'PLAYING', bids: { 'player1@test.com': 1 }, tricks: {} },
        ],
      });
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1', {
        method: 'DELETE',
      });

      const response = await DELETE(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(getGame('game1')).toBeUndefined();
    });

    it('should NOT allow non-owner to delete a game', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player2',
        name: 'Player Two',
        email: 'player2@test.com', // Not the owner
      });

      const gameState = createGameState({ ownerEmail: 'player1@test.com' });
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1', {
        method: 'DELETE',
      });

      const response = await DELETE(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('owner');
      // Game should still exist
      expect(getGame('game1')).toBeDefined();
    });

    it('should return 401 if user is not authenticated', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue(null);

      const gameState = createGameState();
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1', {
        method: 'DELETE',
      });

      const response = await DELETE(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });

    it('should return 403 if CSRF validation fails', async () => {
      (validateCSRF as jest.Mock).mockReturnValue(false);
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player One',
        email: 'player1@test.com',
      });

      const gameState = createGameState();
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1', {
        method: 'DELETE',
      });

      const response = await DELETE(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('CSRF validation failed');
    });

    it('should broadcast discovery update when game is deleted', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player One',
        email: 'player1@test.com',
      });

      const gameState = createGameState();
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1', {
        method: 'DELETE',
      });

      await DELETE(req, { params: Promise.resolve({ gameId: 'game1' }) });

      expect((global as any).broadcastDiscoveryUpdate).toHaveBeenCalledWith(
        'GAME_DELETED',
        expect.objectContaining({ id: 'game1' })
      );
    });
  });
});

