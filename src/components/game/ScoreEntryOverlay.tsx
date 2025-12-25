"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check as CheckIcon, AlertCircle, Loader2 } from "lucide-react";
import { Player } from "@/lib/store";

interface ScoreEntryOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    gameId: string;
    gameState: any;
    onGameUpdate: (game: any) => void;
}

// Helper to calculate final round number
function getFinalRoundNumber(numPlayers: number): number {
    return Math.floor(52 / numPlayers) * 2;
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
    
    // Check if game ended
    const finalRoundNumber = getFinalRoundNumber(players.length);
    const completedRounds = rounds.filter((r: any) => r.state === 'COMPLETED');
    const lastCompletedRound = completedRounds.length > 0 
        ? Math.max(...completedRounds.map((r: any) => r.index))
        : 0;
    const isGameEnded = lastCompletedRound >= finalRoundNumber;
    
    // Determine Entry Type
    const isBidding = !activeRound || activeRound.state === 'BIDDING';
    const type = isBidding ? 'BIDS' : 'TRICKS';
    
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

    // Initialize inputs when opening
    useEffect(() => {
        if (isOpen && activeRound) {
            const initial: Record<string, number | string> = {};
            players.forEach((p: Player) => {
                if (type === 'BIDS') {
                    // Default to 0 if not set
                    initial[p.email] = activeRound.bids?.[p.email] ?? 0;
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
        // Default empty to 0
        const numValue = value === '' ? 0 : parseInt(value);
        const maxCards = activeRound?.cards || 0;
        
        if (!isNaN(numValue) && numValue >= 0) {
            // Enforce max limit: can't bid more than cards dealt
            const clampedValue = Math.min(numValue, maxCards);
            setInputs(prev => ({ ...prev, [email]: clampedValue }));
        } else if (value === '') {
            setInputs(prev => ({ ...prev, [email]: 0 }));
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

    const validate = () => {
        const cardsPerPlayer = activeRound.cards;
        const currentInputs: Record<string, number> = {};
        
        // Parse inputs - default to 0 if not set
        for (const p of players) {
            const val = inputs[p.email];
            if (val === undefined || val === '') {
                // Default to 0
                currentInputs[p.email] = 0;
            } else {
                const num = parseInt(val.toString());
                if (isNaN(num) || (num < 0 && num !== -1)) {
                    return `Invalid value for ${p.name}`;
                }
                if (num > cardsPerPlayer && num !== -1) {
                    return `${p.name} cannot have more than ${cardsPerPlayer}`;
                }
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
            let hasMissedBids = false;
            let sumMadeBids = 0;
            
            players.forEach((p: Player) => {
                const bid = activeRound.bids?.[p.email];
                const tricksValue = currentInputs[p.email];
                if (bid !== undefined && tricksValue !== undefined && tricksValue !== -1 && bid === tricksValue) {
                    sumMadeBids += tricksValue;
                } else if (bid !== undefined && tricksValue === -1) {
                    hasMissedBids = true;
                }
            });

            // If all players bid 0, at least one must have missed (taken tricks)
            // because there are cards dealt that must be taken by someone
            if (allBidsZero && !hasMissedBids) {
                return `Invalid: All players bid 0, but there are ${cardsPerPlayer} cards dealt. At least one player must have missed their bid (taken tricks).`;
            }

            if (sumMadeBids > cardsPerPlayer) {
                return `Invalid: The sum of tricks for players who made their bids (${sumMadeBids}) exceeds the total tricks available (${cardsPerPlayer}).`;
            }

            if (!hasMissedBids && sumMadeBids !== cardsPerPlayer) {
                const unaccountedTricks = cardsPerPlayer - sumMadeBids;
                return `Invalid: All players are marked as Made, but only ${sumMadeBids} out of ${cardsPerPlayer} tricks are accounted for. There are ${unaccountedTricks} unaccounted trick(s).`;
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
            // Process inputs: Convert to numbers, default to 0
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
                if (data.game) onGameUpdate(data.game);
                onClose();
            }
        } catch (e) {
            setError("Network error");
        } finally {
            setLoading(false);
        }
    };

    // Calculate sum dynamically for UI feedback
    const currentSum = Object.values(inputs).reduce((sum, val) => {
        if (val === undefined || val === '') return sum;
        const n = parseInt(val.toString());
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
                        style={{ paddingBottom: `max(0px, env(safe-area-inset-bottom, 0px))` }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
                            <div>
                                <h3 className="text-xl font-bold">
                                    {type === 'BIDS' ? 'Enter Bids' : 'Enter Tricks'}
                                </h3>
                                <p className="text-sm text-[var(--muted-foreground)]">
                                    Round {currentRoundIndex} • {activeRound?.cards} Cards
                                </p>
                            </div>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--secondary)]">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Validation Status Bar */}
                        <div className={`
                            px-6 py-2 text-sm font-medium flex justify-between items-center
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
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                                            <input
                                                ref={el => { inputRefs.current[index] = el }}
                                                type="number"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                min="0"
                                                max={activeRound?.cards || 0}
                                                value={inputs[p.email] ?? 0}
                                                onChange={(e) => handleInputChange(p.email, e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index)}
                                                className="w-20 h-14 bg-[var(--background)] border border-[var(--border)] rounded-xl text-center text-2xl font-bold focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 outline-none transition-all"
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                {/* Checkmark = Made bid */}
                                                <button
                                                    onClick={() => bid !== undefined && handleTrickMade(p.email, bid)}
                                                    className={`
                                                        p-3 rounded-xl transition-all active:scale-95
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
                                                        p-3 rounded-xl transition-all active:scale-95
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
                        <div className="px-6 pt-6 border-t border-[var(--border)] bg-[var(--card)]" style={{ paddingBottom: `max(2rem, env(safe-area-inset-bottom, 0px) + 1.5rem)` }}>
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="w-full bg-[var(--primary)] text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform"
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
