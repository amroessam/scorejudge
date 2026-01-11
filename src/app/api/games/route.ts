import { NextRequest, NextResponse } from "next/server";
import { setGame, type GameState } from "@/lib/store";
import { validateCSRF } from "@/lib/csrf";
import { getAuthToken } from "@/lib/auth-utils";
import { createGame, getUserByEmail, upsertUser, addPlayer } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import { DECK_SIZE } from "@/lib/config";
import { withSpan, extractTraceContext } from "@/lib/tracing";
import { createLogger } from "@/lib/logger";

function getFinalRoundNumber(numPlayers: number): number {
    if (!numPlayers) return 12;
    const maxCards = Math.floor(DECK_SIZE / numPlayers);
    return maxCards * 2 - 1;
}

// Using Route Handler for data fetching to keep credentials server-side
export async function GET(req: NextRequest) {
    const token = await getAuthToken(req);

    if (!token || !token.email) {
        const log = createLogger({});
        log.error('No token or email found in GET /api/games');
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return withSpan(
        'GET /api/games',
        extractTraceContext(token.email as string, token.id as string),
        async (span) => {
            span.setAttribute('http.method', 'GET');
            span.setAttribute('http.route', '/api/games');

            const log = createLogger({
                userId: token.id as string,
                userEmail: token.email as string
            });

            log.info('Fetching games for user');

            try {
                // Always fetch the actual DB user ID by email to avoid session token mismatches
                // This handles cases where older sessions have a different 'id' in their token
                const user = await getUserByEmail(token.email!);

                if (!user) {
                    log.info('No user found in database, returning empty list');
                    span.setAttribute('games.count', 0);
                    return NextResponse.json([]);
                }

                const dbUserId = user.id;
                span.setAttribute('user.id', dbUserId);

                const userLog = createLogger({
                    userId: dbUserId,
                    userEmail: token.email as string
                });
                userLog.info('Using DB User ID for query');

                const includeHidden = req.nextUrl.searchParams.get('includeHidden') === 'true';
                span.setAttribute('games.includeHidden', includeHidden);

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
                    userLog.error({ error: error.message }, 'Supabase query failed');
                    span.setAttribute('error.type', 'database_error');
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

                span.setAttribute('games.count', mapped.length);
                userLog.info({ gamesCount: mapped.length }, 'Successfully fetched games');
                return NextResponse.json(mapped);
            } catch (error: any) {
                log.error({ error: error.message }, 'Failed to fetch games');
                return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
            }
        }
    );
}

export async function POST(req: NextRequest) {
    // Validate CSRF protection
    if (!validateCSRF(req)) {
        return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
    }

    const token = await getAuthToken(req);

    if (!token) {
        const log = createLogger({});
        log.error({ cookies: req.cookies.getAll().map(c => c.name) }, 'No token found in POST /api/games');
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

    return withSpan(
        'POST /api/games',
        extractTraceContext(token.email as string, token.id as string),
        async (span) => {
            span.setAttribute('http.method', 'POST');
            span.setAttribute('http.route', '/api/games');
            span.setAttribute('game.name', name);

            const log = createLogger({
                userId: token.id as string,
                userEmail: token.email as string,
                gameName: name
            });

            log.info('Creating new game');

            try {
                // 1. Ensure user exists in Supabase
                let user = await getUserByEmail(token.email as string);
                if (!user) {
                    // This should have been handled by signIn callback, but safety first
                    log.warn('User not found in Supabase, attempting recovery sync');
                    span.setAttribute('user.recovery_sync', true);
                    user = await upsertUser({
                        id: token.id as string, // Pass the user ID from token
                        email: token.email as string,
                        name: token.name as string,
                        image: token.picture as string,
                        google_sub: token.sub as string
                    });
                }

                if (!user) {
                    log.error('Failed to sync user with database');
                    span.setAttribute('error.type', 'user_sync_failed');
                    return NextResponse.json({ error: "Failed to sync user with database" }, { status: 500 });
                }

                span.setAttribute('user.id', user.id);

                // 2. Create game in Supabase
                const dbGame = await createGame(name, user.id);
                if (!dbGame) {
                    log.error('Failed to create game in database');
                    span.setAttribute('error.type', 'game_create_failed');
                    return NextResponse.json({ error: "Failed to create game in database" }, { status: 500 });
                }

                const gameId = dbGame.id;
                span.setAttribute('game.id', gameId);

                const gameLog = createLogger({
                    userId: user.id,
                    userEmail: user.email,
                    gameId: gameId,
                    gameName: name
                });

                // 3. Add host as the first player in the database
                gameLog.info('Adding creator as first player');
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
                gameLog.info({ playerCount: 1 }, 'Game created successfully');

                // 4. Broadcast discovery update
                if ((global as any).broadcastDiscoveryUpdate) {
                    (global as any).broadcastDiscoveryUpdate('GAME_CREATED', initialGameState);
                }

                return NextResponse.json({ gameId });
            } catch (e: any) {
                log.error({ error: e.message }, 'Error creating game');
                span.setAttribute('error.type', 'unexpected_error');
                return NextResponse.json({
                    error: `Failed to create game: ${e?.message || 'Unknown error'}`
                }, { status: 500 });
            }
        }
    );
}

