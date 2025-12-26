"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy } from "lucide-react";
import { Player, Round } from "@/lib/store";

interface PlayerHistoryOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    player: Player | null;
    rounds: Round[];
}

// Helper to get trump full name
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

export function PlayerHistoryOverlay({ 
    isOpen, 
    onClose, 
    player,
    rounds
}: PlayerHistoryOverlayProps) {
    if (!player) return null;

    // Calculate history
    let cumulativeScore = 0;
    const history = rounds
        .filter(r => r.state === 'COMPLETED' || (r.bids && r.bids[player.email] !== undefined))
        .sort((a, b) => a.index - b.index)
        .map(round => {
            const bid = round.bids?.[player.email];
            const tricks = round.tricks?.[player.email];
            
            let points = 0;
            let status: 'made' | 'missed' | 'pending' = 'pending';
            
            if (round.state === 'COMPLETED' && bid !== undefined && tricks !== undefined && tricks !== -1) {
                if (bid === tricks) {
                    points = bid + round.cards;
                    status = 'made';
                } else {
                    status = 'missed';
                }
                cumulativeScore += points;
            } else if (round.state === 'PLAYING') {
                status = 'pending'; // In progress
            }

            return {
                roundIndex: round.index,
                cards: round.cards,
                trump: round.trump,
                bid,
                tricks,
                points,
                status,
                totalScore: cumulativeScore
            };
        });

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
                        className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--card)] rounded-t-3xl border-t border-[var(--border)] h-[85vh] flex flex-col shadow-2xl"
                        style={{ paddingBottom: `max(0px, env(safe-area-inset-bottom, 0px))` }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
                            <div>
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    {player.name}
                                </h3>
                                <div className="text-sm text-[var(--muted-foreground)] flex items-center gap-2 mt-1">
                                    <Trophy size={14} className="text-yellow-500" />
                                    Current Score: <span className="text-[var(--foreground)] font-mono font-bold">{player.score}</span>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--secondary)] transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        {/* History List */}
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="space-y-3">
                                {/* Header Row */}
                                <div className="grid grid-cols-6 gap-2 text-xs font-semibold text-[var(--muted-foreground)] px-4 mb-2">
                                    <div className="col-span-1">Rnd</div>
                                    <div className="col-span-1 text-center">Trump</div>
                                    <div className="col-span-1 text-center">Bid</div>
                                    <div className="col-span-1 text-center">Tricks</div>
                                    <div className="col-span-1 text-right">Pts</div>
                                    <div className="col-span-1 text-right">Total</div>
                                </div>

                                {history.length === 0 ? (
                                    <div className="text-center py-10 text-[var(--muted-foreground)]">
                                        No rounds played yet
                                    </div>
                                ) : (
                                    history.map((row) => (
                                        <div 
                                            key={row.roundIndex}
                                            className={`
                                                grid grid-cols-6 gap-2 p-3 rounded-xl border items-center text-sm
                                                ${row.status === 'made' ? 'bg-green-500/5 border-green-500/20' : ''}
                                                ${row.status === 'missed' ? 'bg-red-500/5 border-red-500/20' : ''}
                                                ${row.status === 'pending' ? 'bg-[var(--secondary)]/50 border-[var(--border)]' : ''}
                                            `}
                                        >
                                            <div className="col-span-1 font-mono text-[var(--muted-foreground)]">
                                                #{row.roundIndex}
                                                <span className="text-[10px] ml-1 opacity-50 block">{row.cards} cards</span>
                                            </div>
                                            <div className="col-span-1 flex justify-center text-lg">
                                                {getTrumpIcon(row.trump)}
                                            </div>
                                            <div className="col-span-1 text-center font-bold">
                                                {row.bid ?? '-'}
                                            </div>
                                            <div className="col-span-1 text-center">
                                                {row.tricks === -1 ? (
                                                    <span className="text-red-400 font-bold">✗</span>
                                                ) : (
                                                    row.tricks ?? '-'
                                                )}
                                            </div>
                                            <div className={`col-span-1 text-right font-bold ${
                                                row.status === 'made' ? 'text-green-400' : 
                                                row.status === 'missed' ? 'text-red-400' : ''
                                            }`}>
                                                {row.status === 'pending' ? '-' : `+${row.points}`}
                                            </div>
                                            <div className="col-span-1 text-right font-mono text-[var(--muted-foreground)]">
                                                {row.status === 'pending' ? '-' : row.totalScore}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

