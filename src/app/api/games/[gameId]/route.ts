import { NextRequest, NextResponse } from "next/server";
import { getGoogleFromToken } from "@/lib/google";
import { fetchGameFromSheet } from "@/lib/game-logic"; // Ensure this matches file path
import { setGame, getGame, removeGame, getSheetIdFromTempId, updateGame } from "@/lib/store";
import { google } from "googleapis";
import { validateCSRF } from "@/lib/csrf";
import { getAuthToken } from "@/lib/auth-utils";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ gameId: string }> }
) {
    const { gameId } = await params;

    // 1. Check Memory first (no auth required)
    let cached = getGame(gameId);
    
    // If not found and gameId looks like a temp ID, try to resolve to real sheetId
    if (!cached && gameId.startsWith('temp_')) {
        const realSheetId = getSheetIdFromTempId(gameId);
        if (realSheetId) {
            cached = getGame(realSheetId);
        }
    }
    
    if (cached) {
        return NextResponse.json(cached);
    }

    // 2. Try to fetch from Sheet (requires auth)
    const token = await getAuthToken(req);
    
    if (!token) {
        // Game not in memory and user not authenticated
        // Return a more helpful error message
        return NextResponse.json({ 
            error: "Game not found in memory. Please sign in to load the game from Google Sheets, or the game may not exist." 
        }, { status: 404 });
    }

    try {
        const auth = getGoogleFromToken(token);
        const game = await fetchGameFromSheet(auth, gameId);

        // 3. Cache it
        setGame(gameId, game);

        return NextResponse.json(game);
    } catch (error: any) {
        console.error("Failed to fetch game:", error);
        // Provide more specific error messages
        const errorMessage = error?.message || "Unknown error";
        if (errorMessage.includes("not found") || errorMessage.includes("404")) {
            return NextResponse.json({ 
                error: "Game not found. The game may have been deleted or the ID is incorrect." 
            }, { status: 404 });
        }
        if (errorMessage.includes("access") || errorMessage.includes("permission") || errorMessage.includes("403")) {
            return NextResponse.json({ 
                error: "Access denied. You may not have permission to view this game. Make sure you're signed in with the correct Google account." 
            }, { status: 403 });
        }
        return NextResponse.json({ 
            error: `Failed to load game: ${errorMessage}` 
        }, { status: 500 });
    }
}

export async function PATCH(
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
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let actualGameId = gameId;
    if (gameId.startsWith('temp_')) {
        const realSheetId = getSheetIdFromTempId(gameId);
        if (realSheetId) {
            actualGameId = realSheetId;
        }
    }

    const game = getGame(actualGameId);
    if (!game) {
        return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Only owner/operator can update structure
    const isOwner = game.ownerEmail === token.email || game.operatorEmail === token.email;
    if (!isOwner) {
         return NextResponse.json({ error: "Only the owner can modify game settings" }, { status: 403 });
    }

    let body;
    try {
        body = await req.json();
    } catch (e) {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    // Fields to update
    // 1. Players (Reordering)
    // 2. First Dealer
    const { players, firstDealerEmail } = body;

    if (players) {
        // Validate players list contains same players (just reordered)
        // Set logic or simplified check length
        if (players.length !== game.players.length) {
            return NextResponse.json({ error: "Invalid player list" }, { status: 400 });
        }
        game.players = players;
    }

    if (firstDealerEmail !== undefined) {
        game.firstDealerEmail = firstDealerEmail;
    }

    setGame(actualGameId, game);
    if (actualGameId !== gameId) {
        setGame(gameId, game);
    }

    // Broadcast
    if ((global as any).broadcastGameUpdate) {
        (global as any).broadcastGameUpdate(gameId, game);
        if (actualGameId !== gameId) {
            (global as any).broadcastGameUpdate(actualGameId, game);
        }
    }

    return NextResponse.json({ success: true, game });
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ gameId: string }> }
) {
    // Validate CSRF protection
    if (!validateCSRF(req)) {
        return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
    }

    const { gameId } = await params;
    const token = await getAuthToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        // 1. Get game state (from memory or sheet)
        let game = getGame(gameId);
        if (!game) {
            try {
                const auth = getGoogleFromToken(token);
                game = await fetchGameFromSheet(auth, gameId);
            } catch (e: any) {
                return NextResponse.json({ 
                    error: `Game not found. ${e?.message || 'The game may not exist or you may not have access.'}` 
                }, { status: 404 });
            }
        }

        // 2. Check if user is the owner
        if (game.ownerEmail !== token.email) {
            return NextResponse.json({ 
                error: "Only the game owner can delete the game" 
            }, { status: 403 });
        }

        // 3. Check if game has started
        // Game has started if: currentRoundIndex > 0 OR has any completed rounds OR has rounds in PLAYING state
        const hasStarted = game.currentRoundIndex > 0 || 
            (game.rounds && game.rounds.some((r: any) => r.state === 'COMPLETED' || r.state === 'PLAYING'));

        if (hasStarted) {
            return NextResponse.json({ 
                error: "Cannot delete a game that has already started. Only games that haven't started can be deleted." 
            }, { status: 400 });
        }

        // 4. Remove from memory immediately
        removeGame(gameId);

        // 5. Delete from Google Drive (fire-and-forget)
        // Don't await - return immediately, deletion happens in background
        (async () => {
            try {
                const auth = getGoogleFromToken(token);
                const drive = google.drive({ version: 'v3', auth });
                await drive.files.delete({
                    fileId: gameId,
                });
            } catch (e: any) {
                // If file doesn't exist in Drive, that's okay - already deleted from memory
                console.warn("Failed to delete file from Google Drive (may not exist):", e?.message);
            }
        })();

        return NextResponse.json({ success: true, message: "Game deleted successfully" });
    } catch (e: any) {
        console.error("Error deleting game:", e);
        return NextResponse.json({ 
            error: `Failed to delete game: ${e?.message || 'Unknown error'}` 
        }, { status: 500 });
    }
}
