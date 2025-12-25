import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getGoogleFromToken } from "@/lib/google";
import { fetchGameFromSheet } from "@/lib/game-logic";
import { setGame, getGame, getSheetIdFromTempId } from "@/lib/store";
import { google } from "googleapis";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ gameId: string }> }
) {
    const { gameId } = await params;
    
    // Try to get token with better error handling
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

    // 1. Get Game State (Memory or Sheet)
    // Resolve temp ID to real sheet ID if needed
    let actualGameId = gameId;
    if (gameId.startsWith('temp_')) {
        const realSheetId = getSheetIdFromTempId(gameId);
        if (realSheetId) {
            actualGameId = realSheetId;
        }
    }
    
    let game = getGame(actualGameId);
    if (!game) {
        game = getGame(gameId); // Try original ID too
    }

    if (!game) {
        // Try to fetch from sheet if not in memory (only if not a temp ID)
        if (!gameId.startsWith('temp_')) {
            try {
                const auth = getGoogleFromToken(token);
                game = await fetchGameFromSheet(auth, gameId);
                setGame(gameId, game);
            } catch (e: any) {
                console.error("Failed to fetch game from sheet:", e);
                return NextResponse.json({ 
                    error: `Game not found. ${e?.message || 'The game may not exist or you may not have access.'}` 
                }, { status: 404 });
            }
        } else {
            return NextResponse.json({ 
                error: "Game is still being created. Please wait a moment and try again." 
            }, { status: 404 });
        }
    }

    // Ensure players array exists
    if (!game.players) {
        game.players = [];
    }

    // 2. Check if already joined
    if (game.players.some(p => p.email === token.email)) {
        return NextResponse.json({ message: "Already joined", game });
    }

    // 3. Validate maximum players (12)
    if (game.players.length >= 12) {
        return NextResponse.json({ 
            error: "Game is full. Maximum 12 players allowed." 
        }, { status: 400 });
    }

    // 4. Add to Sheet (if Google Sheets is available and not temp ID)
    if (!gameId.startsWith('temp_')) {
        let sheets: any = null;
        try {
            const auth = getGoogleFromToken(token);
            sheets = google.sheets({ version: 'v4', auth });
            
            await sheets.spreadsheets.values.append({
                spreadsheetId: actualGameId,
                range: 'Players!A:C',
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [[token.id, token.name, token.email]]
                }
            });
        } catch (e: any) {
            console.error("Failed to add player to sheet (continuing anyway):", e);
            // Continue even if sheet update fails - game will work in memory
        }
    }

    // 5. Update Memory + Broadcast
    const newPlayer = {
        id: token.id as string,
        name: token.name || 'Unknown',
        email: token.email || '',
        score: 0,
        bid: 0,
        tricks: 0
    };
    
    game.players.push(newPlayer);
    // Update game state with both IDs if they differ (temp ID -> real ID mapping)
    setGame(actualGameId, game);
    if (actualGameId !== gameId) {
        setGame(gameId, game); // Also keep temp ID mapping
    }

    // Broadcast via global function from server.ts
    if ((global as any).broadcastGameUpdate) {
        (global as any).broadcastGameUpdate(gameId, game);
        if (actualGameId !== gameId) {
            (global as any).broadcastGameUpdate(actualGameId, game);
        }
    }

    return NextResponse.json({ success: true, game });
}
