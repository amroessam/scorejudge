/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { PATCH } from '../route';
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
  updateUser: jest.fn().mockResolvedValue({ id: 'user1', email: 'player@test.com' }),
  getUserByEmail: jest.fn().mockResolvedValue({ id: 'user1', email: 'player@test.com' }),
}));

describe('/api/games/[gameId]/players', () => {
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

  describe('PATCH - Name changes', () => {
    const createMockPlayer = (): Player => ({
      id: 'player1',
      name: 'Original Name',
      email: 'player@test.com',
      tricks: 0,
      bid: 0,
      score: 0,
    });

    const createGameState = (currentRoundIndex: number): GameState => ({
      id: 'game1',
      name: 'Test Game',
      players: [createMockPlayer()],
      rounds: [],
      currentRoundIndex,
      ownerEmail: 'owner@test.com',
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    });

    it('should allow name change when game has not started (currentRoundIndex === 0)', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player',
        email: 'player@test.com',
      });

      const gameState = createGameState(0);
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1/players', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });

      const response = await PATCH(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.game.players[0].name).toBe('New Name');

      // Verify the game was updated in store
      const updatedGame = getGame('game1');
      expect(updatedGame?.players[0].name).toBe('New Name');
    });

    it('should block name change when game has started (currentRoundIndex > 0)', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player',
        email: 'player@test.com',
      });

      const gameState = createGameState(1);
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1/players', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });

      const response = await PATCH(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('cannot be changed');

      // Verify the game was NOT updated in store
      const unchangedGame = getGame('game1');
      expect(unchangedGame?.players[0].name).toBe('Original Name');
    });

    it('should block name change when game is in round 2 (currentRoundIndex === 2)', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player',
        email: 'player@test.com',
      });

      const gameState = createGameState(2);
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1/players', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });

      const response = await PATCH(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('cannot be changed');
    });

    it('should return 401 if user is not authenticated', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue(null);

      const gameState = createGameState(0);
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1/players', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });

      const response = await PATCH(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 if CSRF validation fails', async () => {
      (validateCSRF as jest.Mock).mockReturnValue(false);
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player',
        email: 'player@test.com',
      });

      const gameState = createGameState(0);
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1/players', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });

      const response = await PATCH(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('CSRF validation failed');
    });

    it('should return 404 if game not found', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player',
        email: 'player@test.com',
      });

      const req = new NextRequest('http://localhost:3000/api/games/nonexistent/players', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });

      const response = await PATCH(req, { params: Promise.resolve({ gameId: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Game not found');
    });

    it('should return 404 if player not found in game', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player2',
        name: 'Other Player',
        email: 'other@test.com',
      });

      const gameState = createGameState(0);
      setGame('game1', gameState);

      const req = new NextRequest('http://localhost:3000/api/games/game1/players', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });

      const response = await PATCH(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Player not found in game');
    });
  });
});

