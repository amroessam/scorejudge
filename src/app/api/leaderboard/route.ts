import { NextResponse } from 'next/server';
import { getGlobalLeaderboard, LeaderboardEntry } from '@/lib/db';

// Cache the leaderboard for 5 minutes
let cachedLeaderboard: LeaderboardEntry[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes (previously 30 seconds)

export async function GET() {
    try {
        const now = Date.now();

        // Return cached data if fresh
        if (cachedLeaderboard && (now - cacheTimestamp) < CACHE_DURATION) {
            return NextResponse.json({
                leaderboard: cachedLeaderboard,
                cached: true,
                cacheAge: Math.round((now - cacheTimestamp) / 1000),
            });
        }

        // Fetch fresh data
        const leaderboard = await getGlobalLeaderboard();

        // Update cache
        cachedLeaderboard = leaderboard;
        cacheTimestamp = now;

        return NextResponse.json({
            leaderboard,
            cached: false,
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }
}
