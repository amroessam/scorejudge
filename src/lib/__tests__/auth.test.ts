import { authOptions } from '@/lib/auth';

// Mock next-auth providers
jest.mock('next-auth/providers/google', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('next-auth/providers/credentials', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('auth', () => {
  const originalEnv = process.env.NEXT_PUBLIC_DEBUG_MODE;
  const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
  const originalGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const originalNextAuthSecret = process.env.NEXTAUTH_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.NEXTAUTH_SECRET = 'test-secret';
  });

  afterEach(() => {
    // Restore original environment variables
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_DEBUG_MODE;
    } else {
      process.env.NEXT_PUBLIC_DEBUG_MODE = originalEnv;
    }
    if (originalGoogleClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
    }
    if (originalGoogleClientSecret === undefined) {
      delete process.env.GOOGLE_CLIENT_SECRET;
    } else {
      process.env.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret;
    }
    if (originalNextAuthSecret === undefined) {
      delete process.env.NEXTAUTH_SECRET;
    } else {
      process.env.NEXTAUTH_SECRET = originalNextAuthSecret;
    }
    jest.resetModules();
  });

  describe('providers configuration', () => {
    it('should include Google provider when DEBUG_MODE is false', () => {
      delete process.env.NEXT_PUBLIC_DEBUG_MODE;
      jest.resetModules();
      
      const GoogleProvider = require('next-auth/providers/google').default;
      const CredentialsProvider = require('next-auth/providers/credentials').default;
      
      // Re-import auth to get fresh config
      const { authOptions } = require('@/lib/auth');
      
      expect(GoogleProvider).toHaveBeenCalled();
      expect(CredentialsProvider).not.toHaveBeenCalled();
      expect(authOptions.providers).toBeDefined();
      expect(authOptions.providers.length).toBeGreaterThan(0);
    });

    it('should include both Google and Credentials providers when DEBUG_MODE is true', () => {
      process.env.NEXT_PUBLIC_DEBUG_MODE = 'true';
      jest.resetModules();
      
      const GoogleProvider = require('next-auth/providers/google').default;
      const CredentialsProvider = require('next-auth/providers/credentials').default;
      
      // Re-import auth to get fresh config
      const { authOptions } = require('@/lib/auth');
      
      expect(GoogleProvider).toHaveBeenCalled();
      expect(CredentialsProvider).toHaveBeenCalled();
      expect(authOptions.providers).toBeDefined();
      expect(authOptions.providers.length).toBeGreaterThanOrEqual(2);
    });

    it('should configure CredentialsProvider for anonymous login in debug mode', () => {
      process.env.NEXT_PUBLIC_DEBUG_MODE = 'true';
      jest.resetModules();
      
      const CredentialsProvider = require('next-auth/providers/credentials').default;
      
      // Re-import auth to get fresh config
      require('@/lib/auth');
      
      expect(CredentialsProvider).toHaveBeenCalled();
      const credentialsConfig = CredentialsProvider.mock.calls[0][0];
      
      expect(credentialsConfig).toBeDefined();
      expect(credentialsConfig.name).toBe('anonymous');
      expect(credentialsConfig.credentials).toBeDefined();
      expect(typeof credentialsConfig.authorize).toBe('function');
    });

    it('should create anonymous user with generated ID when credentials authorize is called', async () => {
      process.env.NEXT_PUBLIC_DEBUG_MODE = 'true';
      jest.resetModules();
      
      const CredentialsProvider = require('next-auth/providers/credentials').default;
      
      // Re-import auth to get fresh config
      require('@/lib/auth');
      
      const credentialsConfig = CredentialsProvider.mock.calls[0][0];
      const result = await credentialsConfig.authorize({}, {});
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('email');
      expect(result.name).toContain('Anonymous');
      expect(result.email).toContain('anonymous');
      expect(result.id).toBeTruthy();
    });

    it('should generate unique IDs for different anonymous logins', async () => {
      process.env.NEXT_PUBLIC_DEBUG_MODE = 'true';
      jest.resetModules();
      
      const CredentialsProvider = require('next-auth/providers/credentials').default;
      
      // Re-import auth to get fresh config
      require('@/lib/auth');
      
      const credentialsConfig = CredentialsProvider.mock.calls[0][0];
      const result1 = await credentialsConfig.authorize({}, {});
      const result2 = await credentialsConfig.authorize({}, {});
      
      expect(result1.id).not.toBe(result2.id);
      expect(result1.email).not.toBe(result2.email);
    });
  });

  describe('profile picture handling', () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_DEBUG_MODE;
      jest.resetModules();
    });

    it('should include profile picture in JWT token when user signs in with Google', async () => {
      const { authOptions } = require('@/lib/auth');
      
      const mockUser = {
        id: 'user123',
        name: 'Test User',
        email: 'test@example.com',
        image: 'https://lh3.googleusercontent.com/a/test-photo.jpg',
      };
      
      const mockAccount = {
        provider: 'google',
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_at: Date.now() / 1000 + 3600,
      };
      
      const mockToken = {};
      
      const result = await authOptions.callbacks.jwt({
        token: mockToken,
        account: mockAccount,
        user: mockUser,
      });
      
      expect(result).toHaveProperty('picture', mockUser.image);
      expect(result).toHaveProperty('id', mockUser.id);
    });

    it('should include profile picture in session when available', async () => {
      const { authOptions } = require('@/lib/auth');
      
      const mockSession = {
        user: {
          name: 'Test User',
          email: 'test@example.com',
        },
      };
      
      const mockToken = {
        id: 'user123',
        picture: 'https://lh3.googleusercontent.com/a/test-photo.jpg',
      };
      
      const result = await authOptions.callbacks.session({
        session: mockSession,
        token: mockToken,
      });
      
      expect(result.user).toHaveProperty('image', mockToken.picture);
      expect(result.user).toHaveProperty('id', mockToken.id);
    });

    it('should handle missing profile picture gracefully', async () => {
      const { authOptions } = require('@/lib/auth');
      
      const mockUser = {
        id: 'user123',
        name: 'Test User',
        email: 'test@example.com',
        image: null,
      };
      
      const mockAccount = {
        provider: 'google',
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_at: Date.now() / 1000 + 3600,
      };
      
      const mockToken = {};
      
      const result = await authOptions.callbacks.jwt({
        token: mockToken,
        account: mockAccount,
        user: mockUser,
      });
      
      // Should not include picture if it's null/undefined
      expect(result.picture).toBeUndefined();
    });

    it('should preserve existing token properties when refreshing', async () => {
      const { authOptions } = require('@/lib/auth');
      
      const existingToken = {
        id: 'user123',
        picture: 'https://lh3.googleusercontent.com/a/test-photo.jpg',
        accessToken: 'existing-access-token',
        refreshToken: 'existing-refresh-token',
        expiresAt: Date.now() / 1000 + 3600,
      };
      
      const result = await authOptions.callbacks.jwt({
        token: existingToken,
        account: null,
        user: null,
      });
      
      expect(result).toEqual(existingToken);
      expect(result).toHaveProperty('picture');
    });
  });
});

