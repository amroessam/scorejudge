import { NextRequest, NextResponse } from "next/server";
import { setGame, getGame, removeGame, updateGame as updateMemoryGame } from "@/lib/store";
import { validateCSRF } from "@/lib/csrf";
import { getAuthToken } from "@/lib/auth-utils";
import { getGame as getDbGame, updateGame as updateDbGame, deleteGame as deleteDbGame, hideGameForUser, getUserByEmail } from "@/lib/db";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ gameId: string }> }
) {
    const { gameId } = await params;

    // 1. Check Memory first
    let cached = getGame(gameId);
    if (cached) {
        return NextResponse.json(cached);
    }

    // 2. Try to fetch from Supabase (requires auth)
    const token = await getAuthToken(req);

    if (!token) {
        return NextResponse.json({
            error: "Game not found in memory. Please sign in to load the game, or the game may not exist."
        }, { status: 404 });
    }

    try {
        const game = await getDbGame(gameId);

        if (!game) {
            return NextResponse.json({ error: "Game not found" }, { status: 404 });
        }

        // 3. Cache it
        setGame(gameId, game);

        return NextResponse.json(game);
    } catch (error: any) {
        console.error("Failed to fetch game:", error);
        return NextResponse.json({
            error: `Failed to load game: ${error?.message || 'Unknown error'}`
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

    const game = getGame(gameId) || await getDbGame(gameId);
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

    const { players, firstDealerEmail } = body;

    if (players) {
        if (players.length !== game.players.length) {
            return NextResponse.json({ error: "Invalid player list" }, { status: 400 });
        }
    }

    // Update Supabase
    await updateDbGame(gameId, { players, firstDealerEmail });

    // Update Memory
    const updatedGame = updateMemoryGame(gameId, { players, firstDealerEmail });

    // Broadcast
    if (updatedGame && (global as any).broadcastGameUpdate) {
        (global as any).broadcastGameUpdate(gameId, updatedGame);
    }

    return NextResponse.json({ success: true, game: updatedGame });
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
        // 1. Get game state
        let game = getGame(gameId) || await getDbGame(gameId);
        if (!game) {
            return NextResponse.json({ error: "Game not found" }, { status: 404 });
        }

        // 2. Get user
        const user = await getUserByEmail(token.email as string);
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // 3. Hide for this user instead of hard deleting
        await hideGameForUser(gameId, user.id);

        // 4. Remove from memory cache if they are the last one using it or if it's the owner
        // For simplicity, we just remove it from the specific user's view in dashboard next time they fetch

        return NextResponse.json({ success: true, message: "Game removed from your view" });
    } catch (e: any) {
        console.error("Error deleting game:", e);
        return NextResponse.json({
            error: `Failed to delete game: ${e?.message || 'Unknown error'}`
        }, { status: 500 });
    }
}
