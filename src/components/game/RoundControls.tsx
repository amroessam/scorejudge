"use client";

import { useState } from "react";
import { Loader2, Check, X } from "lucide-react";

// Helper function to convert trump abbreviation to full text
function getTrumpFullName(trump: string): string {
    const trumpMap: Record<string, string> = {
        'S': 'Spades',
        'D': 'Diamonds',
        'C': 'Clubs',
        'H': 'Hearts',
        'NT': 'No Trump'
    };
    return trumpMap[trump] || trump || 'No Trump';
}

// Helper to calculate final round number
// Final round = (52 / numberOfPlayers) * 2 (integer division)
function getFinalRoundNumber(numPlayers: number): number {
    return Math.floor(52 / numPlayers) * 2;
}

export function RoundControls({ gameId, gameState, isOperator, onGameUpdate }: { gameId: string, gameState: any, isOperator: boolean, onGameUpdate?: (game: any) => void }) {
    const [loading, setLoading] = useState(false);

    // Find active round
    const currentRoundIndex = gameState.currentRoundIndex || 1;
    // Round 1 logic is separate from others?
    // We assume rounds are 1-indexed.

    // Check if we need to start/init rounds
    const rounds = gameState.rounds || [];
    const activeRound = rounds.find((r: any) => r.index === currentRoundIndex);
    
    // Check if game has ended
    const numPlayers = gameState.players?.length || 0;
    const finalRoundNumber = getFinalRoundNumber(numPlayers);
    const completedRounds = rounds.filter((r: any) => r.state === 'COMPLETED');
    const lastCompletedRound = completedRounds.length > 0 
        ? Math.max(...completedRounds.map((r: any) => r.index))
        : 0;
    const isGameEnded = lastCompletedRound >= finalRoundNumber;

    // State logic
    // If no active round -> Show "Start Round X"
    // If active round state is BIDDING -> Show inputs for Bids
    // If active round state is PLAYING -> Show inputs for Tricks (and read-only Bids)

    const [inputs, setInputs] = useState<Record<string, number>>({});

    // Helper to get dealer index for a round
    const getDealerIndex = (roundIndex: number, numPlayers: number): number => {
        return (roundIndex - 1) % numPlayers;
    };

    const handleStartRound = async () => {
        setLoading(true);
        try {
            await fetch(`/api/games/${gameId}/rounds`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'START' })
            });
        } catch (e) {
            alert('Error starting round');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (type: 'BIDS' | 'TRICKS') => {
        // Validate inputs before submitting
        if (type === 'BIDS') {
            // Reorder players for bidding validation: dealer goes last (matching server-side logic)
            const dealerIndex = getDealerIndex(activeRound.index, gameState.players.length);
            const biddingOrder = [
                ...gameState.players.slice(0, dealerIndex),
                ...gameState.players.slice(dealerIndex + 1),
                gameState.players[dealerIndex] // Dealer at the end
            ];

            // Validate bid values in bidding order
            // Blank/empty bids are treated as 0
            const cardsPerPlayer = activeRound.cards;
            const bids = biddingOrder.map((p: any) => {
                const bid = inputs[p.email];
                // If bid is undefined, null, or empty string, treat as 0
                if (bid === undefined || bid === null || bid === '') {
                    return 0;
                }
                const numBid = typeof bid === 'string' ? parseInt(bid) : bid;
                if (isNaN(numBid) || numBid < 0) {
                    return null;
                }
                // Check if bid exceeds cards per player
                if (numBid > cardsPerPlayer) {
                    return { error: true, player: p.name, bid: numBid };
                }
                return numBid;
            });

            // Check for validation errors
            const invalidBid = bids.find((b: any) => b && typeof b === 'object' && b.error);
            if (invalidBid) {
                alert(`${invalidBid.player} cannot bid ${invalidBid.bid}. Maximum bid is ${cardsPerPlayer} (cards dealt per player).`);
                return;
            }

            if (bids.some((b: any) => b === null)) {
                alert('All bids must be non-negative numbers');
                return;
            }

            // Validate dealer constraint: sum of bids must NOT equal cards per player
            const sumBids = bids.reduce((sum: number, b: number) => sum + b, 0);
            if (sumBids === cardsPerPlayer) {
                const dealer = gameState.players[dealerIndex];
                alert(`Dealer (${dealer.name}) must bid such that total bids do not equal ${cardsPerPlayer}. Current total: ${sumBids}`);
                return;
            }
        } else if (type === 'TRICKS') {
            // Check all players have tricks entered (either made via checkmark or missed via X)
            const allPlayersHaveTricks = gameState.players.every((p: any) => {
                const tricks = inputs[p.email];
                return tricks !== undefined && tricks !== null && tricks !== '';
            });

            if (!allPlayersHaveTricks) {
                alert('Please mark all players as Made (✓) or Missed (X) before proceeding');
                return;
            }

            // Validate trick values
            // -1 means player didn't make their bid (we don't care about actual tricks)
            // Otherwise, must be a non-negative number
            const tricks = gameState.players.map((p: any) => {
                const trick = inputs[p.email];
                const numTrick = typeof trick === 'string' ? parseInt(trick) : trick;
                if (isNaN(numTrick) || (numTrick < 0 && numTrick !== -1)) {
                    return null;
                }
                return numTrick;
            });

            if (tricks.some((t: any) => t === null)) {
                alert('All tricks must be non-negative numbers (or -1 for missed bids)');
                return;
            }

            // Validate that sum of tricks for players who made their bids doesn't exceed total tricks available
            const cardsPerPlayer = activeRound.cards; // This represents total tricks in the round
            let sumMadeBids = 0;
            const madeBidPlayers: string[] = [];
            const zeroBidPlayersMarkedMissed: any[] = [];
            
            gameState.players.forEach((p: any) => {
                const bid = activeRound.bids?.[p.email];
                const tricksValue = inputs[p.email];
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

            // If all tricks are taken by players who made their bids, players who bid 0 MUST have made their bid
            // Automatically correct them to made (0 tricks)
            if (sumMadeBids === cardsPerPlayer && zeroBidPlayersMarkedMissed.length > 0) {
                const updatedInputs = { ...inputs };
                zeroBidPlayersMarkedMissed.forEach((p: any) => {
                    updatedInputs[p.email] = 0; // Automatically set to made (0 tricks)
                });
                // Update the inputs state so UI reflects the correction
                setInputs(updatedInputs);
                // Update local inputs object for submission
                Object.assign(inputs, updatedInputs);
            }

            // Recalculate with potentially updated inputs
            sumMadeBids = 0;
            const zeroBidPlayersMarkedMade: any[] = [];
            let hasMissedBids = false;
            gameState.players.forEach((p: any) => {
                const bid = activeRound.bids?.[p.email];
                const tricksValue = inputs[p.email];
                if (bid !== undefined && tricksValue !== undefined && tricksValue !== -1 && bid === tricksValue) {
                    sumMadeBids += tricksValue;
                    // Track players who bid 0 and are marked as made
                    if (bid === 0 && tricksValue === 0) {
                        zeroBidPlayersMarkedMade.push(p);
                    }
                } else if (bid !== undefined && tricksValue === -1) {
                    // Track if any player missed their bid
                    hasMissedBids = true;
                }
            });

            if (sumMadeBids > cardsPerPlayer) {
                alert(`Invalid: The sum of tricks for players who made their bids (${sumMadeBids}) exceeds the total tricks available (${cardsPerPlayer}). Players who made their bids: ${madeBidPlayers.join(', ')}. At least one of these players must have missed their bid.`);
                return;
            }

            // If ALL players are marked as made (no one missed) and sum doesn't equal total, it's invalid
            if (!hasMissedBids && sumMadeBids !== cardsPerPlayer) {
                const unaccountedTricks = cardsPerPlayer - sumMadeBids;
                alert(`Invalid: All players are marked as Made, but only ${sumMadeBids} out of ${cardsPerPlayer} tricks are accounted for. There are ${unaccountedTricks} unaccounted trick(s). At least one player must have missed their bid to account for these tricks.`);
                return;
            }
        }

        setLoading(true);
        try {
            // For BIDS, convert blank/undefined values to 0 before sending
            const processedInputs = type === 'BIDS' 
                ? Object.fromEntries(
                    gameState.players.map((p: any) => [
                        p.email,
                        inputs[p.email] === undefined || inputs[p.email] === null || inputs[p.email] === '' 
                            ? 0 
                            : inputs[p.email]
                    ])
                )
                : inputs;
            
            const res = await fetch(`/api/games/${gameId}/rounds`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: type, inputs: processedInputs }) // inputs: { email: value }
            });

            const data = await res.json();

            if (!res.ok) {
                alert(`Error: ${data.error || `Failed to save ${type}`}`);
                return;
            }

            // Clear inputs only on success
            setInputs({});
            
            // Update game state if callback provided, otherwise reload
            if (data.game && onGameUpdate) {
                onGameUpdate(data.game);
            } else {
                // Fallback: reload page to ensure UI is in sync
                window.location.reload();
            }
        } catch (e) {
            console.error(e);
            alert(`Error saving ${type}. Please try again.`);
        } finally {
            setLoading(false);
        }
    };

    if (!isOperator) {
        return (
            <div className="glass p-6 rounded-2xl border-l-4 border-l-indigo-500">
                <h3 className="text-lg font-semibold mb-2">
                    {isGameEnded ? 'Game Ended' : `Round ${currentRoundIndex}`}
                </h3>
                <div className="text-sm text-muted-foreground">
                    {isGameEnded ? 'Final round completed' : 'Waiting for operator...'}
                </div>
            </div>
        );
    }

    // Show game ended message if game has ended
    if (isGameEnded) {
        return (
            <div className="glass p-6 rounded-2xl border-l-4 border-l-green-500">
                <h3 className="text-lg font-semibold mb-2 text-green-400">Game Ended</h3>
                <div className="text-sm text-muted-foreground mb-4">
                    Final round ({finalRoundNumber}) has been completed.
                </div>
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="text-sm font-semibold mb-2 text-green-300">Final Scores:</div>
                    <div className="space-y-1">
                        {gameState.players
                            .sort((a: any, b: any) => b.score - a.score)
                            .map((p: any, i: number) => (
                                <div key={p.email} className="flex justify-between text-sm">
                                    <span className={i === 0 ? 'font-bold text-yellow-400' : ''}>
                                        {i === 0 && '🏆 '}{p.name}
                                    </span>
                                    <span className="font-mono font-semibold">{p.score}</span>
                                </div>
                            ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!activeRound) {
        const playerCount = gameState.players?.length || 0;
        const canStart = playerCount >= 3;
        
        return (
            <div className="glass p-6 rounded-2xl border-l-4 border-l-indigo-500">
                <h3 className="text-lg font-semibold mb-2">Start Game</h3>
                {!canStart && (
                    <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-500">
                        Need {3 - playerCount} more player{3 - playerCount !== 1 ? 's' : ''} to start (minimum 3 players)
                    </div>
                )}
                <div className="text-xs text-muted-foreground mb-4">
                    Players: {playerCount} / 12
                </div>
                <button
                    onClick={handleStartRound}
                    disabled={loading || !canStart}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-semibold transition-all mt-4 flex justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!canStart ? "Minimum 3 players required to start" : ""}
                >
                    {loading ? <Loader2 className="animate-spin" /> : `Start Round ${currentRoundIndex}`}
                </button>
            </div>
        );
    }

    const isBidding = activeRound.state === 'BIDDING' || !activeRound.state; // Default to bidding
    
    // Calculate dealer for this round
    const dealerIndex = getDealerIndex(activeRound.index, gameState.players.length);
    const dealer = gameState.players[dealerIndex];

    // Always reorder players: first player (index 0) first, dealer last
    // This ensures consistent ordering: [player0, player1, ..., dealer]
    const orderedPlayers = [
        ...gameState.players.slice(0, dealerIndex),
        ...gameState.players.slice(dealerIndex + 1),
        gameState.players[dealerIndex] // Dealer always at the end
    ];

    return (
        <div className="glass p-6 rounded-2xl border-l-4 border-l-indigo-500">
            <h3 className="text-lg font-semibold mb-2">
                Round {activeRound.index} • {isBidding ? 'Bids' : 'Tricks'}
            </h3>

            <div className="flex justify-between text-xs text-muted-foreground mb-4">
                <span>Cards: {activeRound.cards}</span>
                <span>Trump: {getTrumpFullName(activeRound.trump)}</span>
                <span className="text-yellow-400">Dealer: {dealer?.name}</span>
            </div>

            <div className="space-y-3">
                {orderedPlayers.map((p: any) => {
                    const isDealer = p.email === dealer?.email;
                    const bid = activeRound.bids?.[p.email];
                    const tricksValue = inputs[p.email];
                    // -1 means player didn't make their bid
                    const madeBid = bid !== undefined && tricksValue !== undefined && tricksValue !== -1 && bid === tricksValue;
                    
                    return (
                        <div key={p.email} className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="text-sm truncate w-24">
                                    {p.name}
                                    {isDealer && <span className="text-yellow-400 ml-1">(D)</span>}
                                </span>
                                {!isBidding && bid !== undefined && (
                                    <span className="text-xs text-muted-foreground">
                                        Bid: <span className="font-semibold text-white">{bid}</span>
                                    </span>
                                )}
                            </div>
                            {isBidding ? (
                                <input
                                    type="number"
                                    min="0"
                                    max={activeRound.cards}
                                    className="bg-white/5 border border-white/10 rounded px-2 py-1 w-16 text-right"
                                    placeholder="Bid"
                                    value={inputs[p.email] !== undefined ? inputs[p.email] : ''}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === '') {
                                            const newInputs = { ...inputs };
                                            delete newInputs[p.email];
                                            setInputs(newInputs);
                                        } else {
                                            const num = parseInt(value);
                                            if (!isNaN(num) && num >= 0 && num <= activeRound.cards) {
                                                setInputs({ ...inputs, [p.email]: num });
                                            }
                                        }
                                    }}
                                />
                                ) : (
                                <div className="flex items-center gap-2">
                                    {/* Checkmark = Made bid (tricks = bid) */}
                                    <button
                                        onClick={() => {
                                            if (bid !== undefined) {
                                                setInputs({ ...inputs, [p.email]: bid });
                                            }
                                        }}
                                        className={`p-2 rounded transition ${
                                            madeBid 
                                                ? 'bg-green-500/20 text-green-400 border-2 border-green-500/50' 
                                                : 'bg-white/5 text-muted-foreground hover:bg-green-500/10 hover:text-green-400 border border-white/10'
                                        }`}
                                        title="Made bid (tricks = bid)"
                                    >
                                        <Check size={18} />
                                    </button>
                                    {/* X = Missed bid - no need to enter tricks */}
                                    <button
                                        onClick={() => {
                                            // If currently marked as made, clear it first
                                            if (madeBid) {
                                                const newInputs = { ...inputs };
                                                delete newInputs[p.email];
                                                setInputs(newInputs);
                                            }
                                            // Mark as missed by setting tricks to -1 (special value meaning "didn't make bid")
                                            setInputs({ ...inputs, [p.email]: -1 });
                                        }}
                                        className={`p-2 rounded transition ${
                                            !madeBid && tricksValue !== undefined
                                                ? 'bg-red-500/20 text-red-400 border-2 border-red-500/50'
                                                : 'bg-white/5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 border border-white/10'
                                        }`}
                                        title="Missed bid"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="flex gap-2 mt-4">
                {isBidding ? (
                    <button
                        onClick={() => handleSubmit('BIDS')}
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-semibold transition-all flex justify-center"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : 'Save Bids'}
                    </button>
                ) : (
                    <>
                        <button
                            onClick={() => handleSubmit('TRICKS')}
                            disabled={loading}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-semibold transition-all flex justify-center"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : 'Save Tricks'}
                        </button>
                        {/* Show Next Round button after tricks are saved (round is completed) */}
                        {activeRound.state === 'COMPLETED' && (() => {
                            const nextRoundIndex = currentRoundIndex + 1;
                            const nextRound = rounds.find((r: any) => r.index === nextRoundIndex);
                            const isFinalRound = activeRound.index >= finalRoundNumber;
                            
                            // Don't show next round button if this was the final round
                            if (isFinalRound) {
                                return null;
                            }
                            
                            return (
                                <button
                                    onClick={async () => {
                                        setLoading(true);
                                        try {
                                            // If next round doesn't exist, start it (initialize rounds if needed)
                                            if (!nextRound) {
                                                const res = await fetch(`/api/games/${gameId}/rounds`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ action: 'START' })
                                                });
                                                const data = await res.json();
                                                if (res.ok && onGameUpdate && data.game) {
                                                    onGameUpdate(data.game);
                                                } else {
                                                    alert(data.error || 'Failed to start next round');
                                                }
                                            } else {
                                                // Next round exists, just update game state to show it
                                                if (onGameUpdate) {
                                                    const updatedGame = { ...gameState, currentRoundIndex: nextRoundIndex };
                                                    onGameUpdate(updatedGame);
                                                }
                                            }
                                        } catch (e) {
                                            console.error('Error starting next round:', e);
                                            alert('Error starting next round');
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                    disabled={loading}
                                    className="bg-purple-600 hover:bg-purple-500 text-white py-3 px-4 rounded-xl font-semibold transition-all flex justify-center"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : `Round ${nextRoundIndex}`}
                                </button>
                            );
                        })()}
                    </>
                )}
            </div>
        </div>
    );
}
