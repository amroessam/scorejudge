import { NextRequest, NextResponse } from "next/server";
import { getGame, setGame, getSheetIdFromTempId } from "@/lib/store";
import { validateCSRF } from "@/lib/csrf";
import { getAuthToken } from "@/lib/auth-utils";

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

    // Get body
    let body;
    try {
        body = await req.json();
    } catch (e) {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    
    const { name } = body;
    if (!name || typeof name !== 'string') {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Resolve game ID
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
        return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Check if game has started - name changes are only allowed before the game starts
    if (game.currentRoundIndex > 0) {
        return NextResponse.json({ 
            error: "Name cannot be changed after the game has started" 
        }, { status: 400 });
    }

    // Update player
    const playerIndex = game.players.findIndex(p => p.email === token.email);
    if (playerIndex === -1) {
        return NextResponse.json({ error: "Player not found in game" }, { status: 404 });
    }

    // Update name
    game.players[playerIndex].name = name;
    
    // Save to store
    setGame(actualGameId, game);
    if (actualGameId !== gameId) {
        setGame(gameId, game);
    }

    // Broadcast update
    if ((global as any).broadcastGameUpdate) {
        (global as any).broadcastGameUpdate(gameId, game);
        if (actualGameId !== gameId) {
            (global as any).broadcastGameUpdate(actualGameId, game);
        }
    }

    // TODO: Update in Google Sheet if we want persistence of name changes
    // For now, in-memory update is sufficient for live game play
    // But ideally we'd update the Players sheet too.

    return NextResponse.json({ success: true, game });
}

