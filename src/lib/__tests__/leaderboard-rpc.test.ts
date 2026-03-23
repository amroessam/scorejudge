/**
 * @jest-environment node
 */
import { getGlobalLeaderboard } from '@/lib/db';

// Mock Supabase to return RPC data in the Postgres snake_case format
const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
    supabaseAdmin: {
        rpc: (...args: any[]) => mockRpc(...args),
        from: jest.fn(() => ({
            upsert: jest.fn(() => ({ select: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: null, error: null })) })) })),
            select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: null, error: null })) })) })),
            insert: jest.fn(() => ({ select: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: null, error: null })) })) })),
        })),
    }
}));

describe('getGlobalLeaderboard (RPC-based)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('calls supabaseAdmin.rpc with "get_leaderboard" and filter_country', async () => {
        mockRpc.mockResolvedValue({ data: [], error: null });

        await getGlobalLeaderboard();

        expect(mockRpc).toHaveBeenCalledWith('get_leaderboard', { filter_country: null });
    });

    it('maps Postgres snake_case columns to LeaderboardEntry interface', async () => {
        mockRpc.mockResolvedValue({
            data: [
                {
                    email: 'chingar@test.com',
                    player_name: 'Chingar',
                    player_image: 'https://example.com/chingar.jpg',
                    games_played: 199,
                    wins_1st: 33,
                    second_place: 41,
                    third_place: 44,
                    last_place: 22,
                    total_score: 12260,
                    avg_percentile: 65,
                    confidence_rating: 63,
                    win_rate: 17,
                    podium_rate: 59,
                },
                {
                    email: 'wtf@test.com',
                    player_name: 'WTF',
                    player_image: null,
                    games_played: 189,
                    wins_1st: 40,
                    second_place: 30,
                    third_place: 35,
                    last_place: 27,
                    total_score: 11783,
                    avg_percentile: 60,
                    confidence_rating: 58,
                    win_rate: 21,
                    podium_rate: 56,
                },
            ],
            error: null,
        });

        const result = await getGlobalLeaderboard();

        expect(result).toHaveLength(2);

        // Verify first player mapping
        expect(result[0]).toEqual({
            email: 'chingar@test.com',
            name: 'Chingar',
            image: 'https://example.com/chingar.jpg',
            gamesPlayed: 199,
            wins: 33,
            secondPlace: 41,
            thirdPlace: 44,
            lastPlaceCount: 22,
            totalScore: 12260,
            averagePercentile: 63,
            winRate: 17,
            podiumRate: 59,
        });

        // Verify null image handling
        expect(result[1].image).toBeNull();
        expect(result[1].name).toBe('WTF');
        expect(result[1].gamesPlayed).toBe(189);
    });

    it('returns empty array when RPC returns an error', async () => {
        mockRpc.mockResolvedValue({
            data: null,
            error: { message: 'function get_leaderboard() does not exist', code: '42883' },
        });

        const result = await getGlobalLeaderboard();

        expect(result).toEqual([]);
    });

    it('returns empty array when RPC returns null data', async () => {
        mockRpc.mockResolvedValue({ data: null, error: null });

        const result = await getGlobalLeaderboard();

        expect(result).toEqual([]);
    });

    it('returns empty array when RPC returns empty array', async () => {
        mockRpc.mockResolvedValue({ data: [], error: null });

        const result = await getGlobalLeaderboard();

        expect(result).toEqual([]);
    });

    it('passes country_code filter to RPC when provided', async () => {
        mockRpc.mockResolvedValue({ data: [], error: null });
        await getGlobalLeaderboard('AE');
        expect(mockRpc).toHaveBeenCalledWith('get_leaderboard', { filter_country: 'AE' });
    });

    it('passes null filter when no country provided', async () => {
        mockRpc.mockResolvedValue({ data: [], error: null });
        await getGlobalLeaderboard();
        expect(mockRpc).toHaveBeenCalledWith('get_leaderboard', { filter_country: null });
    });

    it('maps confidence_rating to averagePercentile', async () => {
        mockRpc.mockResolvedValue({
            data: [{
                email: 'test@test.com', player_name: 'Test', player_image: null,
                games_played: 50, wins_1st: 10, second_place: 15, third_place: 5,
                last_place: 3, total_score: 5000, avg_percentile: 65,
                confidence_rating: 61, win_rate: 20, podium_rate: 60,
            }],
            error: null,
        });
        const result = await getGlobalLeaderboard();
        expect(result[0].averagePercentile).toBe(61); // Maps confidence_rating, not avg_percentile
    });

    it('converts numeric string values from Postgres to numbers', async () => {
        mockRpc.mockResolvedValue({
            data: [{
                email: 'test@test.com',
                player_name: 'Test',
                player_image: null,
                games_played: '50',  // Postgres BIGINT can come as string
                wins_1st: '10',
                second_place: '15',
                third_place: '5',
                last_place: '3',
                total_score: '5000',
                avg_percentile: '72',
                confidence_rating: '70',
                win_rate: '20',
                podium_rate: '60',
            }],
            error: null,
        });

        const result = await getGlobalLeaderboard();

        expect(typeof result[0].gamesPlayed).toBe('number');
        expect(result[0].gamesPlayed).toBe(50);
        expect(typeof result[0].wins).toBe('number');
        expect(result[0].wins).toBe(10);
        expect(typeof result[0].totalScore).toBe('number');
        expect(result[0].totalScore).toBe(5000);
    });
});
