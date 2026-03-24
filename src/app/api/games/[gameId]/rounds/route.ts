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
    saveGamePlayerScores,
    updateGame as updateDbGame
} from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { withSpan, extractTraceContext } from "@/lib/tracing";

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
        const log = createLogger({ gameId });
        log.error('Unauthorized round update attempt');
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, inputs, targetRoundIndex } = body;

    return withSpan(
        `POST /api/games/{gameId}/rounds - ${action}`,
        extractTraceContext(token.email as string, token.id as string, gameId),
        async (span) => {
            span.setAttribute('http.method', 'POST');
            span.setAttribute('http.route', '/api/games/{gameId}/rounds');
            span.setAttribute('game.id', gameId);
            span.setAttribute('round.action', action);

            const log = createLogger({
                userId: token.id as string,
                userEmail: token.email as string,
                gameId,
                action
            });

            log.info({ action, targetRoundIndex }, 'Processing round action');

            let game = getGame(gameId) || await getDbGame(gameId);
            if (!game) {
                log.error('Game not found');
                return NextResponse.json({ error: "Game not found" }, { status: 404 });
            }

            span.setAttribute('game.name', game.name);
            span.setAttribute('game.currentRound', game.currentRoundIndex);
            span.setAttribute('game.playerCount', game.players.length);

            const isOwnerOrOperator = game.ownerEmail === token.email || game.operatorEmail === token.email;
            if (!isOwnerOrOperator) {
                log.warn({ ownerEmail: game.ownerEmail, operatorEmail: game.operatorEmail }, 'Forbidden: User is not owner or operator');
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }

            try {
                if (action === 'START') {
                    log.info({ playerCount: game.players.length }, 'Starting game');

                    if (game.players.length < 3) {
                        log.error({ playerCount: game.players.length }, 'Insufficient players to start game');
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

                        log.info({ totalRounds: rounds.length, playerCount: game.players.length }, 'Initializing rounds');
                        await initializeRounds(gameId, rounds, game.players);
                        game.rounds = rounds;
                        game.currentRoundIndex = 1;
                        await updateDbGame(gameId, { currentRoundIndex: 1 });
                        log.info({ roundsCreated: rounds.length }, 'Game started successfully');
                    } else if (game.currentRoundIndex === 0) {
                        game.currentRoundIndex = 1;
                        await updateDbGame(gameId, { currentRoundIndex: 1 });
                        log.info('Game resumed from round 1');
                    }

                    span.setAttribute('round.totalRounds', game.rounds.length);

                } else if (action === 'BIDS') {
                    const round = game.rounds.find(r => r.index === game.currentRoundIndex);
                    if (!round) {
                        log.error({ currentRoundIndex: game.currentRoundIndex }, 'Round not found');
                        return NextResponse.json({ error: "Round not found" }, { status: 404 });
                    }

                    span.setAttribute('round.index', round.index);
                    span.setAttribute('round.cards', round.cards);
                    span.setAttribute('round.trump', round.trump);

                    log.info({
                        roundIndex: round.index,
                        cards: round.cards,
                        trump: round.trump,
                        inputs
                    }, 'Submitting bids');

                    const validatedBids: Record<string, number> = {};
                    for (const p of game.players) {
                        const bid = inputs[p.email];
                        if (bid === undefined) {
                            log.error({ playerEmail: p.email, playerName: p.name }, 'Missing bid for player');
                            return NextResponse.json({ error: `Missing bid for ${p.name}` }, { status: 400 });
                        }
                        validatedBids[p.email] = Number(bid);
                    }

                    // Dealer constraint check
                    const sumBids = Object.values(validatedBids).reduce((a, b) => a + b, 0);
                    log.info({ sumBids, cards: round.cards, bids: validatedBids }, 'Validating dealer constraint');

                    if (sumBids === round.cards) {
                        log.warn({ sumBids, cards: round.cards }, 'Dealer constraint violated');
                        return NextResponse.json({ error: "Dealer constraint violated" }, { status: 400 });
                    }

                    await saveRoundBids(gameId, round.index, validatedBids, game.players, round.cards, round.trump);
                    round.bids = validatedBids;
                    round.state = 'PLAYING';
                    log.info({ bids: validatedBids }, 'Bids saved successfully');

                } else if (action === 'TRICKS') {
                    const round = game.rounds.find(r => r.index === game.currentRoundIndex);
                    if (!round) {
                        log.error({ currentRoundIndex: game.currentRoundIndex }, 'Round not found');
                        return NextResponse.json({ error: "Round not found" }, { status: 404 });
                    }

                    span.setAttribute('round.index', round.index);
                    span.setAttribute('round.cards', round.cards);

                    log.info({
                        roundIndex: round.index,
                        cards: round.cards,
                        bids: round.bids,
                        inputs
                    }, 'Submitting tricks');

                    const validatedTricks: Record<string, number> = {};
                    const points: Record<string, number> = {};
                    const cardsPerPlayer = round.cards;

                    // 1. Validation: for zero-bidders, at most cardsPerPlayer can miss
                    const zeroBidders = game.players.filter((p: Player) => round.bids[p.email] === 0);
                    const missedZeroBidders = zeroBidders.filter((p: Player) => inputs[p.email] === -1);

                    log.info({
                        zeroBiddersCount: zeroBidders.length,
                        missedZeroBiddersCount: missedZeroBidders.length,
                        maxAllowedMissed: round.cards
                    }, 'Validating zero-bidder constraints');

                    if (missedZeroBidders.length > round.cards) {
                        log.error({
                            missedCount: missedZeroBidders.length,
                            maxAllowed: round.cards
                        }, 'Too many zero-bidders marked as missed');
                        return NextResponse.json({
                            error: `Invalid input: at most ${round.cards} player(s) can miss when they bid 0 in this round.`
                        }, { status: 400 });
                    }

                    for (const p of game.players) {
                        const trick = inputs[p.email];
                        if (trick === undefined || trick === null || trick === '') {
                            log.error({ playerEmail: p.email, playerName: p.name }, 'Missing tricks for player');
                            return NextResponse.json({ error: `Missing tricks for ${p.name}` }, { status: 400 });
                        }
                        const numTrick = Number(trick);
                        validatedTricks[p.email] = numTrick;

                        const bid = round.bids[p.email];
                        if (bid === numTrick && numTrick !== -1) {
                            const roundPoints = bid + cardsPerPlayer;
                            points[p.email] = roundPoints;
                            p.score += roundPoints;
                            log.info({
                                playerEmail: p.email,
                                bid,
                                tricks: numTrick,
                                pointsEarned: roundPoints,
                                newScore: p.score
                            }, 'Player made their bid');
                        } else {
                            points[p.email] = 0;
                            if (numTrick !== -1) {
                                log.info({
                                    playerEmail: p.email,
                                    bid,
                                    tricks: numTrick
                                }, 'Player missed their bid');
                            }
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

                    log.info({
                        sumMadeBids,
                        remainingTricks,
                        missedPlayersCount: missedPlayers.length,
                        missedPlayers
                    }, 'Validating trick distribution');

                    if (!isDistributionPossible(remainingTricks, missedPlayers)) {
                        if (missedPlayers.length === 0) {
                            log.error({
                                cardsPerPlayer,
                                sumMadeBids
                            }, 'Invalid: All tricks must be accounted for');
                            return NextResponse.json({
                                error: `Invalid: All tricks (${cardsPerPlayer}) must be accounted for. Current sum is ${sumMadeBids}.`
                            }, { status: 400 });
                        }
                        log.error({
                            remainingTricks,
                            missedPlayers
                        }, 'Invalid distribution: Cannot split remaining tricks');
                        return NextResponse.json({
                            error: `Invalid distribution: The remaining ${remainingTricks} trick(s) cannot be split among missed players without someone hitting their bid.`
                        }, { status: 400 });
                    }

                    await saveRoundTricks(gameId, round.index, validatedTricks, points, game.players);
                    round.tricks = validatedTricks;
                    round.state = 'COMPLETED';

                    const finalRound = getFinalRoundNumber(game.players.length);
                    const isGameComplete = game.currentRoundIndex >= finalRound;

                    log.info({
                        tricks: validatedTricks,
                        points,
                        currentRound: game.currentRoundIndex,
                        finalRound,
                        isGameComplete
                    }, 'Tricks saved successfully');

                    if (game.currentRoundIndex < finalRound) {
                        game.currentRoundIndex += 1;
                        await updateDbGame(gameId, { currentRoundIndex: game.currentRoundIndex });
                        log.info({ newRoundIndex: game.currentRoundIndex }, 'Advanced to next round');
                    } else {
                        log.info({
                            finalScores: game.players.map(p => ({
                                name: p.name,
                                email: p.email,
                                score: p.score
                            }))
                        }, 'Game completed');
                    }

                    span.setAttribute('round.isGameComplete', isGameComplete);

                } else if (action === 'UNDO') {
                    const targetIdx = targetRoundIndex || game.currentRoundIndex;
                    const round = game.rounds.find(r => r.index === targetIdx);

                    if (!round) {
                        log.error({ targetRoundIndex: targetIdx }, 'Round not found for undo');
                        return NextResponse.json({ error: "Round not found" }, { status: 404 });
                    }

                    log.info({
                        targetRoundIndex: targetIdx,
                        currentState: round.state
                    }, 'Undoing round');

                    const initialState = round.state;

                    if (initialState === 'PLAYING') {
                        // Revert from PLAYING back to BIDDING
                        round.state = 'BIDDING';
                        round.bids = {};
                        round.tricks = {};

                        await supabaseAdmin
                            .from('rounds')
                            .update({ state: 'BIDDING' })
                            .eq('game_id', gameId)
                            .eq('round_index', targetIdx);

                        log.info({ roundIndex: targetIdx }, 'Reverted round from PLAYING to BIDDING');

                    } else if (initialState === 'COMPLETED') {
                        // Revert from COMPLETED back to PLAYING
                        const scoreChanges: any[] = [];

                        for (const p of game.players) {
                            const bid = round.bids[p.email];
                            const tricks = round.tricks[p.email];
                            if (bid !== undefined && tricks !== undefined && tricks !== -1 && bid === tricks) {
                                const pointsToRemove = bid + round.cards;
                                const oldScore = p.score;
                                p.score = Math.max(0, p.score - pointsToRemove);
                                scoreChanges.push({
                                    playerEmail: p.email,
                                    oldScore,
                                    newScore: p.score,
                                    pointsRemoved: pointsToRemove
                                });
                            }
                        }

                        // Batch update scores
                        await saveGamePlayerScores(gameId, game.players);

                        round.state = 'PLAYING';
                        round.tricks = {};

                        await supabaseAdmin
                            .from('rounds')
                            .update({ state: 'PLAYING' })
                            .eq('game_id', gameId)
                            .eq('round_index', targetIdx);

                        if (game.currentRoundIndex > targetIdx) {
                            game.currentRoundIndex = targetIdx;
                            await updateDbGame(gameId, { currentRoundIndex: targetIdx });
                        }

                        log.info({
                            roundIndex: targetIdx,
                            scoreChanges,
                            newCurrentRound: game.currentRoundIndex
                        }, 'Reverted round from COMPLETED to PLAYING');
                    }

                    span.setAttribute('round.undoFrom', initialState);
                }

                setGame(gameId, game);
                if ((global as any).broadcastGameUpdate) {
                    (global as any).broadcastGameUpdate(gameId, game);
                }

                log.info({
                    action,
                    currentRoundIndex: game.currentRoundIndex,
                    success: true
                }, 'Round action completed successfully');

                return NextResponse.json({ success: true, game });
            } catch (e: any) {
                log.error({
                    error: e.message,
                    stack: e.stack,
                    action,
                    inputs
                }, 'Round update error');
                span.setAttribute('error', true);
                return NextResponse.json({ error: e.message || "Failed to update round" }, { status: 500 });
            }
        }
    );
}
