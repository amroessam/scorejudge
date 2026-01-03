import { NextRequest, NextResponse } from "next/server";
import { setGame, getGame } from "@/lib/store";
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
    let game = getGame(gameId) || await getDbGame(gameId);
    if (!game) {
        return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // 2. Check if already joined
    if (game.players.some(p => p.email === token.email)) {
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
