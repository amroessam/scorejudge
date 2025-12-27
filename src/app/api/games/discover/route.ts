import { NextRequest, NextResponse } from "next/server";
import { getAllGames, type GameState } from "@/lib/store";
import { getAuthToken } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
    const token = await getAuthToken(req);

    if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const userEmail = token.email as string;
        const allGames = getAllGames();

        // Deduplicate games by their actual game.id (sheet ID)
        // Games can be stored with both temp ID key and real sheet ID key in the Map,
        // but both entries will have the same game.id value (the real sheet ID)
        const gamesById = new Map<string, GameState>();
        for (const game of allGames) {
            const actualGameId = game.id; // This is the real sheet ID
            // If we already have this game by its actual ID, skip duplicates
            if (!gamesById.has(actualGameId)) {
                gamesById.set(actualGameId, game);
            }
        }

        // Filter games that:
        // 1. Haven't started (currentRoundIndex === 0)
        // 2. User hasn't joined (not in players list)
        // 3. Not full (less than 12 players)
        // 4. Not a temp ID (only show games with real sheet IDs)
        const discoverableGames = Array.from(gamesById.values())
            .filter(game => {
                // Skip temp IDs - only show games with real sheet IDs
                if (game.id.startsWith('temp_')) {
                    return false;
                }

                // Only show games that haven't started
                if (game.currentRoundIndex > 0) {
                    return false;
                }

                // Filter out games user has already joined
                const hasJoined = game.players?.some(p => p.email === userEmail) || false;
                if (hasJoined) {
                    return false;
                }

                // Filter out full games
                const playerCount = game.players?.length || 0;
                if (playerCount >= 12) {
                    return false;
                }

                return true;
            })
            .map(game => ({
                id: game.id,
                name: game.name,
                ownerEmail: game.ownerEmail,
                playerCount: game.players?.length || 0,
                createdAt: game.createdAt || game.lastUpdated, // Fallback to lastUpdated for backwards compatibility
            }))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); // Sort by created date descending

        return NextResponse.json(discoverableGames);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch discoverable games" }, { status: 500 });
    }
}

