import { NextRequest, NextResponse } from "next/server";
import { setGame, getGame, type GameState, type Player } from "@/lib/store";
import { validateCSRF } from "@/lib/csrf";
import { getAuthToken } from "@/lib/auth-utils";
import { getGame as getDbGame, addPlayer, getUserByEmail, upsertUser } from "@/lib/db";

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
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Get Game State
    let game: GameState | null | undefined = getGame(gameId);

    // If not in memory, check if it's a temp ID (not yet synced to DB)
    if (!game && gameId.startsWith('temp_')) {
        return NextResponse.json({
            error: "Game is still being created. Please wait a moment and try again."
        }, { status: 404 });
    }

    // If still not found, try to fetch from Supabase
    if (!game) {
        game = await getDbGame(gameId);
    }

    if (!game) {
        return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // 2. Check if already joined
    if (game.players.some((p: Player) => p.email === token.email)) {
        return NextResponse.json({ message: "Already joined", game });
    }

    // 3. Validate maximum players
    if (game.players.length >= 12) {
        return NextResponse.json({ error: "Game is full" }, { status: 400 });
    }

    // 4. Ensure user exists in Supabase
    let user = await getUserByEmail(token.email as string);
    if (!user) {
        user = await upsertUser({
            id: token.id as string, // Pass the user ID from token
            email: token.email as string,
            name: token.name as string,
            image: token.picture as string,
            google_sub: token.sub as string
        });
    }

    if (!user) {
        return NextResponse.json({ error: "Failed to sync user" }, { status: 500 });
    }

    // 5. Add to Supabase
    const success = await addPlayer(gameId, user.id, game.players.length);
    if (!success) {
        return NextResponse.json({ error: "Failed to join game in database" }, { status: 500 });
    }

    // 6. Update Memory
    const newPlayer = {
        id: user.id,
        name: user.display_name || user.name || 'Unknown',
        email: user.email,
        score: 0,
        bid: 0,
        tricks: 0,
        playerOrder: game.players.length,
        image: user.image
    };

    game.players.push(newPlayer);
    setGame(gameId, game);

    // Broadcast
    if ((global as any).broadcastGameUpdate) {
        (global as any).broadcastGameUpdate(gameId, game);
    }

    return NextResponse.json({ success: true, game });
}
