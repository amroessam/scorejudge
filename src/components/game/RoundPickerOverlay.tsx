"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, RotateCcw, AlertTriangle, Undo2 } from "lucide-react";
import { Round, Player } from "@/lib/store";
import { useState } from "react";

interface RoundPickerOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    onUndo: () => void;
    onRewind: (roundIndex: number) => void;
    rounds: Round[];
    players: Player[];
    currentRoundIndex: number;
    isGameEnded: boolean;
}

function getTrumpIcon(trump: string) {
    const color = trump === 'D' || trump === 'H' ? 'text-red-500' : 'text-white';
    const symbol = {
        'S': '♠',
        'D': '♦',
        'C': '♣',
        'H': '♥',
        'NT': 'NT'
    }[trump] || trump;

    return <span className={`font-bold ${color}`}>{symbol}</span>;
}

function getRoundStateLabel(state: string) {
    if (state === 'BIDDING') return 'Entering bids';
    if (state === 'PLAYING') return 'Entering tricks';
    if (state === 'COMPLETED') return 'Completed';
    return state;
}

export function RoundPickerOverlay({
    isOpen,
    onClose,
    onUndo,
    onRewind,
    rounds,
    players,
    currentRoundIndex,
    isGameEnded
}: RoundPickerOverlayProps) {
    const [confirmRound, setConfirmRound] = useState<number | null>(null);
    const [confirmType, setConfirmType] = useState<'undo' | 'rewind'>('undo');

    const currentRound = rounds.find(r => r.index === currentRoundIndex);
    const completedRounds = rounds
        .filter(r => r.state === 'COMPLETED' && r.index < currentRoundIndex)
        .sort((a, b) => b.index - a.index); // Most recent first

    // Can undo current round if it's not in the initial BIDDING state of round 1
    // (i.e., it has bids entered or tricks entered)
    const canUndoCurrent = currentRound && !isGameEnded && (
        currentRound.state === 'PLAYING' || currentRound.state === 'COMPLETED'
    );

    const handleConfirm = () => {
        if (confirmRound !== null) {
            if (confirmType === 'undo') {
                onUndo();
            } else {
                onRewind(confirmRound);
            }
            setConfirmRound(null);
            onClose();
        }
    };

    const handleClose = () => {
        setConfirmRound(null);
        onClose();
    };

    const handleSelectCurrent = () => {
        // Current round undo doesn't need confirmation — it's quick and reversible
        onUndo();
        onClose();
    };

    const handleSelectPrevious = (roundIndex: number) => {
        setConfirmRound(roundIndex);
        setConfirmType('rewind');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
                    />

                    {/* Sheet */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--card)] rounded-t-3xl border-t border-[var(--border)] max-h-[70vh] flex flex-col shadow-2xl"
                        style={{ paddingBottom: `max(0px, env(safe-area-inset-bottom, 0px))` }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
                            <div>
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <Undo2 size={20} className="text-yellow-500" />
                                    Undo
                                </h3>
                                <p className="text-sm text-[var(--muted-foreground)] mt-1">
                                    Undo current round or go back to fix a previous one
                                </p>
                            </div>
                            <button onClick={handleClose} className="p-2 rounded-full hover:bg-[var(--secondary)] transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Confirmation Dialog for REWIND */}
                        <AnimatePresence>
                            {confirmRound !== null && confirmType === 'rewind' && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden border-b border-[var(--border)]"
                                >
                                    <div className="p-4 bg-yellow-500/10">
                                        <div className="flex items-start gap-3">
                                            <AlertTriangle size={20} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1">
                                                <p className="font-semibold text-sm">
                                                    Go back to Round {confirmRound}?
                                                </p>
                                                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                                                    You&apos;ll re-enter tricks for this round. All scores will be recalculated automatically.
                                                </p>
                                                <div className="flex gap-2 mt-3">
                                                    <button
                                                        onClick={handleConfirm}
                                                        className="px-4 py-2 bg-yellow-500 text-black rounded-lg text-sm font-bold active:scale-95 transition-transform"
                                                    >
                                                        Confirm
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmRound(null)}
                                                        className="px-4 py-2 bg-[var(--secondary)] rounded-lg text-sm active:scale-95 transition-transform"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Round List */}
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="space-y-2">
                                {/* Current Round — Undo option */}
                                {canUndoCurrent && currentRound && (
                                    <>
                                        <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-1 mb-1">
                                            Current Round
                                        </div>
                                        <button
                                            onClick={handleSelectCurrent}
                                            className="w-full p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 text-left transition-all active:scale-[0.98] hover:bg-blue-500/20"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono text-lg font-bold text-blue-400">
                                                        #{currentRound.index}
                                                    </span>
                                                    <div>
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <span>{currentRound.cards} cards</span>
                                                            <span className="text-[var(--muted-foreground)]">&middot;</span>
                                                            {getTrumpIcon(currentRound.trump)}
                                                        </div>
                                                        <div className="text-xs text-blue-400 mt-0.5">
                                                            {getRoundStateLabel(currentRound.state)} — tap to undo
                                                        </div>
                                                    </div>
                                                </div>
                                                <Undo2 size={16} className="text-blue-400" />
                                            </div>
                                        </button>
                                    </>
                                )}

                                {/* Previous Rounds — Rewind option */}
                                {completedRounds.length > 0 && (
                                    <>
                                        <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-1 mb-1 mt-4">
                                            Previous Rounds
                                        </div>
                                        {completedRounds.map((round) => {
                                            const madeCount = players.filter(p => {
                                                const bid = round.bids[p.email];
                                                const tricks = round.tricks[p.email];
                                                return bid !== undefined && tricks !== undefined && tricks !== -1 && bid === tricks;
                                            }).length;

                                            return (
                                                <button
                                                    key={round.index}
                                                    onClick={() => handleSelectPrevious(round.index)}
                                                    className={`
                                                        w-full p-4 rounded-xl border text-left transition-all active:scale-[0.98]
                                                        ${confirmRound === round.index
                                                            ? 'border-yellow-500/50 bg-yellow-500/10'
                                                            : 'border-[var(--border)] bg-[var(--secondary)]/30 hover:bg-[var(--secondary)]/60'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-mono text-lg font-bold text-[var(--muted-foreground)]">
                                                                #{round.index}
                                                            </span>
                                                            <div>
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <span>{round.cards} cards</span>
                                                                    <span className="text-[var(--muted-foreground)]">&middot;</span>
                                                                    {getTrumpIcon(round.trump)}
                                                                </div>
                                                                <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
                                                                    {madeCount}/{players.length} made their bid
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <RotateCcw size={16} className="text-[var(--muted-foreground)]" />
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </>
                                )}

                                {/* Empty state — no undo available */}
                                {!canUndoCurrent && completedRounds.length === 0 && (
                                    <div className="text-center py-10 text-[var(--muted-foreground)]">
                                        Nothing to undo yet
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
