import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getGoogleFromToken } from "@/lib/google";
import { setGame, getGame, GameState, getSheetIdFromTempId } from "@/lib/store";
import { google } from "googleapis";

// Helper to calc round plan
function getRoundPlan(numPlayers: number): { cards: number, trump: string }[] {
    // 6 cards
    const maxCards = Math.floor(6 / numPlayers);
    const rounds: { cards: number, trump: string }[] = [];
    const TRUMPS = ['S', 'D', 'C', 'H', 'NT'];

    // Down: maxCards..1 (start with max cards and decrease)
    for (let i = maxCards; i >= 1; i--) rounds.push({ cards: i, trump: '' });
    // Up: 1..maxCards (then increase back up, including 1 again to reach final round = maxCards * 2)
    for (let i = 1; i <= maxCards; i++) rounds.push({ cards: i, trump: '' });

    // Assign trumps (starting with Spades for round 1)
    return rounds.map((r, i) => ({ ...r, trump: TRUMPS[i % 5] }));
}

// Helper to calculate final round number
// Final round = (6 / numberOfPlayers) * 2 (integer division)
function getFinalRoundNumber(numPlayers: number): number {
    return Math.floor(6 / numPlayers) * 2;
}

// Helper to get dealer index for a round
function getDealerIndex(roundIndex: number, numPlayers: number): number {
    return (roundIndex - 1) % numPlayers;
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ gameId: string }> }
) {
    const { gameId } = await params;
    
    // Try to get token with better error handling
    let token;
    try {
        token = await getToken({ 
            req, 
            secret: process.env.NEXTAUTH_SECRET,
            cookieName: process.env.NODE_ENV === 'production' 
                ? '__Secure-next-auth.session-token' 
                : 'next-auth.session-token'
        });
    } catch (e) {
        console.error('Error getting token:', e);
        return NextResponse.json({ error: "Authentication error" }, { status: 401 });
    }
    
    if (!token) {
        const cookies = req.cookies.getAll();
        console.error('No token found. Available cookies:', cookies.map(c => c.name));
        console.error('Looking for cookie:', process.env.NODE_ENV === 'production' 
            ? '__Secure-next-auth.session-token' 
            : 'next-auth.session-token');
        return NextResponse.json({ error: "Unauthorized - Please sign in again" }, { status: 401 });
    }

    const body = await req.json();
    const { action, inputs, targetRoundIndex } = body;
    // action: START | BIDS | TRICKS | UNDO

    // Resolve temp ID to real sheet ID if needed
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
    if (!game) return NextResponse.json({ error: "Game not loaded" }, { status: 404 });

    // Check Operator
    if (game.ownerEmail !== token.email) {
        // Allow if operator logic added, for now assume owner ok
        // return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let sheets: any = null;
    try {
        const auth = getGoogleFromToken(token);
        sheets = google.sheets({ version: 'v4', auth });
    } catch (e) {
        console.error("Failed to initialize Google Sheets client:", e);
        // Continue without Google Sheets - game will work in memory only
    }

    try {
        if (action === 'START') {
            // Validate minimum players (3)
            if (game.players.length < 3) {
                return NextResponse.json({ 
                    error: `Cannot start game. Minimum 3 players required. Currently ${game.players.length} player(s).` 
                }, { status: 400 });
            }

            // Check if game has ended (final round completed)
            const finalRoundNumber = getFinalRoundNumber(game.players.length);
            const completedRounds = game.rounds.filter((r: any) => r.state === 'COMPLETED');
            const lastCompletedRound = completedRounds.length > 0 
                ? Math.max(...completedRounds.map((r: any) => r.index))
                : 0;
            
            if (lastCompletedRound >= finalRoundNumber) {
                return NextResponse.json({ 
                    error: `Game has ended. Final round (${finalRoundNumber}) has been completed.` 
                }, { status: 400 });
            }

            // Check if we're trying to start a round beyond the final round
            // When rounds are empty, we'll initialize starting from round 1, so this check is mainly for safety
            if (game.currentRoundIndex > finalRoundNumber) {
                return NextResponse.json({ 
                    error: `Cannot start round. Game ends after round ${finalRoundNumber}.` 
                }, { status: 400 });
            }

            // Init rounds if empty
            if (!game.rounds || game.rounds.length === 0) {
                const plan = getRoundPlan(game.players.length);
                game.rounds = plan.map((p, i) => ({
                    index: i + 1,
                    cards: p.cards,
                    trump: p.trump,
                    state: 'BIDDING',
                    bids: {},
                    tricks: {}
                }));

                // Write Round definitions to Sheet
                // We'd batch update Rounds!A:E
                // For speed verify logic later.
                // Just update memory state
                game.currentRoundIndex = 1;

                // Update Current Round in Google Sheet (fire-and-forget)
                if (sheets && !actualGameId.startsWith('temp_')) {
                    sheets.spreadsheets.values.update({
                        spreadsheetId: actualGameId,
                        range: 'Game!B5', // Current Round row
                        valueInputOption: 'USER_ENTERED',
                        requestBody: {
                            values: [['1']]
                        }
                    }).catch((e: any) => {
                        console.error("Failed to update current round in sheet (continuing anyway):", e);
                    });
                }

                // Write plan to 'Rounds' tab (if Google Sheets is available and not temp ID)
                if (sheets && !actualGameId.startsWith('temp_')) {
                    try {
                        const values = game.rounds.map(r => [r.index, r.cards, r.trump, 'BIDDING', '']);
                        await sheets.spreadsheets.values.update({
                            spreadsheetId: actualGameId,
                            range: 'Rounds!A2:E' + (values.length + 1),
                            valueInputOption: 'USER_ENTERED',
                            requestBody: { values }
                        });
                    } catch (e) {
                        console.error("Failed to write rounds to sheet:", e);
                        // Continue - game state is updated in memory
                    }
                }
            }
        } else if (action === 'BIDS') {
            const round = game.rounds.find(r => r.index === game.currentRoundIndex);
            if (!round) {
                return NextResponse.json({ error: "Round not found" }, { status: 404 });
            }

            // Convert inputs to numbers and validate
            const validatedInputs: Record<string, number> = {};
            const dealerIndex = getDealerIndex(round.index, game.players.length);
            
            // Reorder players for bidding: dealer goes last
            const biddingOrder = [
                ...game.players.slice(0, dealerIndex),
                ...game.players.slice(dealerIndex + 1),
                game.players[dealerIndex] // Dealer at the end
            ];

            const bids: number[] = [];
            for (const p of biddingOrder) {
                const bid = inputs[p.email];
                if (bid === undefined || bid === null || bid === '') {
                    return NextResponse.json({ error: `Missing bid for ${p.name}` }, { status: 400 });
                }
                const numBid = typeof bid === 'string' ? parseInt(bid, 10) : Number(bid);
                if (isNaN(numBid) || numBid < 0) {
                    return NextResponse.json({ error: `Invalid bid for ${p.name}: must be a non-negative number` }, { status: 400 });
                }
                // Check if bid exceeds cards per player
                if (numBid > round.cards) {
                    return NextResponse.json({ 
                        error: `${p.name} cannot bid ${numBid}. Maximum bid is ${round.cards} (cards dealt per player).` 
                    }, { status: 400 });
                }
                validatedInputs[p.email] = numBid;
                bids.push(numBid);
            }

            // Validate dealer constraint: sum of bids must NOT equal cards per player
            const sumBids = bids.reduce((sum: number, b: number) => sum + b, 0);
            if (sumBids === round.cards) {
                const dealer = game.players[dealerIndex];
                return NextResponse.json({ 
                    error: `Dealer (${dealer.name}) must bid such that total bids do not equal ${round.cards}. Current total: ${sumBids}` 
                }, { status: 400 });
            }

            round.bids = validatedInputs;
            round.state = 'PLAYING';

            // Update Rounds sheet - mark round as PLAYING (fire-and-forget)
            if (sheets && !actualGameId.startsWith('temp_')) {
                sheets.spreadsheets.values.update({
                    spreadsheetId: actualGameId,
                    range: `Rounds!D${round.index + 1}`, // State column for this round
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [['PLAYING']]
                    }
                }).catch((e: any) => {
                    console.error("Failed to update round state to PLAYING in sheet (continuing anyway):", e);
                });
            }

            // Don't write bids to Scores sheet - we'll write everything when tricks are submitted
            // This prevents duplicate rows with empty values

            // Also update Rounds sheet state to PLAYING
            // Find row index? Hard without scanning. 
            // We'll trust memory for state mostly.
        } else if (action === 'TRICKS') {
            const round = game.rounds.find(r => r.index === game.currentRoundIndex);
            if (!round) {
                return NextResponse.json({ error: "Round not found" }, { status: 404 });
            }

            // Convert inputs to numbers and validate
            // -1 means player didn't make their bid (we don't care about actual tricks)
            const validatedInputs: Record<string, number> = {};
            const tricks: number[] = [];

            for (const p of game.players) {
                const trick = inputs[p.email];
                if (trick === undefined || trick === null || trick === '') {
                    return NextResponse.json({ error: `Missing tricks for ${p.name}` }, { status: 400 });
                }
                const numTrick = typeof trick === 'string' ? parseInt(trick, 10) : Number(trick);
                // Allow -1 for missed bids, otherwise must be non-negative
                if (isNaN(numTrick) || (numTrick < 0 && numTrick !== -1)) {
                    return NextResponse.json({ error: `Invalid tricks for ${p.name}: must be a non-negative number (or -1 for missed bid)` }, { status: 400 });
                }
                validatedInputs[p.email] = numTrick;
                tricks.push(numTrick);
            }

            // Validate that sum of tricks for players who made their bids doesn't exceed total tricks available
            const cardsPerPlayer = round.cards; // This represents total tricks in the round
            let sumMadeBids = 0;
            const madeBidPlayers: string[] = [];
            const zeroBidPlayersMarkedMissed: any[] = [];
            
            game.players.forEach((p: any) => {
                const bid = round.bids[p.email];
                const tricksValue = validatedInputs[p.email];
                // Check if player made their bid (tricks equals bid and tricks is not -1)
                if (bid !== undefined && tricksValue !== undefined && tricksValue !== -1 && bid === tricksValue) {
                    sumMadeBids += tricksValue;
                    madeBidPlayers.push(p.name);
                }
                // Track players who bid 0 but are marked as missed
                if (bid === 0 && tricksValue === -1) {
                    zeroBidPlayersMarkedMissed.push(p);
                }
            });

            // Track players who bid 0 and are marked as made, and check if any players missed their bids
            const zeroBidPlayersMarkedMade: any[] = [];
            let hasMissedBids = false;
            game.players.forEach((p: any) => {
                const bid = round.bids[p.email];
                const tricksValue = validatedInputs[p.email];
                if (bid === 0 && tricksValue === 0) {
                    zeroBidPlayersMarkedMade.push(p);
                } else if (bid !== undefined && tricksValue === -1) {
                    // Track if any player missed their bid
                    hasMissedBids = true;
                }
            });

            // If all tricks are taken by players who made their bids, players who bid 0 MUST have made their bid
            if (sumMadeBids === cardsPerPlayer && zeroBidPlayersMarkedMissed.length > 0) {
                const playerNames = zeroBidPlayersMarkedMissed.map(p => p.name).join(', ');
                return NextResponse.json({ 
                    error: `Invalid: All ${cardsPerPlayer} tricks have been taken by players who made their bids. Players who bid 0 (${playerNames}) must have made their bid (took 0 tricks). Please mark them as Made (✓) instead of Missed (X).` 
                }, { status: 400 });
            }

            if (sumMadeBids > cardsPerPlayer) {
                return NextResponse.json({ 
                    error: `Invalid: The sum of tricks for players who made their bids (${sumMadeBids}) exceeds the total tricks available (${cardsPerPlayer}). Players who made their bids: ${madeBidPlayers.join(', ')}. At least one of these players must have missed their bid.` 
                }, { status: 400 });
            }

            // If ALL players are marked as made (no one missed) and sum doesn't equal total, it's invalid
            if (!hasMissedBids && sumMadeBids !== cardsPerPlayer) {
                const unaccountedTricks = cardsPerPlayer - sumMadeBids;
                return NextResponse.json({ 
                    error: `Invalid: All players are marked as Made, but only ${sumMadeBids} out of ${cardsPerPlayer} tricks are accounted for. There are ${unaccountedTricks} unaccounted trick(s). At least one player must have missed their bid to account for these tricks.` 
                }, { status: 400 });
            }

            round.tricks = validatedInputs;
            round.state = 'COMPLETED';

            // Compute Scores
            // Points = bid + cardsPerPlayer (not bid + totalCardsDealt)
            // cardsPerPlayer is already defined above for validation

            // Update Players Scores
            // -1 means player didn't make their bid, so they get 0 points
            game.players.forEach(p => {
                const bid = round.bids[p.email];
                const tricks = round.tricks[p.email];
                // Only score if tricks is defined, not -1, and equals bid
                if (bid !== undefined && tricks !== undefined && tricks !== -1 && bid === tricks) {
                    p.score += (bid + cardsPerPlayer);
                }
            });

            // Update Rounds sheet - mark round as COMPLETED (fire-and-forget)
            if (sheets && !actualGameId.startsWith('temp_')) {
                const completedAt = new Date().toISOString();
                sheets.spreadsheets.values.update({
                    spreadsheetId: actualGameId,
                    range: `Rounds!D${round.index + 1}:E${round.index + 1}`, // State and Completed At columns for this round
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [['COMPLETED', completedAt]]
                    }
                }).catch((e: any) => {
                    console.error("Failed to update round state in sheet (continuing anyway):", e);
                });
            }

            // Check if this was the final round
            const finalRoundNumber = getFinalRoundNumber(game.players.length);
            const isGameEnded = round.index >= finalRoundNumber;
            
            if (isGameEnded) {
                // Game has ended - don't advance to next round
                // currentRoundIndex stays at the final round
                
                // Update Google Sheet game status and mark all completed rounds as COMPLETED (fire-and-forget)
                if (sheets && !actualGameId.startsWith('temp_')) {
                    // Update game status
                    sheets.spreadsheets.values.update({
                        spreadsheetId: actualGameId,
                        range: 'Game!B4:B5', // Status and Current Round rows
                        valueInputOption: 'USER_ENTERED',
                        requestBody: {
                            values: [
                                ['COMPLETED'], // Status
                                [round.index.toString()] // Current Round (final round)
                            ]
                        }
                    }).catch((e: any) => {
                        console.error("Failed to update game status in sheet (continuing anyway):", e);
                    });

                    // Mark all rounds up to final round as COMPLETED in Rounds sheet
                    const completedAt = new Date().toISOString();
                    // Update all rounds from 1 to final round
                    for (let i = 1; i <= round.index; i++) {
                        const r = game.rounds.find((r: any) => r.index === i);
                        const timestamp = i === round.index ? completedAt : '';
                        sheets.spreadsheets.values.update({
                            spreadsheetId: actualGameId,
                            range: `Rounds!D${i + 1}:E${i + 1}`,
                            valueInputOption: 'USER_ENTERED',
                            requestBody: {
                                values: [['COMPLETED', timestamp]]
                            }
                        }).catch((e: any) => {
                            console.error(`Failed to update round ${i} state in sheet (continuing anyway):`, e);
                        });
                    }

                    // Sync all players to Players sheet
                    const playerRows = game.players.map((p: any) => [p.id, p.name, p.email]);
                    if (playerRows.length > 0) {
                        // Clear existing players (except header) and write all players
                        sheets.spreadsheets.values.clear({
                            spreadsheetId: actualGameId,
                            range: 'Players!A2:C'
                        }).then(() => {
                            sheets.spreadsheets.values.update({
                                spreadsheetId: actualGameId,
                                range: `Players!A2:C${playerRows.length + 1}`,
                                valueInputOption: 'USER_ENTERED',
                                requestBody: {
                                    values: playerRows
                                }
                            }).catch((e: any) => {
                                console.error("Failed to sync players to sheet (continuing anyway):", e);
                            });
                        }).catch((e: any) => {
                            console.error("Failed to clear players sheet (continuing anyway):", e);
                        });
                    }
                }
            } else {
                // Safety check: ensure we don't advance beyond final round
                const finalRoundNumberCheck = getFinalRoundNumber(game.players.length);
                if (round.index < finalRoundNumberCheck) {
                    game.currentRoundIndex += 1; // Advance to next round
                    
                    // Double-check we're not going beyond final round
                    if (game.currentRoundIndex > finalRoundNumberCheck) {
                        game.currentRoundIndex = finalRoundNumberCheck;
                    }
                    
                    // Update Current Round in Google Sheet (fire-and-forget)
                    if (sheets && !actualGameId.startsWith('temp_')) {
                        sheets.spreadsheets.values.update({
                            spreadsheetId: actualGameId,
                            range: 'Game!B5', // Current Round row
                            valueInputOption: 'USER_ENTERED',
                            requestBody: {
                                values: [[game.currentRoundIndex.toString()]]
                            }
                        }).catch((e: any) => {
                            console.error("Failed to update current round in sheet (continuing anyway):", e);
                        });
                    }
                }
                // If round.index >= finalRoundNumberCheck, game has ended (handled above)
            }

            // Write Tricks/Scores to Sheet (if Google Sheets is available)
            // Fire and forget - don't block the response
            if (sheets) {
                const rows: any[] = [];
                // cardsPerPlayer is already defined above
                for (const p of game.players) {
                    const bid = round.bids[p.email];
                    const tricks = round.tricks[p.email];
                    let points = 0;
                    // Only score if tricks is not -1 and equals bid
                    if (tricks !== undefined && tricks !== -1 && bid === tricks) {
                        points = bid + cardsPerPlayer;
                    }

                    rows.push([round.index, p.email, bid, tricks === -1 ? '' : tricks, points, p.score]);
                }

                // Don't await - let it run in background (only if not temp ID)
                if (!actualGameId.startsWith('temp_')) {
                    sheets.spreadsheets.values.append({
                        spreadsheetId: actualGameId,
                        range: 'Scores!A:F',
                        valueInputOption: 'USER_ENTERED',
                        requestBody: { values: rows }
                    }).catch((e: any) => {
                        console.error("Failed to write scores to sheet:", e);
                        // Continue - game state is updated in memory
                    });
                }
            }
        } else if (action === 'UNDO') {
            // Undo: Reset current round to BIDDING state (beginning of round)
            if (!targetRoundIndex || targetRoundIndex < 1) {
                return NextResponse.json({ error: "Invalid target round index" }, { status: 400 });
            }

            // Only undo the current round (targetRoundIndex should equal currentRoundIndex)
            if (targetRoundIndex !== game.currentRoundIndex) {
                return NextResponse.json({ error: "Can only undo current round" }, { status: 400 });
            }

            const targetRound = game.rounds.find((r: any) => r.index === targetRoundIndex);
            if (!targetRound) {
                return NextResponse.json({ error: "Target round not found" }, { status: 404 });
            }

            // Revert scores: Remove points from current round only
            game.players.forEach((p: any) => {
                let scoreToRevert = 0;
                
                // Only remove points from the current round if it was completed
                if (targetRound.state === 'COMPLETED') {
                    const bid = targetRound.bids?.[p.email];
                    const tricks = targetRound.tricks?.[p.email];
                    if (bid !== undefined && tricks !== undefined && tricks !== -1 && bid === tricks) {
                        scoreToRevert = bid + targetRound.cards;
                    }
                }
                
                p.score = Math.max(0, p.score - scoreToRevert);
            });

            // Reset current round to BIDDING state (clear bids and tricks)
            game.rounds = game.rounds.map((r: any) => {
                if (r.index === targetRoundIndex) {
                    return {
                        ...r,
                        state: 'BIDDING',
                        bids: {},
                        tricks: {}
                    };
                }
                return r;
            });

            // currentRoundIndex stays the same - we're just resetting the round

            // Update Google Sheet if available (fire-and-forget)
            if (sheets && !actualGameId.startsWith('temp_')) {
                // Update round state in Rounds sheet
                sheets.spreadsheets.values.update({
                    spreadsheetId: actualGameId,
                    range: `Rounds!D${targetRoundIndex + 1}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [['BIDDING']]
                    }
                }).catch((err: any) => {
                    console.error(`Failed to update round ${targetRoundIndex} state:`, err);
                });
            }
        }

        // Update game state with both IDs if they differ (temp ID -> real ID mapping)
        setGame(actualGameId, game);
        if (actualGameId !== gameId) {
            setGame(gameId, game); // Also keep temp ID mapping
        }
        if ((global as any).broadcastGameUpdate) {
            (global as any).broadcastGameUpdate(gameId, game);
            if (actualGameId !== gameId) {
                (global as any).broadcastGameUpdate(actualGameId, game);
            }
        }
        return NextResponse.json({ success: true, game });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Failed to update round" }, { status: 500 });
    }
}
