import { NextRequest, NextResponse } from "next/server";
import { setGame, type GameState } from "@/lib/store";
import { validateCSRF } from "@/lib/csrf";
import { getAuthToken } from "@/lib/auth-utils";
import { createGame, getUserByEmail, upsertUser } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

// Using Route Handler for data fetching to keep credentials server-side
export async function GET(req: NextRequest) {
    const token = await getAuthToken(req);

    if (!token) {
        console.error('GET: No token found. Cookies:', req.cookies.getAll().map(c => c.name));
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Fetch games where user is a player from Supabase
        const { data: games, error } = await supabaseAdmin
            .from('games')
            .select(`
                id,
                name,
                created_at,
                game_players!inner(user_id)
            `)
            .eq('game_players.user_id', token.id);

        if (error) throw error;

        // Map to format expected by UI
        return NextResponse.json(games.map(g => ({
            id: g.id,
            name: g.name,
            createdTime: g.created_at
        })));
    } catch (error) {
        console.error('GET Games Error:', error);
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
        console.log(`[API] Created game ${gameId} in Supabase and memory. Owner: ${user.email}`);

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
