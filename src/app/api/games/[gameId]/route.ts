import { NextRequest, NextResponse } from "next/server";
import { setGame, getGame, removeGame, updateGame as updateMemoryGame } from "@/lib/store";
import { validateCSRF } from "@/lib/csrf";
import { getAuthToken } from "@/lib/auth-utils";
import { getGame as getDbGame, updateGame as updateDbGame, deleteGame as deleteDbGame, hideGameForUser, getUserByEmail, removePlayerFromGame } from "@/lib/db";
import { DECK_SIZE } from "@/lib/config";

function getFinalRoundNumber(numPlayers: number): number {
    if (!numPlayers) return 12;
    const maxCards = Math.floor(DECK_SIZE / numPlayers);
    return maxCards * 2 - 1;
}

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
        console.log(`[DELETE] Game ${gameId}: Starting deletion for user ${token.email}`);

        // 1. Get game state
        let game = getGame(gameId) || await getDbGame(gameId);
        if (!game) {
            console.log(`[DELETE] Game ${gameId}: Not found`);
            return NextResponse.json({ error: "Game not found" }, { status: 404 });
        }

        console.log(`[DELETE] Game ${gameId}: Found. Owner: ${game.ownerEmail}, Players: ${game.players.map(p => p.email).join(', ')}`);

        // 2. Get user
        const user = await getUserByEmail(token.email as string);
        if (!user) {
            console.log(`[DELETE] Game ${gameId}: User ${token.email} not found in database`);
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        console.log(`[DELETE] Game ${gameId}: User found. ID: ${user.id}, Email: ${user.email}`);

        const isOwner = game.ownerEmail === token.email;

        // Determine if game is actually completed (final round is completed)
        const finalRoundNumber = getFinalRoundNumber(game.players.length);
        const isCompleted = game.rounds.some(r => r.state === 'COMPLETED' && r.index >= finalRoundNumber);

        console.log(`[DELETE] Game ${gameId}: isOwner=${isOwner}, isCompleted=${isCompleted}, currentRound=${game.currentRoundIndex}, finalRound=${finalRoundNumber}, totalRounds=${game.rounds.length}`);

        if (isCompleted) {
            // Soft delete: Hide for this user but keep data for history/leaderboard
            console.log(`[DELETE] Game ${gameId}: Soft deleting (hiding) for user ${user.id}`);
            await hideGameForUser(gameId, user.id);
            return NextResponse.json({ success: true, message: "Game hidden from your view" });
        } else {
            // Incomplete game logic
            if (isOwner) {
                // Hard delete: Remove for everyone if host deletes incomplete game
                console.log(`[DELETE] Game ${gameId}: Owner hard-deleting game`);
                await deleteDbGame(gameId);
                removeGame(gameId); // Clear from memory store
                return NextResponse.json({ success: true, message: "Game deleted for all players" });
            } else {
                // Leave game: Remove this player from the game
                console.log(`[DELETE] Game ${gameId}: Player ${user.id} leaving game`);
                await removePlayerFromGame(gameId, user.id);

                // Update memory store if game is cached
                const memGame = getGame(gameId);
                if (memGame && memGame.players) {
                    memGame.players = memGame.players.filter(p => p.id !== user.id);
                    setGame(gameId, memGame);
                    // Broadcast update to other players so they see someone left
                    if ((global as any).broadcastGameUpdate) {
                        (global as any).broadcastGameUpdate(gameId, memGame);
                    }
                }

                return NextResponse.json({ success: true, message: "You have left the game" });
            }
        }
    } catch (e: any) {
        console.error(`[DELETE] Game ${gameId}: Error - ${e?.message}`, e);
        return NextResponse.json({
            error: `Failed to process game deletion: ${e?.message || 'Unknown error'}`
        }, { status: 500 });
    }
}
