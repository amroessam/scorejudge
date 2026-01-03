import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { setGame, getGame, type GameState, type Round, type Player } from "@/lib/store";
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

/**
 * Deep Validation: Checks if there exists ANY distribution of tricks across missed players
 * such that the total sum matches requiredTricks AND no missed player takes exactly their bid.
 */
function isDistributionPossible(
    requiredTricks: number,
    missedPlayers: { email: string; bid: number }[]
): boolean {
    if (missedPlayers.length === 0) {
        return requiredTricks === 0;
    }

    const [currentPlayer, ...rest] = missedPlayers;

    // A missed player can take anything from 0 to requiredTricks, 
    // as long as it's NOT their bid.
    for (let t = 0; t <= requiredTricks; t++) {
        if (t === currentPlayer.bid) continue; // Must be ≠ bid

        if (isDistributionPossible(requiredTricks - t, rest)) {
            return true;
        }
    }

    return false;
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

            // 1. Validation: for zero-bidders, at most cardsPerPlayer can miss
            const zeroBidders = game.players.filter((p: Player) => round.bids[p.email] === 0);
            const missedZeroBidders = zeroBidders.filter((p: Player) => inputs[p.email] === -1);
            if (missedZeroBidders.length > round.cards) {
                return NextResponse.json({
                    error: `Invalid input: at most ${round.cards} player(s) can miss when they bid 0 in this round.`
                }, { status: 400 });
            }

            for (const p of game.players) {
                const trick = inputs[p.email];
                if (trick === undefined || trick === null || trick === '') {
                    return NextResponse.json({ error: `Missing tricks for ${p.name}` }, { status: 400 });
                }
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

            // Deep validation for missed players
            const missedPlayers = game.players
                .filter((p: Player) => validatedTricks[p.email] === -1)
                .map((p: Player) => ({ email: p.email, bid: round.bids[p.email] ?? 0 }));

            const sumMadeBids = Object.entries(validatedTricks).reduce((sum, [email, tricks]) => {
                const bid = round.bids[email];
                if (bid !== undefined && tricks !== -1 && tricks === bid) {
                    return sum + tricks;
                }
                return sum;
            }, 0);

            const remainingTricks = cardsPerPlayer - sumMadeBids;

            if (!isDistributionPossible(remainingTricks, missedPlayers)) {
                if (missedPlayers.length === 0) {
                    return NextResponse.json({
                        error: `Invalid: All tricks (${cardsPerPlayer}) must be accounted for. Current sum is ${sumMadeBids}.`
                    }, { status: 400 });
                }
                return NextResponse.json({
                    error: `Invalid distribution: The remaining ${remainingTricks} trick(s) cannot be split among missed players without someone hitting their bid.`
                }, { status: 400 });
            }

            await saveRoundTricks(gameId, round.index, validatedTricks, points, game.players);
            round.tricks = validatedTricks;
            round.state = 'COMPLETED';

            const finalRound = getFinalRoundNumber(game.players.length);
            if (game.currentRoundIndex < finalRound) {
                game.currentRoundIndex += 1;
                await updateDbGame(gameId, { currentRoundIndex: game.currentRoundIndex });
            }
        } else if (action === 'UNDO') {
            const targetIdx = targetRoundIndex || game.currentRoundIndex;
            const round = game.rounds.find(r => r.index === targetIdx);

            if (!round) {
                return NextResponse.json({ error: "Round not found" }, { status: 404 });
            }

            console.log(`[Rounds API] Undoing round ${targetIdx}. Current state: ${round.state}`);
            const initialState = round.state;

            if (initialState === 'PLAYING') {
                // Revert from PLAYING back to BIDDING
                round.state = 'BIDDING';
                round.bids = {};
                round.tricks = {};

                // Update DB: Set round state to BIDDING
                await supabaseAdmin
                    .from('rounds')
                    .update({ state: 'BIDDING' })
                    .eq('game_id', gameId)
                    .eq('round_index', targetIdx);
            } else if (initialState === 'COMPLETED') {
                // Revert from COMPLETED back to PLAYING
                // 1. Revert scores for all players in this round
                for (const p of game.players) {
                    const bid = round.bids[p.email];
                    const tricks = round.tricks[p.email];
                    if (bid !== undefined && tricks !== undefined && tricks !== -1 && bid === tricks) {
                        const pointsToRemove = bid + round.cards;
                        p.score = Math.max(0, p.score - pointsToRemove);
                    }

                    // Update game_players score in DB
                    await supabaseAdmin
                        .from('game_players')
                        .update({ score: p.score })
                        .eq('game_id', gameId)
                        .eq('user_id', p.id);
                }

                // 2. Set round state back to PLAYING
                round.state = 'PLAYING';
                round.tricks = {};

                await supabaseAdmin
                    .from('rounds')
                    .update({ state: 'PLAYING' })
                    .eq('game_id', gameId)
                    .eq('round_index', targetIdx);

                // 3. Move currentRoundIndex back to this round if it was advanced
                if (game.currentRoundIndex > targetIdx) {
                    game.currentRoundIndex = targetIdx;
                    await updateDbGame(gameId, { currentRoundIndex: targetIdx });
                }
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
