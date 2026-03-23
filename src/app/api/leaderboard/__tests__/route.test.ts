/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '../route';

// We need to verify the module exports force-dynamic
// Import the module to check its exports
import * as leaderboardRoute from '../route';

// Mock the db module
const mockGetGlobalLeaderboard = jest.fn(() => Promise.resolve([
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
]));

jest.mock('@/lib/db', () => ({
    getGlobalLeaderboard: (...args: any[]) => mockGetGlobalLeaderboard(...args),
}));

/** Helper to create a NextRequest with optional query params */
function makeRequest(params?: Record<string, string>): NextRequest {
    const url = new URL('http://localhost:3000/api/leaderboard');
    if (params) {
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }
    }
    return new NextRequest(url);
}

describe('/api/leaderboard route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('exports dynamic = "force-dynamic" to prevent Next.js static caching', () => {
        expect((leaderboardRoute as any).dynamic).toBe('force-dynamic');
    });

    it('returns cached: false on first request', async () => {
        const response = await GET(makeRequest());
        const data = await response.json();

        expect(data.cached).toBe(false);
    });

    it('returns leaderboard data from the database', async () => {
        // Reset module to get fresh cache state
        jest.resetModules();
        const mockFn = jest.fn(() => Promise.resolve([
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
        ]));
        jest.doMock('@/lib/db', () => ({
            getGlobalLeaderboard: (...args: any[]) => mockFn(...args),
        }));
        const { GET: freshGET } = require('../route');
        const response = await freshGET(makeRequest());
        const data = await response.json();

        expect(data.leaderboard).toBeDefined();
        expect(data.leaderboard).toHaveLength(1);
        expect(data.leaderboard[0].name).toBe('Player 1');
    });

    it('returns 500 when getGlobalLeaderboard throws', async () => {
        // Reset modules to clear all cached modules and mock registrations
        jest.resetModules();
        // Register a mock that rejects before requiring the route
        jest.doMock('@/lib/db', () => ({
            getGlobalLeaderboard: jest.fn(() => Promise.reject(new Error('DB connection failed'))),
        }));
        const { GET: errorGET } = require('../route');

        const response = await errorGET(makeRequest());
        expect(response.status).toBe(500);

        const data = await response.json();
        expect(data.error).toBe('Failed to fetch leaderboard');
    });

    it('returns cached: true with cacheAge on second call within 30s', async () => {
        // Reset modules to get a fresh route with clean cache state
        jest.resetModules();
        jest.doMock('@/lib/db', () => ({
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
        const { GET: freshGET } = require('../route');

        // First call — populates cache
        const first = await freshGET(makeRequest());
        const firstData = await first.json();
        expect(firstData.cached).toBe(false);

        // Second call — should hit cache
        const second = await freshGET(makeRequest());
        const secondData = await second.json();
        expect(secondData.cached).toBe(true);
        expect(typeof secondData.cacheAge).toBe('number');
    });

    it('passes country query param to getGlobalLeaderboard', async () => {
        const response = await GET(makeRequest({ country: 'AE' }));
        const data = await response.json();

        expect(mockGetGlobalLeaderboard).toHaveBeenCalledWith('AE');
        expect(data.cached).toBe(false);
    });

    it('passes undefined when no country param provided', async () => {
        // Reset modules to get fresh cache
        jest.resetModules();
        const mockFn = jest.fn(() => Promise.resolve([]));
        jest.doMock('@/lib/db', () => ({
            getGlobalLeaderboard: (...args: any[]) => mockFn(...args),
        }));
        const { GET: freshGET } = require('../route');

        await freshGET(makeRequest());
        expect(mockFn).toHaveBeenCalledWith(undefined);
    });
});
