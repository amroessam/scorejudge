/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { setGame, removeGame, type GameState } from '@/lib/store';
import { getAuthToken } from '@/lib/auth-utils';

// Mock dependencies
jest.mock('@/lib/auth-utils', () => ({
  getAuthToken: jest.fn(),
}));

describe('/api/games/discover', () => {
  beforeEach(() => {
    // Clear the store before each test
    const globalForStore = globalThis as any;
    if (globalForStore.gameStore) {
      globalForStore.gameStore.clear();
    }
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return 401 if user is not authenticated', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/games/discover');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return empty array when no games exist', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'user1',
        name: 'Test User',
        email: 'user@test.com',
      });

      const req = new NextRequest('http://localhost:3000/api/games/discover');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });

    it('should return only games that have not started (currentRoundIndex === 0)', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'user1',
        name: 'Test User',
        email: 'user@test.com',
      });

      const notStartedGame: GameState = {
        id: 'game1',
        name: 'Not Started Game',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner1@test.com',
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      };

      const startedGame: GameState = {
        id: 'game2',
        name: 'Started Game',
        players: [],
        rounds: [],
        currentRoundIndex: 1,
        ownerEmail: 'owner2@test.com',
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      };

      setGame('game1', notStartedGame);
      setGame('game2', startedGame);

      const req = new NextRequest('http://localhost:3000/api/games/discover');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('game1');
      expect(data[0].name).toBe('Not Started Game');
    });

    it('should filter out games the user has already joined', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'user1',
        name: 'Test User',
        email: 'user@test.com',
      });

      const gameUserJoined: GameState = {
        id: 'game1',
        name: 'Joined Game',
        players: [
          {
            id: 'user1',
            name: 'Test User',
            email: 'user@test.com',
            tricks: 0,
            bid: 0,
            score: 0,
          },
        ],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner1@test.com',
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      };

      const gameUserNotJoined: GameState = {
        id: 'game2',
        name: 'Not Joined Game',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner2@test.com',
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      };

      setGame('game1', gameUserJoined);
      setGame('game2', gameUserNotJoined);

      const req = new NextRequest('http://localhost:3000/api/games/discover');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('game2');
    });

    it('should return games owned by the user if they have not started', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'user1',
        name: 'Test User',
        email: 'owner@test.com',
      });

      const ownedGame: GameState = {
        id: 'game1',
        name: 'Owned Game',
        players: [
          {
            id: 'user1',
            name: 'Test User',
            email: 'owner@test.com',
            tricks: 0,
            bid: 0,
            score: 0,
          },
        ],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner@test.com',
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      };

      setGame('game1', ownedGame);

      const req = new NextRequest('http://localhost:3000/api/games/discover');
      const response = await GET(req);
      const data = await response.json();

      // Owned games should be filtered out since user has already joined
      expect(response.status).toBe(200);
      expect(data).toHaveLength(0);
    });

    it('should return minimal game info: id, name, ownerEmail, playerCount', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'user1',
        name: 'Test User',
        email: 'user@test.com',
      });

      const game: GameState = {
        id: 'game1',
        name: 'Test Game',
        players: [
          {
            id: 'p1',
            name: 'Player 1',
            email: 'p1@test.com',
            tricks: 0,
            bid: 0,
            score: 0,
          },
          {
            id: 'p2',
            name: 'Player 2',
            email: 'p2@test.com',
            tricks: 0,
            bid: 0,
            score: 0,
          },
        ],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner@test.com',
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      };

      setGame('game1', game);

      const req = new NextRequest('http://localhost:3000/api/games/discover');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0]).toHaveProperty('id', 'game1');
      expect(data[0]).toHaveProperty('name', 'Test Game');
      expect(data[0]).toHaveProperty('ownerEmail', 'owner@test.com');
      expect(data[0]).toHaveProperty('playerCount', 2);
      // Should not include full game state
      expect(data[0]).not.toHaveProperty('players');
      expect(data[0]).not.toHaveProperty('rounds');
    });

    it('should filter out full games (12 players)', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'user1',
        name: 'Test User',
        email: 'user@test.com',
      });

      const fullGame: GameState = {
        id: 'game1',
        name: 'Full Game',
        players: Array.from({ length: 12 }, (_, i) => ({
          id: `p${i}`,
          name: `Player ${i}`,
          email: `p${i}@test.com`,
          tricks: 0,
          bid: 0,
          score: 0,
        })),
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner@test.com',
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      };

      const availableGame: GameState = {
        id: 'game2',
        name: 'Available Game',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner2@test.com',
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      };

      setGame('game1', fullGame);
      setGame('game2', availableGame);

      const req = new NextRequest('http://localhost:3000/api/games/discover');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('game2');
    });

    it('should deduplicate games stored with both temp ID and real sheet ID', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'user1',
        name: 'Test User',
        email: 'user@test.com',
      });

      const realSheetId = 'real_sheet_id_123';
      const tempId = 'temp_1234567890';

      // Game stored with temp ID key, but has real sheet ID as game.id
      const gameWithTempKey: GameState = {
        id: realSheetId, // Real sheet ID
        name: 'Test Game',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner@test.com',
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      };

      // Same game stored with real sheet ID key
      const gameWithRealKey: GameState = {
        id: realSheetId, // Same real sheet ID
        name: 'Test Game',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner@test.com',
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      };

      // Store the same game with both keys (simulating the duplicate scenario)
      setGame(tempId, gameWithTempKey);
      setGame(realSheetId, gameWithRealKey);

      const req = new NextRequest('http://localhost:3000/api/games/discover');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should only return one game, not two duplicates
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe(realSheetId);
      expect(data[0].name).toBe('Test Game');
    });

    it('should sort games by created date descending (newest first)', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'user1',
        name: 'Test User',
        email: 'user@test.com',
      });

      const now = Date.now();
      const game1: GameState = {
        id: 'game1',
        name: 'Oldest Game',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner1@test.com',
        createdAt: now - 10000, // 10 seconds ago
        lastUpdated: now - 10000,
      };

      const game2: GameState = {
        id: 'game2',
        name: 'Newest Game',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner2@test.com',
        createdAt: now, // Most recent
        lastUpdated: now,
      };

      const game3: GameState = {
        id: 'game3',
        name: 'Middle Game',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner3@test.com',
        createdAt: now - 5000, // 5 seconds ago
        lastUpdated: now - 5000,
      };

      setGame('game1', game1);
      setGame('game2', game2);
      setGame('game3', game3);

      const req = new NextRequest('http://localhost:3000/api/games/discover');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(3);
      // Should be sorted by createdAt descending (newest first)
      expect(data[0].id).toBe('game2'); // Newest
      expect(data[0].name).toBe('Newest Game');
      expect(data[1].id).toBe('game3'); // Middle
      expect(data[1].name).toBe('Middle Game');
      expect(data[2].id).toBe('game1'); // Oldest
      expect(data[2].name).toBe('Oldest Game');
    });

    it('should include createdAt in response', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'user1',
        name: 'Test User',
        email: 'user@test.com',
      });

      const now = Date.now();
      const game: GameState = {
        id: 'game1',
        name: 'Test Game',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner@test.com',
        createdAt: now,
        lastUpdated: now,
      };

      setGame('game1', game);

      const req = new NextRequest('http://localhost:3000/api/games/discover');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0]).toHaveProperty('createdAt');
      expect(data[0].createdAt).toBe(now);
    });

    it('should fallback to lastUpdated if createdAt is missing (backwards compatibility)', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({
        id: 'user1',
        name: 'Test User',
        email: 'user@test.com',
      });

      const now = Date.now();
      // Game without createdAt (old format)
      const game: GameState = {
        id: 'game1',
        name: 'Test Game',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner@test.com',
        createdAt: now,
        lastUpdated: now,
      } as GameState;

      setGame('game1', game);

      const req = new NextRequest('http://localhost:3000/api/games/discover');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0]).toHaveProperty('createdAt');
      expect(data[0].createdAt).toBe(now); // Should use lastUpdated as fallback
    });
  });
});

