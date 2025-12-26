import { getGoogleFromToken, listValidationGames, createGameResourcesInSheetAsync } from "@/lib/google";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { setGame, type GameState, mapTempIdToSheetId, getSheetIdFromTempId } from "@/lib/store";
import { validateCSRF } from "@/lib/csrf";

// Using Route Handler for data fetching to keep credentials server-side
export async function GET(req: NextRequest) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    if (!token) {
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

    let token;
    try {
        token = await getToken({ 
            req, 
            secret: process.env.NEXTAUTH_SECRET,
            cookieName: process.env.NODE_ENV === 'production' 
                ? '__Secure-next-auth.session-token' 
                : 'next-auth.session-token'
        });
    } catch (e) {
        console.error('Error getting token:', e);
        return NextResponse.json({ error: "Authentication error" }, { status: 401 });
    }
    
    if (!token) {
        console.error('No token found. Cookies:', req.cookies.getAll());
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
        const initialGameState: GameState = {
            id: tempId,
            name,
            players: [{
                id: token.id as string,
                name: token.name as string || 'Unknown',
                email: token.email as string || '',
                tricks: 0,
                bid: 0,
                score: 0
            }],
            rounds: [],
            currentRoundIndex: 0,
            ownerEmail: token.email as string || '',
            operatorEmail: token.email as string || '',
            lastUpdated: Date.now()
        };
        setGame(tempId, initialGameState);

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
                // Update game state with real sheetId
                const game = setGame(tempGameId, { ...initialGameState, id: sheetId });
                // Also store with real sheetId
                setGame(sheetId, game);
                // Map temp ID to sheet ID for lookups
                mapTempIdToSheetId(tempGameId, sheetId);
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
