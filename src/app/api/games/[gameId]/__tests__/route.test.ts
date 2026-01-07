/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { DELETE } from '../route';
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
  updateGame: jest.fn(),
  deleteGame: jest.fn(),
  getUserByEmail: jest.fn(),
  hideGameForUser: jest.fn(),
}));

describe('/api/games/[gameId] DELETE', () => {
  beforeEach(() => {
    // Clear the store before each test
    const globalForStore = globalThis as any;
    if (globalForStore.gameStore) {
      globalForStore.gameStore.clear();
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
    players: [createMockPlayer()],
    rounds: [],
    currentRoundIndex: 0,
    ownerEmail: 'player1@test.com',
    createdAt: Date.now(),
    lastUpdated: Date.now(),
    ...overrides,
  });

  it('should allow a user to hide a game from their view', async () => {
    (getAuthToken as jest.Mock).mockResolvedValue({
      id: 'player1',
      name: 'Player One',
      email: 'player1@test.com',
    });

    const { getUserByEmail, hideGameForUser } = require('@/lib/db');
    (getUserByEmail as jest.Mock).mockResolvedValue({ id: 'user1', email: 'player1@test.com' });
    (hideGameForUser as jest.Mock).mockResolvedValue(true);

    const gameState = createGameState();
    setGame('game1', gameState);

    const req = new NextRequest('http://localhost:3000/api/games/game1', {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: Promise.resolve({ gameId: 'game1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(hideGameForUser).toHaveBeenCalledWith('game1', 'user1');
  });

  it('should allow any player (not just owner) to hide a game', async () => {
    (getAuthToken as jest.Mock).mockResolvedValue({
      id: 'player2',
      name: 'Player Two',
      email: 'player2@test.com',
    });

    const { getUserByEmail, hideGameForUser } = require('@/lib/db');
    (getUserByEmail as jest.Mock).mockResolvedValue({ id: 'user2', email: 'player2@test.com' });
    (hideGameForUser as jest.Mock).mockResolvedValue(true);

    // Player 1 is owner, but Player 2 is calling DELETE
    const gameState = createGameState({ ownerEmail: 'player1@test.com' });
    setGame('game1', gameState);

    const req = new NextRequest('http://localhost:3000/api/games/game1', {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: Promise.resolve({ gameId: 'game1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(hideGameForUser).toHaveBeenCalledWith('game1', 'user2');
  });

  it('should return 401 if user is not authenticated', async () => {
    (getAuthToken as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/games/game1', {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: Promise.resolve({ gameId: 'game1' }) });

    expect(response.status).toBe(401);
  });

  it('should return 403 if CSRF validation fails', async () => {
    (validateCSRF as jest.Mock).mockReturnValue(false);

    const req = new NextRequest('http://localhost:3000/api/games/game1', {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: Promise.resolve({ gameId: 'game1' }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('CSRF validation failed');
  });
});
