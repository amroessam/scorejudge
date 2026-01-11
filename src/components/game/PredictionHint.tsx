"use client";

import { useState, useEffect, useRef } from "react";
import { Lightbulb, X, Target, Shield, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PredictionHints, formatBidHint } from "@/lib/predictions";

interface PredictionHintProps {
    hints: PredictionHints;
}

export function PredictionHint({ hints }: PredictionHintProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-close after 6 seconds
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                setIsOpen(false);
            }, 6000);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    if (!hints.show) return null;

    const hasHints = hints.catchUp || hints.stayAhead || hints.winCondition || hints.tiedWith.length > 0;
    if (!hasHints) return null;

    return (
        <div ref={containerRef} className="relative" onClick={(e) => e.stopPropagation()}>
            {/* Trigger Button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className={`
                    p-1.5 rounded-full transition-all
                    ${isOpen
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-amber-400 hover:bg-amber-500/10'
                    }
                `}
                title="Show hints"
                aria-label="Show strategic hints"
            >
                <Lightbulb size={16} className={isOpen ? 'animate-pulse' : ''} />
            </button>

            {/* Hints Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 z-50 w-64 sm:w-72"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-[var(--card)]/95 backdrop-blur-lg border border-[var(--border)] rounded-xl shadow-xl overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-[var(--border)]">
                                <div className="flex items-center gap-1.5">
                                    <Lightbulb size={14} className="text-amber-400" />
                                    <span className="text-xs font-semibold text-amber-400">Smart Hints</span>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 rounded-full hover:bg-white/10 text-[var(--muted-foreground)] hover:text-white transition-colors"
                                    aria-label="Close hints"
                                >
                                    <X size={12} />
                                </button>
                            </div>

                            {/* Hints Content */}
                            <div className="p-2 space-y-1.5">
                                {/* Position & Ties */}
                                {hints.tiedWith.length > 0 && !hints.isEliminated && (
                                    <HintRow
                                        icon={<span className="text-sm">🤝</span>}
                                        color="text-purple-400"
                                        bgColor="bg-purple-500/10"
                                    >
                                        Tied with {hints.tiedWith.slice(0, 2).join(", ")}
                                        {hints.tiedWith.length > 2 && ` +${hints.tiedWith.length - 2}`}
                                    </HintRow>
                                )}

                                {/* Elimination Special Message */}
                                {hints.isEliminated && (
                                    <HintRow
                                        icon={<span className="text-sm">🏳️‍🌈</span>}
                                        color="text-pink-400"
                                        bgColor="bg-pink-500/10"
                                    >
                                        Bid anything you are gay
                                    </HintRow>
                                )}

                                {/* Win Condition */}
                                {hints.winCondition && !hints.isEliminated && (
                                    <HintRow
                                        icon={<Trophy size={12} />}
                                        color="text-yellow-400"
                                        bgColor="bg-yellow-500/10"
                                    >
                                        {hints.winCondition.message}
                                    </HintRow>
                                )}

                                {/* Catch Up (Offensive) */}
                                {hints.catchUp && !hints.isEliminated && (
                                    <HintRow
                                        icon={<Target size={12} />}
                                        color="text-blue-400"
                                        bgColor="bg-blue-500/10"
                                    >
                                        {hints.catchUp.impossible ? (
                                            <span className="text-[var(--muted-foreground)]">
                                                Can&apos;t pass {hints.catchUp.targetName} this round
                                            </span>
                                        ) : hints.tiedWith.includes(hints.catchUp.targetName) ? (
                                            <>
                                                Any made bid beats {hints.catchUp.targetName}
                                            </>
                                        ) : !hints.catchUp.impossibleIfTheyMake ? (
                                            <>
                                                Beat {hints.catchUp.targetName}: {formatBidHint(hints.catchUp.minBidIfTheyMake || 0)}
                                            </>
                                        ) : (
                                            <>
                                                Pass {hints.catchUp.targetName} (if they miss!): {formatBidHint(hints.catchUp.minBid)}
                                            </>
                                        )}
                                    </HintRow>
                                )}

                                {/* Stay Ahead (Defensive) */}
                                {hints.stayAhead && (
                                    <HintRow
                                        icon={<Shield size={12} />}
                                        color={hints.stayAhead.youAreSafe ? "text-green-400" : "text-orange-400"}
                                        bgColor={hints.stayAhead.youAreSafe ? "bg-green-500/10" : "bg-orange-500/10"}
                                    >
                                        {hints.stayAhead.youAreSafe ? (
                                            <>
                                                Safe! {hints.stayAhead.threatName} can&apos;t catch you
                                            </>
                                        ) : (
                                            <>
                                                Watch: {hints.stayAhead.threatName} needs {formatBidHint(hints.stayAhead.theyNeedBid)}
                                            </>
                                        )}
                                    </HintRow>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-3 py-1.5 border-t border-[var(--border)] bg-[var(--background)]/50">
                                <p className="text-[10px] text-[var(--muted-foreground)] text-center">
                                    Auto-closes in 6s • Tap outside to dismiss
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Helper component for consistent hint rows
function HintRow({
    icon,
    color,
    bgColor,
    children
}: {
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    children: React.ReactNode;
}) {
    return (
        <div className={`flex items-start gap-2 px-2.5 py-2 rounded-lg ${bgColor}`}>
            <span className={`${color} shrink-0 mt-0.5`}>{icon}</span>
            <span className="text-xs font-medium text-[var(--foreground)] leading-tight">
                {children}
            </span>
        </div>
    );
}
