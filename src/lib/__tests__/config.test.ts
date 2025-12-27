import { DEBUG_MODE, DECK_SIZE } from '@/lib/config';

describe('config', () => {
  const originalEnv = process.env.NEXT_PUBLIC_DEBUG_MODE;

  afterEach(() => {
    // Restore original environment variable
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_DEBUG_MODE;
    } else {
      process.env.NEXT_PUBLIC_DEBUG_MODE = originalEnv;
    }
    // Clear module cache to force re-import
    jest.resetModules();
  });

  describe('DEBUG_MODE', () => {
    it('should be true when NEXT_PUBLIC_DEBUG_MODE environment variable is "true"', () => {
      process.env.NEXT_PUBLIC_DEBUG_MODE = 'true';
      jest.resetModules();
      const { DEBUG_MODE } = require('@/lib/config');
      expect(DEBUG_MODE).toBe(true);
    });

    it('should be false when NEXT_PUBLIC_DEBUG_MODE environment variable is not set', () => {
      delete process.env.NEXT_PUBLIC_DEBUG_MODE;
      jest.resetModules();
      const { DEBUG_MODE } = require('@/lib/config');
      expect(DEBUG_MODE).toBe(false);
    });

    it('should be false when NEXT_PUBLIC_DEBUG_MODE environment variable is "false"', () => {
      process.env.NEXT_PUBLIC_DEBUG_MODE = 'false';
      jest.resetModules();
      const { DEBUG_MODE } = require('@/lib/config');
      expect(DEBUG_MODE).toBe(false);
    });

    it('should be false when NEXT_PUBLIC_DEBUG_MODE environment variable is any other value', () => {
      process.env.NEXT_PUBLIC_DEBUG_MODE = 'yes';
      jest.resetModules();
      const { DEBUG_MODE } = require('@/lib/config');
      expect(DEBUG_MODE).toBe(false);
    });
  });

  describe('DECK_SIZE', () => {
    it('should be 6 when DEBUG_MODE is true', () => {
      process.env.NEXT_PUBLIC_DEBUG_MODE = 'true';
      jest.resetModules();
      const { DECK_SIZE } = require('@/lib/config');
      expect(DECK_SIZE).toBe(6);
    });

    it('should be 52 when DEBUG_MODE is false', () => {
      delete process.env.NEXT_PUBLIC_DEBUG_MODE;
      jest.resetModules();
      const { DECK_SIZE } = require('@/lib/config');
      expect(DECK_SIZE).toBe(52);
    });

    it('should be 52 when DEBUG_MODE is explicitly false', () => {
      process.env.NEXT_PUBLIC_DEBUG_MODE = 'false';
      jest.resetModules();
      const { DECK_SIZE } = require('@/lib/config');
      expect(DECK_SIZE).toBe(52);
    });
  });

  describe('client-side availability', () => {
    it('should use NEXT_PUBLIC_ prefix so DEBUG_MODE is available on client side', () => {
      // This test documents that we use NEXT_PUBLIC_ prefix for client-side access
      // In Next.js, only NEXT_PUBLIC_ prefixed env vars are available on the client
      process.env.NEXT_PUBLIC_DEBUG_MODE = 'true';
      jest.resetModules();
      const { DEBUG_MODE } = require('@/lib/config');
      
      // The config should read from NEXT_PUBLIC_DEBUG_MODE
      expect(DEBUG_MODE).toBe(true);
    });
  });
});
