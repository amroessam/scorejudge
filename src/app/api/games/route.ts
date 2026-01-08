import { NextRequest, NextResponse } from "next/server";
import { setGame, type GameState } from "@/lib/store";
import { validateCSRF } from "@/lib/csrf";
import { getAuthToken } from "@/lib/auth-utils";
import { createGame, getUserByEmail, upsertUser, addPlayer } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import { DECK_SIZE } from "@/lib/config";

function getFinalRoundNumber(numPlayers: number): number {
    if (!numPlayers) return 12;
    const maxCards = Math.floor(DECK_SIZE / numPlayers);
    return maxCards * 2 - 1;
}

// Using Route Handler for data fetching to keep credentials server-side
export async function GET(req: NextRequest) {
    const token = await getAuthToken(req);

    if (!token || !token.email) {
        console.error('[GET /api/games] No token or email found');
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log('[GET /api/games] Fetching games for user:', { email: token.email });

    try {
        // Always fetch the actual DB user ID by email to avoid session token mismatches
        // This handles cases where older sessions have a different 'id' in their token
        const user = await getUserByEmail(token.email);

        if (!user) {
            console.log(`[GET /api/games] No user found for ${token.email}, returning empty list`);
            return NextResponse.json([]);
        }

        const dbUserId = user.id;
        console.log(`[GET /api/games] Using DB User ID: ${dbUserId} for email: ${token.email}`);

        const includeHidden = req.nextUrl.searchParams.get('includeHidden') === 'true';

        // Fetch games where user is a player from Supabase using the correct DB ID
        let query = supabaseAdmin
            .from('games')
            .select(`
                id,
                name,
                created_at,
                current_round_index,
                owner:users!owner_id(email),
                game_players!inner(user_id, is_hidden),
                all_players:game_players(count),
                rounds:rounds(state, round_index)
            `)
            .eq('game_players.user_id', dbUserId);

        if (!includeHidden) {
            query = query.eq('game_players.is_hidden', false);
        }

        const { data: games, error } = await query;

        if (error) {
            console.error('[GET /api/games] Supabase error:', error);
            return NextResponse.json({ error: "Database query failed" }, { status: 500 });
        }

        // Map to format expected by UI
        const mapped = (games || []).map(g => {
            const playerCount = (g.all_players as any)?.[0]?.count || 0;
            const finalRound = getFinalRoundNumber(playerCount);
            const rounds = (g.rounds as any[]) || [];
            const isCompleted = rounds.some(r => r.state === 'COMPLETED' && r.round_index >= finalRound);

            return {
                id: g.id,
                name: g.name,
                createdTime: g.created_at,
                currentRoundIndex: g.current_round_index,
                isHidden: (g.game_players as any)?.[0]?.is_hidden || false,
                ownerEmail: (g.owner as any)?.email,
                playerCount,
                isCompleted
            };
        });

        return NextResponse.json(mapped);
    } catch (error) {
        console.error('[GET /api/games] Error:', error);
        return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    // Validate CSRF protection
    if (!validateCSRF(req)) {
        return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
    }

    const token = await getAuthToken(req);

    if (!token) {
        console.error('POST: No token found. Cookies:', req.cookies.getAll().map(c => c.name));
        return NextResponse.json({ error: "Unauthorized - Please sign in again" }, { status: 401 });
    }

    let body;
    try {
        body = await req.json();
    } catch (e) {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { name } = body;

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    try {
        // 1. Ensure user exists in Supabase
        let user = await getUserByEmail(token.email as string);
        if (!user) {
            // This should have been handled by signIn callback, but safety first
            console.error("User not found in Supabase during game creation, attempting recovery sync");
            user = await upsertUser({
                id: token.id as string, // Pass the user ID from token
                email: token.email as string,
                name: token.name as string,
                image: token.picture as string,
                google_sub: token.sub as string
            });
        }

        if (!user) {
            return NextResponse.json({ error: "Failed to sync user with database" }, { status: 500 });
        }

        // 2. Create game in Supabase
        const dbGame = await createGame(name, user.id);
        if (!dbGame) {
            return NextResponse.json({ error: "Failed to create game in database" }, { status: 500 });
        }

        const gameId = dbGame.id;

        // 3. Add host as the first player in the database
        console.log(`[CREATE] Adding creator ${user.email} (ID: ${user.id}) to game ${gameId} as player`);
        await addPlayer(gameId, user.id, 0);

        // 3. Initialize game state in memory for immediate access
        const now = Date.now();
        const initialGameState: GameState = {
            id: gameId,
            name,
            players: [{
                id: user.id,
                name: user.display_name || user.name || 'Unknown',
                email: user.email,
                tricks: 0,
                bid: 0,
                score: 0,
                image: user.image
            }],
            rounds: [],
            currentRoundIndex: 0,
            ownerEmail: user.email,
            operatorEmail: user.email,
            createdAt: now,
            lastUpdated: now,
        };

        // Cache in memory
        setGame(gameId, initialGameState);
        console.log(`[CREATE] Game ${gameId} created. Owner: ${user.email}, Players: [${user.email}]`);

        // 4. Broadcast discovery update
        if ((global as any).broadcastDiscoveryUpdate) {
            (global as any).broadcastDiscoveryUpdate('GAME_CREATED', initialGameState);
        }

        return NextResponse.json({ gameId });
    } catch (e: any) {
        console.error("Error creating game:", e);
        return NextResponse.json({
            error: `Failed to create game: ${e?.message || 'Unknown error'}`
        }, { status: 500 });
    }
}
