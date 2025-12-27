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

// Mock Google APIs - must be non-blocking
jest.mock('@/lib/google', () => ({
  getGoogleFromToken: jest.fn(),
}));

jest.mock('googleapis', () => ({
  google: {
    sheets: jest.fn(() => ({
      spreadsheets: {
        values: {
          append: jest.fn().mockResolvedValue({}),
        },
      },
    })),
    drive: jest.fn(() => ({
      permissions: {
        create: jest.fn().mockResolvedValue({}),
      },
    })),
  },
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

  describe('Response time - non-blocking behavior', () => {
    it('should return immediately when game is in memory (no Google API calls needed for game fetch)', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player2',
        name: 'Player Two',
        email: 'player2@test.com',
      });

      const gameState = createGameState();
      setGame('game1', gameState);

      const startTime = Date.now();
      
      const req = new NextRequest('http://localhost:3000/api/games/game1/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const responseTime = Date.now() - startTime;
      
      // Should complete in under 100ms when game is in memory
      // (no blocking Google API calls)
      expect(responseTime).toBeLessThan(100);
      expect(response.status).toBe(200);
    });

    it('should not await Google Sheets API calls when adding player to sheet', async () => {
      const { google } = require('googleapis');
      const mockAppend = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 5000)) // Simulate slow API
      );
      const mockPermissionsCreate = jest.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 5000)) // Simulate slow API
      );
      
      google.sheets.mockReturnValue({
        spreadsheets: {
          values: {
            append: mockAppend,
          },
        },
      });
      google.drive.mockReturnValue({
        permissions: {
          create: mockPermissionsCreate,
        },
      });

      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player2',
        name: 'Player Two',
        email: 'player2@test.com',
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });

      const { getGoogleFromToken } = require('@/lib/google');
      (getGoogleFromToken as jest.Mock).mockReturnValue({});

      const gameState = createGameState();
      setGame('game1', gameState);

      const startTime = Date.now();
      
      const req = new NextRequest('http://localhost:3000/api/games/game1/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const responseTime = Date.now() - startTime;
      
      // Response should return in under 100ms even though Google APIs would take 5s
      // This proves the Google API calls are fire-and-forget (non-blocking)
      expect(responseTime).toBeLessThan(100);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
    });
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

