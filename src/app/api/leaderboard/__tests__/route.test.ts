/**
 * @jest-environment node
 */
import { GET } from '../route';

// We need to verify the module exports force-dynamic
// Import the module to check its exports
import * as leaderboardRoute from '../route';

// Mock the db module
jest.mock('@/lib/db', () => ({
    getGlobalLeaderboard: jest.fn(() => Promise.resolve([
        {
            email: 'player1@test.com',
            name: 'Player 1',
            image: null,
            gamesPlayed: 5,
            wins: 3,
            secondPlace: 1,
            thirdPlace: 0,
            averagePercentile: 80,
            podiumRate: 80,
            winRate: 60,
            totalScore: 500,
            lastPlaceCount: 0,
        }
    ])),
}));

describe('/api/leaderboard route', () => {
    it('exports dynamic = "force-dynamic" to prevent Next.js static caching', () => {
        expect((leaderboardRoute as any).dynamic).toBe('force-dynamic');
    });

    it('returns cached: false on first request', async () => {
        const response = await GET();
        const data = await response.json();

        expect(data.cached).toBe(false);
    });

    it('returns leaderboard data from the database', async () => {
        // Reset module to get fresh cache state
        jest.resetModules();
        const { GET: freshGET } = require('../route');
        const response = await freshGET();
        const data = await response.json();

        expect(data.leaderboard).toBeDefined();
        expect(data.leaderboard).toHaveLength(1);
        expect(data.leaderboard[0].name).toBe('Player 1');
    });
});
