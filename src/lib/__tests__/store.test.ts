import {
  getGame,
  setGame,
  updateGame,
  removeGame,
  mapTempIdToSheetId,
  getSheetIdFromTempId,
  getAllGames,
  type GameState,
} from '@/lib/store';

describe('store', () => {
  // Clear the store before each test
  beforeEach(() => {
    // Access the global store and clear it
    const globalForStore = globalThis as any;
    if (globalForStore.gameStore) {
      globalForStore.gameStore.clear();
    }
    if (globalForStore.tempIdMap) {
      globalForStore.tempIdMap.clear();
    }
  });

  describe('setGame and getGame', () => {
    it('should store and retrieve a game', () => {
      const gameState: GameState = {
        id: 'game1',
        name: 'Test Game',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner@test.com',
        lastUpdated: Date.now(),
      };

      const result = setGame('game1', gameState);
      expect(result.id).toBe('game1');
      expect(result.lastUpdated).toBeDefined();

      const retrieved = getGame('game1');
      expect(retrieved).toEqual(result);
      expect(retrieved?.name).toBe('Test Game');
    });

    it('should return undefined for non-existent game', () => {
      const retrieved = getGame('nonexistent');
      expect(retrieved).toBeUndefined();
    });

    it('should overwrite existing game with same id', () => {
      const gameState1: GameState = {
        id: 'game1',
        name: 'Game 1',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner@test.com',
        lastUpdated: Date.now(),
      };

      const gameState2: GameState = {
        id: 'game1',
        name: 'Game 1 Updated',
        players: [],
        rounds: [],
        currentRoundIndex: 1,
        ownerEmail: 'owner@test.com',
        lastUpdated: Date.now(),
      };

      setGame('game1', gameState1);
      setGame('game1', gameState2);

      const retrieved = getGame('game1');
      expect(retrieved?.name).toBe('Game 1 Updated');
      expect(retrieved?.currentRoundIndex).toBe(1);
    });

    it('should store multiple games independently', () => {
      const game1: GameState = {
        id: 'game1',
        name: 'Game 1',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner1@test.com',
        lastUpdated: Date.now(),
      };

      const game2: GameState = {
        id: 'game2',
        name: 'Game 2',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner2@test.com',
        lastUpdated: Date.now(),
      };

      setGame('game1', game1);
      setGame('game2', game2);

      expect(getGame('game1')?.name).toBe('Game 1');
      expect(getGame('game2')?.name).toBe('Game 2');
    });

    it('should update lastUpdated timestamp', () => {
      const initialTime = Date.now() - 1000;
      const gameState: GameState = {
        id: 'game1',
        name: 'Test Game',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner@test.com',
        lastUpdated: initialTime,
      };

      const result = setGame('game1', gameState);
      expect(result.lastUpdated).toBeGreaterThan(initialTime);
    });
  });

  describe('updateGame', () => {
    it('should partially update an existing game', () => {
      const gameState: GameState = {
        id: 'game1',
        name: 'Test Game',
        players: [
          { id: '1', name: 'Player 1', email: 'p1@test.com', tricks: 0, bid: 0, score: 0 },
        ],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner@test.com',
        lastUpdated: Date.now(),
      };

      setGame('game1', gameState);

      const updated = updateGame('game1', {
        currentRoundIndex: 5,
        name: 'Updated Game',
      });

      expect(updated).not.toBeNull();
      expect(updated?.currentRoundIndex).toBe(5);
      expect(updated?.name).toBe('Updated Game');
      expect(updated?.players).toHaveLength(1); // Other fields unchanged
      expect(updated?.ownerEmail).toBe('owner@test.com');
    });

    it('should return null for non-existent game', () => {
      const result = updateGame('nonexistent', { currentRoundIndex: 1 });
      expect(result).toBeNull();
    });

    it('should update lastUpdated timestamp', () => {
      const gameState: GameState = {
        id: 'game1',
        name: 'Test Game',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner@test.com',
        lastUpdated: Date.now() - 1000,
      };

      setGame('game1', gameState);
      const initialTime = getGame('game1')?.lastUpdated || 0;

      // Wait a tiny bit to ensure timestamp changes
      const updated = updateGame('game1', { currentRoundIndex: 1 });

      expect(updated?.lastUpdated).toBeGreaterThanOrEqual(initialTime);
    });

    it('should allow updating players array', () => {
      const gameState: GameState = {
        id: 'game1',
        name: 'Test Game',
        players: [
          { id: '1', name: 'Player 1', email: 'p1@test.com', tricks: 0, bid: 0, score: 0 },
        ],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner@test.com',
        lastUpdated: Date.now(),
      };

      setGame('game1', gameState);

      const newPlayers = [
        { id: '1', name: 'Player 1', email: 'p1@test.com', tricks: 0, bid: 0, score: 10 },
        { id: '2', name: 'Player 2', email: 'p2@test.com', tricks: 0, bid: 0, score: 5 },
      ];

      const updated = updateGame('game1', { players: newPlayers });

      expect(updated?.players).toHaveLength(2);
      expect(updated?.players[0].score).toBe(10);
      expect(updated?.players[1].name).toBe('Player 2');
    });
  });

  describe('removeGame', () => {
    it('should remove a game from the store', () => {
      const gameState: GameState = {
        id: 'game1',
        name: 'Test Game',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner@test.com',
        lastUpdated: Date.now(),
      };

      setGame('game1', gameState);
      expect(getGame('game1')).toBeDefined();

      removeGame('game1');
      expect(getGame('game1')).toBeUndefined();
    });

    it('should not throw when removing non-existent game', () => {
      expect(() => removeGame('nonexistent')).not.toThrow();
    });

    it('should remove only the specified game', () => {
      const game1: GameState = {
        id: 'game1',
        name: 'Game 1',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner1@test.com',
        lastUpdated: Date.now(),
      };

      const game2: GameState = {
        id: 'game2',
        name: 'Game 2',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner2@test.com',
        lastUpdated: Date.now(),
      };

      setGame('game1', game1);
      setGame('game2', game2);

      removeGame('game1');

      expect(getGame('game1')).toBeUndefined();
      expect(getGame('game2')).toBeDefined();
    });
  });

  describe('tempId mapping', () => {
    it('should map temp ID to sheet ID', () => {
      mapTempIdToSheetId('temp_123', 'sheet_abc');

      const sheetId = getSheetIdFromTempId('temp_123');
      expect(sheetId).toBe('sheet_abc');
    });

    it('should return undefined for unmapped temp ID', () => {
      const sheetId = getSheetIdFromTempId('temp_unknown');
      expect(sheetId).toBeUndefined();
    });

    it('should allow overwriting temp ID mapping', () => {
      mapTempIdToSheetId('temp_123', 'sheet_abc');
      mapTempIdToSheetId('temp_123', 'sheet_xyz');

      const sheetId = getSheetIdFromTempId('temp_123');
      expect(sheetId).toBe('sheet_xyz');
    });

    it('should store multiple temp ID mappings independently', () => {
      mapTempIdToSheetId('temp_1', 'sheet_a');
      mapTempIdToSheetId('temp_2', 'sheet_b');
      mapTempIdToSheetId('temp_3', 'sheet_c');

      expect(getSheetIdFromTempId('temp_1')).toBe('sheet_a');
      expect(getSheetIdFromTempId('temp_2')).toBe('sheet_b');
      expect(getSheetIdFromTempId('temp_3')).toBe('sheet_c');
    });
  });

  describe('data persistence across calls', () => {
    it('should maintain game state across multiple operations', () => {
      const gameState: GameState = {
        id: 'game1',
        name: 'Test Game',
        players: [
          { id: '1', name: 'Player 1', email: 'p1@test.com', tricks: 0, bid: 0, score: 0 },
        ],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner@test.com',
        lastUpdated: Date.now(),
      };

      // Set game
      setGame('game1', gameState);

      // Update game
      updateGame('game1', { currentRoundIndex: 1 });

      // Get game multiple times
      const retrieved1 = getGame('game1');
      const retrieved2 = getGame('game1');

      expect(retrieved1).toEqual(retrieved2);
      expect(retrieved1?.currentRoundIndex).toBe(1);
    });
  });

  describe('optional fields', () => {
    it('should handle operatorEmail field', () => {
      const gameState: GameState = {
        id: 'game1',
        name: 'Test Game',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner@test.com',
        operatorEmail: 'operator@test.com',
        lastUpdated: Date.now(),
      };

      setGame('game1', gameState);
      const retrieved = getGame('game1');

      expect(retrieved?.operatorEmail).toBe('operator@test.com');
    });

    it('should handle firstDealerEmail field', () => {
      const gameState: GameState = {
        id: 'game1',
        name: 'Test Game',
        players: [
          { id: '1', name: 'Player 1', email: 'p1@test.com', tricks: 0, bid: 0, score: 0 },
          { id: '2', name: 'Player 2', email: 'p2@test.com', tricks: 0, bid: 0, score: 0 },
        ],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner@test.com',
        firstDealerEmail: 'p2@test.com',
        lastUpdated: Date.now(),
      };

      setGame('game1', gameState);
      const retrieved = getGame('game1');

      expect(retrieved?.firstDealerEmail).toBe('p2@test.com');
    });
  });

  describe('getAllGames', () => {
    it('should return empty array when no games exist', () => {
      const allGames = getAllGames();
      expect(allGames).toEqual([]);
    });

    it('should return all games in the store', () => {
      const game1: GameState = {
        id: 'game1',
        name: 'Game 1',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner1@test.com',
        lastUpdated: Date.now(),
      };

      const game2: GameState = {
        id: 'game2',
        name: 'Game 2',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner2@test.com',
        lastUpdated: Date.now(),
      };

      setGame('game1', game1);
      setGame('game2', game2);

      const allGames = getAllGames();
      expect(allGames).toHaveLength(2);
      expect(allGames.map(g => g.id)).toContain('game1');
      expect(allGames.map(g => g.id)).toContain('game2');
    });

    it('should return games with different states', () => {
      const game1: GameState = {
        id: 'game1',
        name: 'Not Started',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner1@test.com',
        lastUpdated: Date.now(),
      };

      const game2: GameState = {
        id: 'game2',
        name: 'In Progress',
        players: [],
        rounds: [],
        currentRoundIndex: 5,
        ownerEmail: 'owner2@test.com',
        lastUpdated: Date.now(),
      };

      setGame('game1', game1);
      setGame('game2', game2);

      const allGames = getAllGames();
      expect(allGames).toHaveLength(2);
      expect(allGames.find(g => g.id === 'game1')?.currentRoundIndex).toBe(0);
      expect(allGames.find(g => g.id === 'game2')?.currentRoundIndex).toBe(5);
    });

    it('should return updated games after modifications', () => {
      const game1: GameState = {
        id: 'game1',
        name: 'Game 1',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner1@test.com',
        lastUpdated: Date.now(),
      };

      setGame('game1', game1);
      expect(getAllGames()).toHaveLength(1);

      updateGame('game1', { currentRoundIndex: 1 });
      const allGames = getAllGames();
      expect(allGames).toHaveLength(1);
      expect(allGames[0].currentRoundIndex).toBe(1);
    });

    it('should not return removed games', () => {
      const game1: GameState = {
        id: 'game1',
        name: 'Game 1',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner1@test.com',
        lastUpdated: Date.now(),
      };

      const game2: GameState = {
        id: 'game2',
        name: 'Game 2',
        players: [],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'owner2@test.com',
        lastUpdated: Date.now(),
      };

      setGame('game1', game1);
      setGame('game2', game2);
      expect(getAllGames()).toHaveLength(2);

      removeGame('game1');
      const allGames = getAllGames();
      expect(allGames).toHaveLength(1);
      expect(allGames[0].id).toBe('game2');
    });
  });
});

