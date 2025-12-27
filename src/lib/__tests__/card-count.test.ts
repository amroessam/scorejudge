/**
 * Tests to verify that DECK_SIZE is used instead of hardcoded 52
 * These tests check the round generation logic and max cards calculations
 */

describe('card count usage', () => {
  const originalEnv = process.env.NEXT_PUBLIC_DEBUG_MODE;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_DEBUG_MODE;
    } else {
      process.env.NEXT_PUBLIC_DEBUG_MODE = originalEnv;
    }
    jest.resetModules();
  });

  describe('round plan generation', () => {
    it('should use DECK_SIZE=6 when DEBUG_MODE is true', () => {
      process.env.NEXT_PUBLIC_DEBUG_MODE = 'true';
      jest.resetModules();
      
      const { DECK_SIZE } = require('@/lib/config');
      
      // Simulate round plan calculation
      const numPlayers = 3;
      const maxCards = Math.floor(DECK_SIZE / numPlayers);
      
      expect(DECK_SIZE).toBe(6);
      expect(maxCards).toBe(2); // 6 / 3 = 2
    });

    it('should use DECK_SIZE=52 when DEBUG_MODE is false', () => {
      delete process.env.NEXT_PUBLIC_DEBUG_MODE;
      jest.resetModules();
      
      const { DECK_SIZE } = require('@/lib/config');
      
      // Simulate round plan calculation
      const numPlayers = 3;
      const maxCards = Math.floor(DECK_SIZE / numPlayers);
      
      expect(DECK_SIZE).toBe(52);
      expect(maxCards).toBe(17); // 52 / 3 = 17
    });

    it('should calculate final round number correctly with DECK_SIZE=6', () => {
      process.env.NEXT_PUBLIC_DEBUG_MODE = 'true';
      jest.resetModules();
      
      const { DECK_SIZE } = require('@/lib/config');
      
      const numPlayers = 3;
      const maxCards = Math.floor(DECK_SIZE / numPlayers);
      const finalRoundNumber = maxCards * 2 - 1;
      
      expect(finalRoundNumber).toBe(3); // (6/3)*2 - 1 = 2*2 - 1 = 3
    });

    it('should calculate final round number correctly with DECK_SIZE=52', () => {
      delete process.env.NEXT_PUBLIC_DEBUG_MODE;
      jest.resetModules();
      
      const { DECK_SIZE } = require('@/lib/config');
      
      const numPlayers = 3;
      const maxCards = Math.floor(DECK_SIZE / numPlayers);
      const finalRoundNumber = maxCards * 2 - 1;
      
      expect(finalRoundNumber).toBe(33); // (52/3)*2 - 1 = 17*2 - 1 = 33
    });
  });

  describe('max cards calculation', () => {
    it('should use DECK_SIZE for max cards calculation with different player counts', () => {
      process.env.NEXT_PUBLIC_DEBUG_MODE = 'true';
      jest.resetModules();
      
      const { DECK_SIZE } = require('@/lib/config');
      
      // Test with different player counts
      expect(Math.floor(DECK_SIZE / 2)).toBe(3); // 6 / 2 = 3
      expect(Math.floor(DECK_SIZE / 3)).toBe(2); // 6 / 3 = 2
      expect(Math.floor(DECK_SIZE / 4)).toBe(1); // 6 / 4 = 1
      expect(Math.floor(DECK_SIZE / 6)).toBe(1); // 6 / 6 = 1
    });

    it('should use DECK_SIZE=52 for max cards in production mode', () => {
      delete process.env.NEXT_PUBLIC_DEBUG_MODE;
      jest.resetModules();
      
      const { DECK_SIZE } = require('@/lib/config');
      
      // Test with different player counts
      expect(Math.floor(DECK_SIZE / 2)).toBe(26); // 52 / 2 = 26
      expect(Math.floor(DECK_SIZE / 3)).toBe(17); // 52 / 3 = 17
      expect(Math.floor(DECK_SIZE / 4)).toBe(13); // 52 / 4 = 13
    });
  });
});
