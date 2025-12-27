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
          update: jest.fn().mockResolvedValue({}),
          append: jest.fn().mockResolvedValue({}),
          clear: jest.fn().mockResolvedValue({}),
        },
      },
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

  describe('Response time - non-blocking behavior', () => {
    it('should not await Google Sheets API calls when starting game (START action)', async () => {
      const { google } = require('googleapis');
      const mockUpdate = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 5000)) // Simulate slow API
      );
      
      google.sheets.mockReturnValue({
        spreadsheets: {
          values: {
            update: mockUpdate,
            append: jest.fn().mockResolvedValue({}),
          },
        },
      });

      const { getGoogleFromToken } = require('@/lib/google');
      (getGoogleFromToken as jest.Mock).mockReturnValue({});

      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player One',
        email: 'player1@test.com',
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });

      const gameState = createGameState(3);
      setGame('game1', gameState);

      const startTime = Date.now();
      
      const req = new NextRequest('http://localhost:3000/api/games/game1/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'START' }),
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const responseTime = Date.now() - startTime;
      
      // Response should return in under 100ms even though Google APIs would take 5s
      // This proves the Google API calls are fire-and-forget (non-blocking)
      expect(responseTime).toBeLessThan(100);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.game.currentRoundIndex).toBe(1);
    });

    it('should not await Google Sheets API calls when submitting bids (BIDS action)', async () => {
      const { google } = require('googleapis');
      const mockUpdate = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 5000)) // Simulate slow API
      );
      
      google.sheets.mockReturnValue({
        spreadsheets: {
          values: {
            update: mockUpdate,
            append: jest.fn().mockResolvedValue({}),
          },
        },
      });

      const { getGoogleFromToken } = require('@/lib/google');
      (getGoogleFromToken as jest.Mock).mockReturnValue({});

      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player One',
        email: 'player1@test.com',
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });

      // Create game with rounds already initialized (as if START was called)
      const gameState = createGameState(3, {
        currentRoundIndex: 1,
        rounds: [
          { index: 1, cards: 17, trump: 'S', state: 'BIDDING', bids: {}, tricks: {} },
        ],
      });
      setGame('game1', gameState);

      const startTime = Date.now();
      
      // Bids that don't sum to 17 (to satisfy dealer constraint)
      const req = new NextRequest('http://localhost:3000/api/games/game1/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'BIDS',
          inputs: {
            'player1@test.com': 5,
            'player2@test.com': 5,
            'player3@test.com': 5, // Sum = 15, not 17
          },
        }),
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(100);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.game.rounds[0].state).toBe('PLAYING');
    });

    it('should not await Google Sheets API calls when submitting tricks (TRICKS action)', async () => {
      const { google } = require('googleapis');
      const mockUpdate = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 5000)) // Simulate slow API
      );
      const mockAppend = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 5000)) // Simulate slow API
      );
      
      google.sheets.mockReturnValue({
        spreadsheets: {
          values: {
            update: mockUpdate,
            append: mockAppend,
          },
        },
      });

      const { getGoogleFromToken } = require('@/lib/google');
      (getGoogleFromToken as jest.Mock).mockReturnValue({});

      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'player1',
        name: 'Player One',
        email: 'player1@test.com',
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });

      // Create game in PLAYING state
      const gameState = createGameState(3, {
        currentRoundIndex: 1,
        rounds: [
          {
            index: 1,
            cards: 17,
            trump: 'S',
            state: 'PLAYING',
            bids: {
              'player1@test.com': 5,
              'player2@test.com': 5,
              'player3@test.com': 5,
            },
            tricks: {},
          },
        ],
      });
      setGame('game1', gameState);

      const startTime = Date.now();
      
      const req = new NextRequest('http://localhost:3000/api/games/game1/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TRICKS',
          inputs: {
            'player1@test.com': 5, // Made bid
            'player2@test.com': -1, // Missed bid
            'player3@test.com': -1, // Missed bid
          },
        }),
      });

      const response = await POST(req, { params: Promise.resolve({ gameId: 'game1' }) });
      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(100);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.game.rounds[0].state).toBe('COMPLETED');
    });
  });

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
      expect(data.error).toContain('not loaded');
    });
  });
});

