/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthToken } from '@/lib/auth-utils';
import { getUserByEmail } from '@/lib/db';

jest.mock('@/lib/supabase', () => ({
    supabaseAdmin: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        filter: jest.fn().mockReturnThis(),
    }
}));

jest.mock('@/lib/auth-utils', () => ({
    getAuthToken: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
    getUserByEmail: jest.fn(),
}));

describe('GET /api/games', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };

    beforeEach(() => {
        jest.clearAllMocks();
        (getAuthToken as jest.Mock).mockResolvedValue(mockUser);
        (getUserByEmail as jest.Mock).mockResolvedValue({ id: 'user-123' });
    });

    it('should return 401 if unauthorized', async () => {
        (getAuthToken as jest.Mock).mockResolvedValue(null);
        const req = new NextRequest('http://localhost/api/games');
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it('should filter out hidden games by default', async () => {
        const mockGames = [
            { id: '1', name: 'Game 1', game_players: [{ is_hidden: false }] },
        ];

        // Mock the resolved value for the games query
        (supabaseAdmin as any).then = jest.fn().mockImplementation((callback: any) => {
            return Promise.resolve(callback({ data: mockGames, error: null }));
        });

        const req = new NextRequest('http://localhost/api/games');
        await GET(req);

        // Verify it filtered by the user's ID
        expect(supabaseAdmin.eq).toHaveBeenCalledWith('game_players.user_id', 'user-123');
        // And filtered out hidden games
        expect(supabaseAdmin.eq).toHaveBeenCalledWith('game_players.is_hidden', false);
    });

    it('should include hidden games when includeHidden=true', async () => {
        const mockGames = [
            { id: '1', name: 'Game 1', game_players: [{ is_hidden: false }] },
            { id: '2', name: 'Game 2', game_players: [{ is_hidden: true }] },
        ];

        (supabaseAdmin as any).then = jest.fn().mockImplementation((callback: any) => {
            return Promise.resolve(callback({ data: mockGames, error: null }));
        });

        const req = new NextRequest('http://localhost/api/games?includeHidden=true');
        await GET(req);

        // Verify it filtered by user_id
        expect(supabaseAdmin.eq).toHaveBeenCalledWith('game_players.user_id', 'user-123');
        // But NOT by is_hidden
        expect(supabaseAdmin.eq).not.toHaveBeenCalledWith('game_players.is_hidden', false);
    });
});
