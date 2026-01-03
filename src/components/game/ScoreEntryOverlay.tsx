"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check as CheckIcon, AlertCircle, Loader2, Lightbulb, ChevronLeft } from "lucide-react";
import { Player } from "@/lib/store";
import { DECK_SIZE } from "@/lib/config";

interface ScoreEntryOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    gameId: string;
    gameState: any;
    onGameUpdate: (game: any) => void;
}

// Helper to calculate final round number
function getFinalRoundNumber(numPlayers: number): number {
    const maxCards = Math.floor(DECK_SIZE / numPlayers);
    return maxCards * 2 - 1;
}

export function ScoreEntryOverlay({
    isOpen,
    onClose,
    gameId,
    gameState,
    onGameUpdate
}: ScoreEntryOverlayProps) {
    const { players, currentRoundIndex, rounds, firstDealerEmail } = gameState;
    const activeRound = rounds.find((r: any) => r.index === currentRoundIndex);

    // Lock the type when overlay opens to prevent it from changing during exit animation
    const lockedTypeRef = useRef<'BIDS' | 'TRICKS' | null>(null);

    // Check if game ended
    const finalRoundNumber = getFinalRoundNumber(players.length);
    const completedRounds = rounds.filter((r: any) => r.state === 'COMPLETED');
    const lastCompletedRound = completedRounds.length > 0
        ? Math.max(...completedRounds.map((r: any) => r.index))
        : 0;
    const isGameEnded = lastCompletedRound >= finalRoundNumber;

    // Determine Entry Type - lock it when overlay opens
    const isBidding = !activeRound || activeRound.state === 'BIDDING';
    const currentType = isBidding ? 'BIDS' : 'TRICKS';

    // Lock type when overlay opens, keep it locked during exit animation
    useEffect(() => {
        if (isOpen) {
            // Lock the type when opening - use the current type at that moment
            lockedTypeRef.current = currentType;
        }
        // Don't clear the lock immediately when closing - let it persist during exit animation
    }, [isOpen, currentType]);

    // Clear lock after overlay is fully closed (when isOpen becomes false)
    useEffect(() => {
        if (!isOpen && lockedTypeRef.current !== null) {
            // Clear lock after animation completes
            const timer = setTimeout(() => {
                lockedTypeRef.current = null;
            }, 600); // Slightly longer than animation to be safe
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Use locked type if available, otherwise use current type
    const type = lockedTypeRef.current ?? currentType;

    // Close overlay if game ended
    useEffect(() => {
        if (isGameEnded && isOpen) {
            onClose();
        }
    }, [isGameEnded, isOpen, onClose]);

    // Calculate Dealer and Order
    let firstDealerIndex = 0;
    if (firstDealerEmail) {
        const idx = players.findIndex((p: Player) => p.email === firstDealerEmail);
        if (idx !== -1) firstDealerIndex = idx;
    }
    const dealerIndex = (firstDealerIndex + (currentRoundIndex - 1)) % players.length;

    // Order: Left of dealer first, dealer last
    const orderedPlayers = [
        ...players.slice(dealerIndex + 1),
        ...players.slice(0, dealerIndex + 1)
    ];

    // Local State
    const [inputs, setInputs] = useState<Record<string, number | string>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Refs for focus management (only for bids)
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Track if inputs have been initialized for the current open session
    // This prevents re-initialization when gameState changes via WebSocket
    const hasInitializedRef = useRef(false);
    const lastOpenStateRef = useRef(false);

    // Initialize inputs ONLY when overlay first opens, not on every gameState change
    useEffect(() => {
        // Detect when overlay opens (transition from closed to open)
        const justOpened = isOpen && !lastOpenStateRef.current;
        lastOpenStateRef.current = isOpen;

        // Reset initialization flag when overlay closes
        if (!isOpen) {
            hasInitializedRef.current = false;
            return;
        }

        // Only initialize if we just opened and haven't initialized yet
        if (justOpened && !hasInitializedRef.current && activeRound) {
            hasInitializedRef.current = true;

            const initial: Record<string, number | string> = {};
            players.forEach((p: Player) => {
                if (type === 'BIDS') {
                    // Start empty for bids (empty will be treated as 0 on submit)
                    // Only set value if there's an existing bid
                    if (activeRound.bids?.[p.email] !== undefined) {
                        initial[p.email] = activeRound.bids[p.email];
                    } else {
                        initial[p.email] = '';
                    }
                } else {
                    // For tricks, use existing value or leave empty (will be handled by check/X)
                    if (activeRound.tricks?.[p.email] !== undefined && activeRound.tricks?.[p.email] !== -1) {
                        initial[p.email] = activeRound.tricks[p.email];
                    }
                    // If -1 (missed), don't set initial value
                }
            });
            setInputs(initial);
            setError(null);

            // Auto focus first input after animation (only for bids)
            if (type === 'BIDS') {
                setTimeout(() => {
                    inputRefs.current[0]?.focus();
                }, 300);
            }
        }
    }, [isOpen, activeRound, type, players]);

    const handleInputChange = (email: string, value: string) => {
        const maxCards = activeRound?.cards || 0;

        // Allow empty input - will be treated as 0 on submit
        if (value === '') {
            setInputs(prev => ({ ...prev, [email]: '' }));
            setError(null);
            return;
        }

        // Remove leading zeros (e.g., "02" -> "2", "007" -> "7")
        // But preserve "0" as is
        let normalizedValue = value;
        if (normalizedValue.length > 1 && normalizedValue.startsWith('0')) {
            normalizedValue = normalizedValue.replace(/^0+/, '') || '0';
        }

        const numValue = parseInt(normalizedValue, 10);

        if (!isNaN(numValue) && numValue >= 0) {
            // Enforce max limit: can't bid more than cards dealt
            const clampedValue = Math.min(numValue, maxCards);
            setInputs(prev => ({ ...prev, [email]: clampedValue }));
        } else {
            // Invalid input, keep previous value or set to empty
            setInputs(prev => ({ ...prev, [email]: prev[email] ?? '' }));
        }
        setError(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (index < orderedPlayers.length - 1) {
                inputRefs.current[index + 1]?.focus();
            } else {
                inputRefs.current[index]?.blur();
            }
        }
    };

    // Handle check/X for tricks
    const handleTrickMade = (email: string, bid: number) => {
        setInputs(prev => ({ ...prev, [email]: bid }));
        setError(null);
    };

    const handleTrickMissed = (email: string) => {
        setInputs(prev => ({ ...prev, [email]: -1 }));
        setError(null);
    };

    /**
     * Deep Validation: Checks if there exists ANY distribution of tricks across missed players
     * such that the total sum matches cardsPerPlayer AND no missed player takes exactly their bid.
     */
    const isDistributionPossible = (
        remainingTricks: number,
        missedPlayers: { email: string; bid: number }[]
    ): boolean => {
        if (missedPlayers.length === 0) {
            return remainingTricks === 0;
        }

        const [currentPlayer, ...rest] = missedPlayers;

        // A missed player can take anything from 0 to remainingTricks, 
        // as long as it's NOT their bid.
        for (let t = 0; t <= remainingTricks; t++) {
            if (t === currentPlayer.bid) continue; // Must be ≠ bid to be "Missed"

            if (isDistributionPossible(remainingTricks - t, rest)) {
                return true;
            }
        }

        return false;
    };

    const validate = () => {
        const cardsPerPlayer = activeRound.cards;
        const currentInputs: Record<string, number> = {};

        // Parse inputs
        for (const p of players) {
            const val = inputs[p.email];

            if (type === 'BIDS') {
                if (val === undefined || val === '') {
                    // Default to 0 for bids as per user preference
                    currentInputs[p.email] = 0;
                } else {
                    const num = parseInt(val.toString());
                    if (isNaN(num) || num < 0) return `Invalid value for ${p.name}`;
                    if (num > cardsPerPlayer) return `${p.name} cannot have more than ${cardsPerPlayer}`;
                    currentInputs[p.email] = num;
                }
            } else {
                // For TRICKS, every player MUST have a value (bid or -1)
                if (val === undefined || val === '') {
                    return `Missing score for ${p.name}`;
                }
                const num = parseInt(val.toString());
                if (isNaN(num) || (num < 0 && num !== -1)) return `Invalid value for ${p.name}`;
                if (num > cardsPerPlayer && num !== -1) return `${p.name} cannot have more than ${cardsPerPlayer}`;
                currentInputs[p.email] = num;
            }
        }

        if (type === 'BIDS') {
            const sum = Object.values(currentInputs).reduce((a, b) => a + b, 0);
            // Dealer constraint
            if (sum === cardsPerPlayer) {
                return `Dealer cannot bid to make total equal to ${cardsPerPlayer} (Sum is ${sum})`;
            }
        } else {
            // For tricks, calculate sum of made bids only (not -1)
            const madeBidsSum = Object.entries(currentInputs).reduce((sum, [email, tricks]) => {
                const bid = activeRound.bids?.[email];
                if (bid !== undefined && tricks !== -1 && tricks === bid) {
                    return sum + tricks;
                }
                return sum;
            }, 0);

            // Check if all players bid 0
            const allBidsZero = players.every((p: Player) => {
                const bid = activeRound.bids?.[p.email];
                return bid === 0 || bid === undefined;
            });

            // Validation logic from RoundControls
            let missedCount = 0;
            let sumMadeBids = 0;

            players.forEach((p: Player) => {
                const bid = activeRound.bids?.[p.email];
                const tricksValue = currentInputs[p.email];
                if (bid !== undefined && tricksValue !== undefined && tricksValue !== -1 && bid === tricksValue) {
                    sumMadeBids += tricksValue;
                } else if (bid !== undefined && tricksValue === -1) {
                    missedCount++;
                }
            });

            const hasMissedBids = missedCount > 0;

            // If all players bid 0, at least one must have missed (taken tricks)
            // because there are cards dealt that must be taken by someone
            if (allBidsZero && !hasMissedBids) {
                return `Invalid: All players bid 0, but there are ${cardsPerPlayer} cards dealt. At least one player must have missed their bid (taken tricks).`;
            }

            // When all bid 0, the number of missed players cannot exceed the number of cards
            // because each missed player took at least 1 trick
            // Example: 1 card dealt, 3 players all bid 0 → max 1 can miss (who took the 1 trick)
            // Example: 2 cards dealt, 3 players all bid 0 → max 2 can miss
            if (allBidsZero && missedCount > cardsPerPlayer) {
                const maxMissed = cardsPerPlayer;
                const minMade = players.length - maxMissed;
                return `Invalid: With ${cardsPerPlayer} card(s) dealt and all 0 bids, at most ${maxMissed} player(s) can miss their bid. At least ${minMade} player(s) must have made it (got 0 tricks). You marked ${missedCount} as missed.`;
            }

            if (sumMadeBids > cardsPerPlayer) {
                return `Invalid: The sum of tricks for players who made their bids (${sumMadeBids}) exceeds the total tricks available (${cardsPerPlayer}).`;
            }

            // Deep validation for missed players
            const missedPlayersList = players
                .filter((p: Player) => currentInputs[p.email] === -1)
                .map((p: Player) => ({ email: p.email, bid: activeRound.bids[p.email] ?? 0 }));

            const remainingTricks = cardsPerPlayer - sumMadeBids;

            if (!isDistributionPossible(remainingTricks, missedPlayersList)) {
                if (missedPlayersList.length === 0) {
                    return `Invalid: All tricks (${cardsPerPlayer}) must be accounted for. Current sum is ${sumMadeBids}.`;
                }
                return `Invalid distribution: The remaining ${remainingTricks} trick(s) cannot be split among missed players without someone hitting their bid.`;
            }
        }

        return null;
    };

    const handleSubmit = async () => {
        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);
        try {
            // Process inputs: Convert to numbers, default to 0 for bids only
            const processedInputs: Record<string, number> = {};
            for (const p of players) {
                const val = inputs[p.email];
                if (val === undefined || val === '') {
                    processedInputs[p.email] = 0;
                } else {
                    processedInputs[p.email] = parseInt(val.toString());
                }
            }

            const res = await fetch(`/api/games/${gameId}/rounds`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: type, inputs: processedInputs })
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to save");
            } else {
                // Check if game has ended - if so, update state immediately to show end screen
                const finalRoundNumber = getFinalRoundNumber(players.length);
                const completedRounds = data.game?.rounds?.filter((r: any) => r.state === 'COMPLETED') || [];
                const lastCompletedRound = completedRounds.length > 0
                    ? Math.max(...completedRounds.map((r: any) => r.index))
                    : 0;
                const isGameEnded = lastCompletedRound >= finalRoundNumber;

                if (isGameEnded && data.game) {
                    // Game ended - update state immediately to show end screen and confetti
                    onGameUpdate(data.game);
                    // Close overlay after a brief delay to allow state update
                    setTimeout(() => {
                        onClose();
                    }, 100);
                } else {
                    // Normal round completion - close overlay first, then update state
                    onClose();
                    // Update game state after animation completes (spring animation ~500ms)
                    setTimeout(() => {
                        if (data.game) onGameUpdate(data.game);
                    }, 500);
                }
            }
        } catch (e: any) {
            // Show more specific error message if available
            const errorMessage = e?.message || "Network error - please check your connection";
            setError(errorMessage);
            console.error("[ScoreEntryOverlay] Submit error:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleUndo = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/games/${gameId}/rounds`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'UNDO' })
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Failed to go back to bids");
                return;
            }

            if (data.game) {
                onGameUpdate(data.game);
                // The useEffect will handle resetting inputs
            }
        } catch (e) {
            console.error(e);
            setError("Error going back to bids");
        } finally {
            setLoading(false);
        }
    };

    // Calculate sum dynamically for UI feedback
    const currentSum = Object.values(inputs).reduce((sum: number, val) => {
        if (val === undefined || val === '') return sum;
        const n = typeof val === 'string' ? parseInt(val, 10) : Number(val);
        return sum + (isNaN(n) ? 0 : (n === -1 ? 0 : n));
    }, 0);

    // For tricks, calculate made bids sum
    const madeBidsSum = type === 'TRICKS' ? Object.entries(inputs).reduce((sum, [email, tricks]) => {
        const bid = activeRound?.bids?.[email];
        if (bid !== undefined && tricks !== -1 && tricks === bid) {
            return sum + (typeof tricks === 'number' ? tricks : parseInt(tricks.toString()));
        }
        return sum;
    }, 0) : 0;

    // Calculate valid dealer bids (only when entering bids)
    const dealerEmail = players[dealerIndex]?.email;
    const cardsPerPlayer = activeRound?.cards || 0;
    const sumOfOtherBids = type === 'BIDS' && dealerEmail ? orderedPlayers
        .filter((p: Player) => p.email !== dealerEmail)
        .reduce((sum: number, p: Player) => {
            const bid = inputs[p.email];
            const numBid = bid === undefined || bid === '' ? 0 : parseInt(bid.toString());
            return sum + (isNaN(numBid) ? 0 : numBid);
        }, 0) : 0;

    const invalidDealerBid = cardsPerPlayer - sumOfOtherBids;
    const validDealerBids = type === 'BIDS' && dealerEmail
        ? Array.from({ length: cardsPerPlayer + 1 }, (_, i) => i).filter(bid => bid !== invalidDealerBid)
        : [];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
                    />

                    {/* Sheet */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--card)] rounded-t-3xl border-t border-[var(--border)] max-h-[90vh] flex flex-col shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-[var(--border)] shrink-0">
                            <div>
                                <div className="flex items-center gap-2">
                                    {type === 'TRICKS' && (
                                        <button
                                            onClick={handleUndo}
                                            disabled={loading}
                                            className="p-2 -ml-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] active:scale-90 transition-transform disabled:opacity-50"
                                            title="Back to Bids"
                                        >
                                            <ChevronLeft size={24} />
                                        </button>
                                    )}
                                    <h2 className="text-xl font-bold">
                                        {type === 'BIDS' ? 'Enter Bids' : 'Enter Scores'}
                                    </h2>
                                </div>
                                <p className="text-sm text-[var(--muted-foreground)]">
                                    Round {currentRoundIndex} • {activeRound?.cards} Cards
                                </p>
                            </div>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--secondary)] touch-manipulation">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Validation Status Bar */}
                        <div className={`
                            px-6 py-2 text-sm font-medium flex justify-between items-center shrink-0
                            ${error ? 'bg-red-500/10 text-red-500' : 'bg-[var(--secondary)]/50 text-[var(--muted-foreground)]'}
                        `}>
                            <span>
                                {type === 'BIDS' ? (
                                    error ? error : `Total Bids: ${currentSum} (Must ≠ ${activeRound?.cards})`
                                ) : (
                                    error ? error : `Total Tricks: ${madeBidsSum} / ${activeRound?.cards}`
                                )}
                            </span>
                            {type === 'BIDS' && currentSum === activeRound?.cards && !error && (
                                <AlertCircle size={16} className="text-yellow-500" />
                            )}
                        </div>


                        {/* Inputs List */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 overscroll-contain">
                            {orderedPlayers.map((p: Player, index) => {
                                const isDealer = p.email === players[dealerIndex].email;
                                const bid = activeRound?.bids?.[p.email];
                                const tricksValue = inputs[p.email];
                                const madeBid = bid !== undefined && tricksValue !== undefined && tricksValue !== -1 && bid === tricksValue;

                                return (
                                    <div key={p.email} className="flex items-center justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="font-medium text-lg flex items-center gap-2">
                                                {p.name}
                                                {isDealer && <span className="text-xs bg-[var(--secondary)] px-1.5 py-0.5 rounded text-[var(--muted-foreground)]">Dealer</span>}
                                            </div>
                                            <div className="text-sm text-[var(--muted-foreground)]">
                                                {type === 'TRICKS' && `Bid: ${bid ?? '-'}`}
                                            </div>
                                        </div>

                                        {type === 'BIDS' ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    ref={el => { inputRefs.current[index] = el }}
                                                    type="number"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    min="0"
                                                    max={activeRound?.cards || 0}
                                                    value={inputs[p.email] ?? ''}
                                                    onChange={(e) => handleInputChange(p.email, e.target.value)}
                                                    onKeyDown={(e) => handleKeyDown(e, index)}
                                                    className="w-20 h-14 bg-[var(--background)] border border-[var(--border)] rounded-xl text-center text-2xl font-bold focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 outline-none transition-all touch-manipulation"
                                                />
                                                {isDealer && (
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <span className="text-xs font-bold text-red-500">
                                                            Cannot bid: {invalidDealerBid}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                {/* Checkmark = Made bid */}
                                                <button
                                                    onClick={() => bid !== undefined && handleTrickMade(p.email, bid)}
                                                    className={`
                                                        p-3 rounded-xl transition-all active:scale-95 touch-manipulation
                                                        ${madeBid
                                                            ? 'bg-green-500/20 text-green-400 border-2 border-green-500/50'
                                                            : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-green-500/10 hover:text-green-400 border border-[var(--border)]'
                                                        }
                                                    `}
                                                    title="Made bid"
                                                >
                                                    <CheckIcon size={24} />
                                                </button>
                                                {/* X = Missed bid */}
                                                <button
                                                    onClick={() => handleTrickMissed(p.email)}
                                                    className={`
                                                        p-3 rounded-xl transition-all active:scale-95 touch-manipulation
                                                        ${!madeBid && tricksValue !== undefined && tricksValue === -1
                                                            ? 'bg-red-500/20 text-red-400 border-2 border-red-500/50'
                                                            : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-400 border border-[var(--border)]'
                                                        }
                                                    `}
                                                    title="Missed bid"
                                                >
                                                    <X size={24} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer Action */}
                        <div className="px-6 pt-6 border-t border-[var(--border)] bg-[var(--card)] shrink-0" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="w-full bg-[var(--primary)] text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform touch-manipulation"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : (
                                    <>
                                        Confirm {type === 'BIDS' ? 'Bids' : 'Scores'} <CheckIcon size={20} />
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
