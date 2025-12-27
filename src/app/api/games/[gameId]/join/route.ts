import { NextRequest, NextResponse } from "next/server";
import { getGoogleFromToken } from "@/lib/google";
import { fetchGameFromSheet } from "@/lib/game-logic";
import { setGame, getGame, getSheetIdFromTempId } from "@/lib/store";
import { google } from "googleapis";
import { validateCSRF } from "@/lib/csrf";
import { getAuthToken } from "@/lib/auth-utils";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ gameId: string }> }
) {
    // Validate CSRF protection
    if (!validateCSRF(req)) {
        return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
    }

    const { gameId } = await params;
    
    const token = await getAuthToken(req);
    
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

    // 4. Add to Sheet and share with player (if Google Sheets is available and not temp ID)
    if (!gameId.startsWith('temp_')) {
        let sheets: any = null;
        let drive: any = null;
        try {
            // Use owner's auth to share the sheet and add player
            // First, get owner's auth token - we need to fetch it from the game owner
            // For now, try with current user's auth - if they're the owner, it will work
            // If not, we'll need to handle this differently (store owner's refresh token)
            const auth = getGoogleFromToken(token);
            sheets = google.sheets({ version: 'v4', auth });
            drive = google.drive({ version: 'v3', auth });
            
            // Try to add player to sheet
            try {
                await sheets.spreadsheets.values.append({
                    spreadsheetId: actualGameId,
                    range: 'Players!A:C',
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [[token.id, token.name, token.email]]
                    }
                });
            } catch (sheetError: any) {
                // If we can't write, try to share the sheet with the player first
                // This might fail if current user is not the owner, but we'll try
                if (token.email) {
                    try {
                        await drive.permissions.create({
                            fileId: actualGameId,
                            requestBody: {
                                role: 'writer',
                                type: 'user',
                                emailAddress: token.email,
                            },
                            sendNotificationEmail: false,
                        });
                        // Retry adding player after sharing
                        await sheets.spreadsheets.values.append({
                            spreadsheetId: actualGameId,
                            range: 'Players!A:C',
                            valueInputOption: 'USER_ENTERED',
                            requestBody: {
                                values: [[token.id, token.name, token.email]]
                            }
                        });
                    } catch (shareError: any) {
                        console.error("Failed to share sheet with player or add to sheet:", shareError);
                        // Continue - game will work in memory
                    }
                }
            }
            
            // Share sheet with new player if not already shared (fire-and-forget)
            if (token.email && token.email !== game.ownerEmail) {
                drive.permissions.create({
                    fileId: actualGameId,
                    requestBody: {
                        role: 'writer',
                        type: 'user',
                        emailAddress: token.email,
                    },
                    sendNotificationEmail: false,
                }).catch((e: any) => {
                    console.error("Failed to share sheet with new player (continuing anyway):", e);
                });
            }
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
        tricks: 0,
        image: token.picture as string | undefined
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
