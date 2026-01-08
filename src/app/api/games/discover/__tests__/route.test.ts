/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { getAuthToken } from '@/lib/auth-utils';
import { getDiscoverableGames } from '@/lib/db';

// Mock dependencies
jest.mock('@/lib/auth-utils', () => ({
  getAuthToken: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  getDiscoverableGames: jest.fn(),
}));

describe('/api/games/discover', () => {
  beforeEach(() => {
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

    it('should return discoverable games from db', async () => {
      const mockUser = {
        id: 'user1',
        name: 'Test User',
        email: 'user@test.com',
      };
      (getAuthToken as jest.Mock).mockResolvedValue(mockUser);

      const mockGames = [
        { id: 'game1', name: 'Discoverable Game', ownerEmail: 'owner@test.com', playerCount: 1 }
      ];
      (getDiscoverableGames as jest.Mock).mockResolvedValue(mockGames);

      const req = new NextRequest('http://localhost:3000/api/games/discover');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('game1');
      expect(getDiscoverableGames).toHaveBeenCalledWith(mockUser.email);
    });

    it('should return 500 if db fetch fails', async () => {
      (getAuthToken as jest.Mock).mockResolvedValue({ email: 'user@test.com' });
      (getDiscoverableGames as jest.Mock).mockRejectedValue(new Error('DB Error'));

      const req = new NextRequest('http://localhost:3000/api/games/discover');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch discoverable games');
    });
  });
});
