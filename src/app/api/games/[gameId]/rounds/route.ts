import { NextRequest, NextResponse } from "next/server";
import { setGame, getGame, GameState, Round } from "@/lib/store";
import { validateCSRF } from "@/lib/csrf";
import { getAuthToken } from "@/lib/auth-utils";
import { DECK_SIZE } from "@/lib/config";
import {
    getGame as getDbGame,
    initializeRounds,
    saveRoundBids,
    saveRoundTricks,
    updateGame as updateDbGame
} from "@/lib/db";

// Helper to calc round plan
function getRoundPlan(numPlayers: number): { cards: number, trump: string }[] {
    const maxCards = Math.floor(DECK_SIZE / numPlayers);
    const rounds: { cards: number, trump: string }[] = [];
    const TRUMPS = ['S', 'D', 'C', 'H', 'NT'];

    for (let i = maxCards; i >= 1; i--) rounds.push({ cards: i, trump: '' });
    for (let i = 2; i <= maxCards; i++) rounds.push({ cards: i, trump: '' });

    return rounds.map((r, i) => ({ ...r, trump: TRUMPS[i % 5] }));
}

function getFinalRoundNumber(numPlayers: number): number {
    const maxCards = Math.floor(DECK_SIZE / numPlayers);
    return maxCards * 2 - 1;
}

function getDealerIndex(roundIndex: number, numPlayers: number): number {
    return (roundIndex - 1) % numPlayers;
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ gameId: string }> }
) {
    if (!validateCSRF(req)) {
        return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
    }

    const { gameId } = await params;
    const token = await getAuthToken(req);

    if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, inputs, targetRoundIndex } = body;

    let game = getGame(gameId) || await getDbGame(gameId);
    if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

    const isOwnerOrOperator = game.ownerEmail === token.email || game.operatorEmail === token.email;
    if (!isOwnerOrOperator) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        if (action === 'START') {
            if (game.players.length < 3) {
                return NextResponse.json({ error: "Minimum 3 players required" }, { status: 400 });
            }

            if (game.rounds.length === 0) {
                const plan = getRoundPlan(game.players.length);
                const rounds: Round[] = plan.map((p, i) => ({
                    index: i + 1,
                    cards: p.cards,
                    trump: p.trump,
                    state: 'BIDDING',
                    bids: {},
                    tricks: {}
                }));

                await initializeRounds(gameId, rounds, game.players);
                game.rounds = rounds;
                game.currentRoundIndex = 1;
                await updateDbGame(gameId, { currentRoundIndex: 1 });
            } else if (game.currentRoundIndex === 0) {
                game.currentRoundIndex = 1;
                await updateDbGame(gameId, { currentRoundIndex: 1 });
            }
        } else if (action === 'BIDS') {
            const round = game.rounds.find(r => r.index === game.currentRoundIndex);
            if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });

            const validatedBids: Record<string, number> = {};
            for (const p of game.players) {
                const bid = inputs[p.email];
                if (bid === undefined) return NextResponse.json({ error: `Missing bid for ${p.name}` }, { status: 400 });
                validatedBids[p.email] = Number(bid);
            }

            // Dealer constraint check (simplified here, but should match previous logic)
            const sumBids = Object.values(validatedBids).reduce((a, b) => a + b, 0);
            if (sumBids === round.cards) {
                return NextResponse.json({ error: "Dealer constraint violated" }, { status: 400 });
            }

            await saveRoundBids(gameId, round.index, validatedBids, game.players, round.cards, round.trump);
            round.bids = validatedBids;
            round.state = 'PLAYING';
        } else if (action === 'TRICKS') {
            const round = game.rounds.find(r => r.index === game.currentRoundIndex);
            if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });

            const validatedTricks: Record<string, number> = {};
            const points: Record<string, number> = {};
            const cardsPerPlayer = round.cards;

            for (const p of game.players) {
                const trick = inputs[p.email];
                if (trick === undefined) return NextResponse.json({ error: `Missing tricks for ${p.name}` }, { status: 400 });
                const numTrick = Number(trick);
                validatedTricks[p.email] = numTrick;

                const bid = round.bids[p.email];
                if (bid === numTrick && numTrick !== -1) {
                    const roundPoints = bid + cardsPerPlayer;
                    points[p.email] = roundPoints;
                    p.score += roundPoints;
                } else {
                    points[p.email] = 0;
                }
            }

            await saveRoundTricks(gameId, round.index, validatedTricks, points, game.players);
            round.tricks = validatedTricks;
            round.state = 'COMPLETED';

            const finalRound = getFinalRoundNumber(game.players.length);
            if (game.currentRoundIndex < finalRound) {
                game.currentRoundIndex += 1;
                await updateDbGame(gameId, { currentRoundIndex: game.currentRoundIndex });
            }
        }

        setGame(gameId, game);
        if ((global as any).broadcastGameUpdate) {
            (global as any).broadcastGameUpdate(gameId, game);
        }

        return NextResponse.json({ success: true, game });
    } catch (e: any) {
        console.error("Round update error:", e);
        return NextResponse.json({ error: e.message || "Failed to update round" }, { status: 500 });
    }
}
