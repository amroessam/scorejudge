import { NextRequest, NextResponse } from "next/server";
import { getGame, setGame } from "@/lib/store";
import { validateCSRF } from "@/lib/csrf";
import { getAuthToken } from "@/lib/auth-utils";
import { getGame as getDbGame, updateUser, getUserByEmail } from "@/lib/db";

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

    const { name, image } = body;
    if (!name && !image) {
        return NextResponse.json({ error: "Name or Image is required" }, { status: 400 });
    }

    let game = getGame(gameId) || await getDbGame(gameId);

    if (!game) {
        return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Check if game has started - name changes are only allowed before the game starts
    if (name && game.currentRoundIndex > 0) {
        return NextResponse.json({
            error: "Name cannot be changed after the game has started"
        }, { status: 400 });
    }

    // Update player in database (Users table)
    // Always lookup user by email to get the correct DB ID, avoiding session mismatch
    const user = await getUserByEmail(token.email as string);
    if (user) {
        await updateUser(user.id, {
            display_name: name || undefined,
            image: image || undefined
        });
    }

    // Update player in memory
    const playerIndex = game.players.findIndex(p => p.email === token.email);
    if (playerIndex !== -1) {
        if (name) game.players[playerIndex].name = name;
        if (image) game.players[playerIndex].image = image;
    }

    // Save to store
    setGame(gameId, game);

    // Broadcast update
    if ((global as any).broadcastGameUpdate) {
        (global as any).broadcastGameUpdate(gameId, game);
    }

    return NextResponse.json({ success: true, game });
}
