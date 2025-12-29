import { getGoogleFromToken, listValidationGames, createGameResourcesInSheetAsync } from "@/lib/google";
import { NextRequest, NextResponse } from "next/server";
import { setGame, getGame, type GameState, mapTempIdToSheetId, getSheetIdFromTempId } from "@/lib/store";
import { validateCSRF } from "@/lib/csrf";
import { getAuthToken } from "@/lib/auth-utils";

// Using Route Handler for data fetching to keep credentials server-side
export async function GET(req: NextRequest) {
    const token = await getAuthToken(req);

    if (!token) {
        console.error('GET: No token found. Cookies:', req.cookies.getAll().map(c => c.name));
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const auth = getGoogleFromToken(token);
        const files = await listValidationGames(auth);
        return NextResponse.json(files);
    } catch (error) {
        console.error(error);
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
        let auth;
        try {
            auth = getGoogleFromToken(token);
        } catch (e: any) {
            console.error("Error getting Google auth:", e);
            return NextResponse.json({ 
                error: `Authentication error: ${e?.message || 'Failed to authenticate with Google. Please sign in again.'}` 
            }, { status: 401 });
        }
        
        // Generate temporary ID immediately
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // Initialize game state in memory immediately with temp ID
        const now = Date.now();
        const initialGameState: GameState = {
            id: tempId,
            name,
            players: [{
                id: token.id as string,
                name: token.name as string || 'Unknown',
                email: token.email as string || '',
                tricks: 0,
                bid: 0,
                score: 0,
                image: token.picture as string | undefined
            }],
            rounds: [],
            currentRoundIndex: 0,
            ownerEmail: token.email as string || '',
            operatorEmail: token.email as string || '',
            createdAt: now,
            lastUpdated: now,
            skipSheetSync: true  // Start with sheet sync disabled until sheet is created
        };
        setGame(tempId, initialGameState);
        console.log(`[API] Created game ${tempId} in memory. Owner: ${token.email}`);
        
        // Verify it was stored
        const verifyGame = getGame(tempId);
        if (!verifyGame) {
            console.error(`[API] ERROR: Game ${tempId} was not stored properly!`);
        } else {
            console.log(`[API] Verified game ${tempId} is in memory`);
        }

        // Create Google Sheet resources in background
        // When sheet is created, update game state with real sheetId
        createGameResourcesInSheetAsync(
            auth,
            name,
            {
                id: token.id!,
                name: token.name,
                email: token.email
            },
            tempId,
            (tempGameId: string, sheetId: string) => {
                // Update game state with real sheetId and enable sheet sync
                const game = setGame(tempGameId, { ...initialGameState, id: sheetId, skipSheetSync: false });
                // Also store with real sheetId
                setGame(sheetId, game);
                // Map temp ID to sheet ID for lookups
                mapTempIdToSheetId(tempGameId, sheetId);
                
                // Broadcast update to all clients (both temp ID and real ID)
                if ((global as any).broadcastGameUpdate) {
                    console.log(`[API] Broadcasting game update: tempId=${tempGameId}, sheetId=${sheetId}`);
                    (global as any).broadcastGameUpdate(tempGameId, game);
                    (global as any).broadcastGameUpdate(sheetId, game);
                }
                
                // Broadcast discovery update when game is created (only when it has real sheet ID)
                if ((global as any).broadcastDiscoveryUpdate) {
                    console.log(`[API] Broadcasting discovery update: game created, sheetId=${sheetId}`);
                    (global as any).broadcastDiscoveryUpdate('GAME_CREATED', game);
                }
            }
        );

        // Return temp ID immediately - Google operations happen in background
        return NextResponse.json({ gameId: tempId });
    } catch (e: any) {
        console.error("Error creating game:", e);
        console.error("Error details:", {
            message: e?.message,
            code: e?.code,
            stack: e?.stack,
            tokenHasAccessToken: !!token?.accessToken,
            tokenHasRefreshToken: !!token?.refreshToken
        });
        
        let errorMessage = "Unknown error";
        if (e?.message) {
            errorMessage = e.message;
        } else if (e?.code) {
            errorMessage = `Google API error (${e.code}): ${e.message || 'Unknown error'}`;
        } else if (typeof e === 'string') {
            errorMessage = e;
        } else if (e?.toString) {
            errorMessage = e.toString();
        }
        
        return NextResponse.json({ error: `Failed to create game: ${errorMessage}` }, { status: 500 });
    }
}
