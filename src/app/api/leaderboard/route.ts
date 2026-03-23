import { NextRequest, NextResponse } from 'next/server';
import { getGlobalLeaderboard, LeaderboardEntry } from '@/lib/db';

// Force Next.js to treat this route as dynamic (not statically cached)
export const dynamic = 'force-dynamic';

// In-memory cache: 30 seconds TTL, keyed by country filter
const leaderboardCache = new Map<string, { data: LeaderboardEntry[]; timestamp: number }>();
const CACHE_DURATION = 30 * 1000; // 30 seconds

export async function GET(req: NextRequest) {
    try {
        const country = req.nextUrl.searchParams.get('country') || undefined;
        const cacheKey = country || '__global__';
        const now = Date.now();

        // Return cached data if fresh
        const cached = leaderboardCache.get(cacheKey);
        if (cached && (now - cached.timestamp) < CACHE_DURATION) {
            return NextResponse.json({
                leaderboard: cached.data,
                cached: true,
                cacheAge: Math.round((now - cached.timestamp) / 1000),
            });
        }

        // Fetch fresh data
        const leaderboard = await getGlobalLeaderboard(country);

        // Update cache
        leaderboardCache.set(cacheKey, { data: leaderboard, timestamp: now });

        return NextResponse.json({
            leaderboard,
            cached: false,
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }
}
