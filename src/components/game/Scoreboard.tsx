"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
    Settings,
    Plus,
    Undo2,
    Crown,
    Home,
    Sparkles,
    ArrowRight,
    CheckCircle,
    Target,
    Flame,
    Share2,
    Loader2
} from "lucide-react";
import { Player } from "@/lib/store";
import { useRouter } from "next/navigation";
import { PlayerHistoryOverlay } from "./PlayerHistoryOverlay";
import { PredictionHint } from "./PredictionHint";
import { DECK_SIZE } from "@/lib/config";
import { ShareableScorecard } from "@/components/sharing/ShareableScorecard";
import { toBlob } from "html-to-image";
import { AnimatePresence, motion } from "framer-motion";
import { getAvatarUrl } from "@/lib/utils";
import { calculatePredictions } from "@/lib/predictions";

interface ScoreboardProps {
    gameId: string;
    gameState: any;
    isOwner: boolean;
    currentUserEmail?: string;
    onOpenEntry: () => void;
    onUndo: () => void;
    onOpenSettings: () => void;
    onNextRound?: () => void;
}

// Helper to get trump full name
function getTrumpFullName(trump: string): string {
    const trumpMap: Record<string, string> = {
        'S': 'Spades',
        'D': 'Diamonds',
        'C': 'Clubs',
        'H': 'Hearts',
        'NT': 'No Trump'
    };
    return trumpMap[trump] || trump || 'NT';
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

// Helper to calculate final round number
function getFinalRoundNumber(numPlayers: number): number {
    const maxCards = Math.floor(DECK_SIZE / numPlayers);
    return maxCards * 2 - 1;
}

// Helper to get position medal/emoji
function getPositionIndicator(score: number, distinctScores: number[], currentRoundIndex: number): string | null {
    // No medals in round 1 (everyone starts at 0)
    if (currentRoundIndex <= 1) return null;

    const rankIndex = distinctScores.indexOf(score);
    if (rankIndex === -1) return null;

    // Last place flag (only if there are at least 2 distinct scores)
    if (distinctScores.length > 1 && rankIndex === distinctScores.length - 1) {
        return '🏳️‍🌈';
    }

    if (rankIndex === 0) return '🥇'; // Gold - 1st place
    if (rankIndex === 1) return '🥈'; // Silver - 2nd place
    if (rankIndex === 2) return '🥉'; // Bronze - 3rd place

    return null;
}

export function Scoreboard({
    gameId,
    gameState,
    isOwner,
    currentUserEmail,
    onOpenEntry,
    onUndo,
    onOpenSettings,
    onNextRound
}: ScoreboardProps) {
    const router = useRouter();
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [showLastPlayerMessage, setShowLastPlayerMessage] = useState(true);
    const { players, currentRoundIndex, rounds, firstDealerEmail, name: gameName } = gameState;
    const activeRound = rounds.find((r: any) => r.index === currentRoundIndex);

    // Store previous scores to detect changes for animation
    // eslint-disable-next-line
    const prevScoresRef = useRef<Record<string, number>>({});
    // eslint-disable-next-line
    const [scoreDiffs, setScoreDiffs] = useState<Record<string, { val: number, id: number }>>({});

    useEffect(() => {
        const newDiffs: Record<string, { val: number, id: number }> = {};
        let hasChanges = false;

        players.forEach((p: Player) => {
            const prev = prevScoresRef.current[p.email];
            if (prev !== undefined && prev !== p.score) {
                newDiffs[p.email] = { val: p.score - prev, id: Date.now() };
                hasChanges = true;
            }
            prevScoresRef.current[p.email] = p.score;
        });

        if (hasChanges) {
            setScoreDiffs(prev => ({ ...prev, ...newDiffs }));

            // Clear these specific diffs after a delay to allow animation to play
            setTimeout(() => {
                setScoreDiffs(prev => {
                    const next = { ...prev };
                    Object.keys(newDiffs).forEach(key => {
                        // Only delete if it matches the current update ID (prevent race conditions)
                        if (next[key] && next[key].id === newDiffs[key].id) {
                            delete next[key];
                        }
                    });
                    return next;
                });
            }, 2000);
        }
    }, [players]);

    // Calculate final round and check if game ended
    const finalRoundNumber = getFinalRoundNumber(players.length);
    const completedRounds = rounds.filter((r: any) => r.state === 'COMPLETED');
    const lastCompletedRound = completedRounds.length > 0
        ? Math.max(...completedRounds.map((r: any) => r.index))
        : 0;
    const isGameEnded = lastCompletedRound >= finalRoundNumber;
    const isFinalRound = currentRoundIndex >= finalRoundNumber;

    // Calculate predictions for current user
    const predictionHints = useMemo(() => {
        if (!currentUserEmail || isGameEnded || !activeRound) return null;
        return calculatePredictions(
            currentUserEmail,
            players,
            currentRoundIndex,
            activeRound.cards,
            players.length,
            isFinalRound
        );
    }, [currentUserEmail, players, activeRound, isGameEnded, isFinalRound]);

    const scorecardRef = useRef<HTMLDivElement>(null);

    const handleCreateNewGame = () => {
        window.location.href = '/create';
    };

    const handleShare = async () => {
        setIsSharing(true);
        try {
            if (!scorecardRef.current) return;

            // Use html-to-image to capture the pre-rendered component
            // We use pixelRatio: 3 to ensure very high quality (better than standard Retina)
            const blob = await toBlob(scorecardRef.current, {
                cacheBust: true,
                pixelRatio: 3,
                backgroundColor: '#050510', // Consistent background
                style: {
                    // Ensure the element is fully visible for the capture logic, even if offscreen
                    transform: 'scale(1)',
                    transformOrigin: 'top left'
                }
            });

            if (!blob) throw new Error('Failed to generate image blob');

            const file = new File([blob], 'scorejudge-results.png', { type: 'image/png' });

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'ScoreJudge Results',
                        text: `Game results for ${gameState.name}`,
                        files: [file]
                    });
                } catch (e) {
                    // Fallback to download if share is cancelled/fails
                    if ((e as Error).name !== 'AbortError') {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'scorejudge-results.png';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }
                }
                // Fallback download
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'scorejudge-results.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }

        } catch (e) {
            console.error('Error sharing results:', e);
            alert('Failed to generate image. Please try again.');
        } finally {
            setIsSharing(false);
        }
    };

    const handleGoToDashboard = () => {
        window.location.href = '/dashboard';
    };

    // Calculate Dealer
    let firstDealerIndex = 0;
    if (firstDealerEmail) {
        const idx = players.findIndex((p: Player) => p.email === firstDealerEmail);
        if (idx !== -1) firstDealerIndex = idx;
    }
    const dealerIndex = (firstDealerIndex + (currentRoundIndex - 1)) % players.length;
    const dealer = players[dealerIndex];

    const sortedPlayers = [...players].sort((a: Player, b: Player) => b.score - a.score);
    // Dense ranking: identify distinct scores for tie-aware medals
    const distinctScores = Array.from(new Set(sortedPlayers.map(p => p.score)));
    const topScore = distinctScores[0];
    const bottomScore = distinctScores[distinctScores.length - 1];

    const isWinner = currentUserEmail !== undefined &&
        players.find((p: Player) => p.email === currentUserEmail)?.score === topScore;

    const isLastPlayer = currentUserEmail !== undefined &&
        distinctScores.length > 1 &&
        players.find((p: Player) => p.email === currentUserEmail)?.score === bottomScore;

    // Auto-dismiss last player message after 5 seconds
    useEffect(() => {
        if (isGameEnded && isLastPlayer && showLastPlayerMessage) {
            const timer = setTimeout(() => {
                setShowLastPlayerMessage(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [isGameEnded, isLastPlayer, showLastPlayerMessage]);

    // --- UX FEATURES LOGIC ---

    // 1. Table Mood
    let tableMood = null;
    if (activeRound && activeRound.bids && Object.keys(activeRound.bids).length === players.length) {
        const totalBids = Object.values(activeRound.bids).reduce((sum: number, b: any) => sum + (b || 0), 0) as number;
        if (totalBids > activeRound.cards) {
            tableMood = { text: "Aggressive", icon: "🔥", color: "text-orange-500 bg-orange-500/10 border-orange-500/20" };
        } else if (totalBids < activeRound.cards) {
            tableMood = { text: "Tentative", icon: "❄️", color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20" };
        } else {
            tableMood = { text: "Balanced", icon: "⚖️", color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20" };
        }
    }

    // Trigger confetti for winner when game ends
    useEffect(() => {
        if (isGameEnded && isWinner) {
            // Fire confetti multiple times for a longer celebration
            const duration = 5000;
            const end = Date.now() + duration;

            const interval = setInterval(() => {
                if (Date.now() > end) {
                    clearInterval(interval);
                    return;
                }

                confetti({
                    particleCount: 3,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A']
                });
                confetti({
                    particleCount: 3,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A']
                });
            }, 250);

            // Cleanup function to clear interval if component unmounts or dependencies change
            return () => {
                clearInterval(interval);
            };
        }
    }, [isGameEnded, isWinner]);

    // Profile picture upload is only available in the lobby (GameSetup), not during the game

    return (
        <div className="flex flex-col h-full bg-[var(--background)] overflow-hidden">

            {/* Winner Confetti Overlay - only visible to winner */}
            {isGameEnded && isWinner && (
                <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-6xl mb-4 animate-bounce">🎉</div>
                        <div className="text-4xl font-bold text-yellow-400 drop-shadow-lg">
                            YOU WON!
                        </div>
                    </div>
                </div>
            )}

            {/* Last Player Message */}
            {isGameEnded && isLastPlayer && showLastPlayerMessage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-gradient-to-r from-red-500 via-orange-500 via-yellow-500 via-green-500 via-blue-500 via-indigo-500 to-purple-500 p-1 rounded-2xl animate-pulse">
                        <div className="bg-[var(--card)] rounded-xl p-8 text-center relative">
                            {/* Close button */}
                            <button
                                onClick={() => setShowLastPlayerMessage(false)}
                                className="absolute top-4 right-4 text-[var(--muted-foreground)] hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                                aria-label="Close"
                            >
                                ✕
                            </button>

                            <div className="text-8xl mb-4 animate-bounce">🏳️‍🌈</div>
                            <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 via-yellow-500 via-green-500 via-blue-500 via-indigo-500 to-purple-500 mb-2">
                                YOU ARE GAY
                            </div>
                            <div className="text-xl text-[var(--muted-foreground)] mt-4">
                                Better luck next time! 🎮
                            </div>
                            <div className="text-sm text-[var(--muted-foreground)] mt-4 opacity-60">
                                Auto-closing in 5s...
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Top Bar */}
            <div className="z-10 bg-[var(--background)]/90 backdrop-blur-md border-b border-[var(--border)] p-4 pt-safe-top">
                <div className="flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                                {isGameEnded ? 'Game Status' : `Round ${currentRoundIndex}`}
                            </h2>
                            {/* Table Mood Indicator */}
                            {tableMood && !isGameEnded && (
                                <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border ${tableMood.color}`}>
                                    <span>{tableMood.icon}</span>
                                    <span>{tableMood.text}</span>
                                </div>
                            )}
                        </div>
                        {isGameEnded ? (
                            <div className="flex flex-col items-start mt-1">
                                <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-bold flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                                    <CheckCircle size={14} strokeWidth={2.5} />
                                    FINAL ROUND ({finalRoundNumber}) COMPLETED
                                </div>
                            </div>
                        ) : activeRound && (
                            <div className="flex items-center gap-2 text-xl font-bold">
                                <span>{activeRound.cards} Cards</span>
                                <span className="text-[var(--border)]">|</span>
                                <div className="flex items-center gap-1">
                                    {getTrumpIcon(activeRound.trump)}
                                    <span className="text-sm font-normal text-[var(--muted-foreground)]">
                                        {getTrumpFullName(activeRound.trump)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                    {/* Top Right Actions */}
                    <div className="flex items-center gap-2">
                        {/* Dashboard button - icon only during rounds */}
                        {!isGameEnded && (
                            <button
                                onClick={handleGoToDashboard}
                                className="p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] active:scale-95 transition-transform touch-manipulation"
                                title="Dashboard"
                            >
                                <Home size={24} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Score List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 overscroll-contain">
                {sortedPlayers.map((player: Player, index: number) => {
                    const isDealer = player.email === dealer?.email;
                    const isMe = player.email === currentUserEmail;
                    const isLast = isGameEnded && distinctScores.length > 1 && player.score === bottomScore;
                    const positionIndicator = getPositionIndicator(player.score, distinctScores, currentRoundIndex);

                    const bid = activeRound?.bids?.[player.email];
                    const tricks = activeRound?.tricks?.[player.email];
                    const hasBid = bid !== undefined;
                    const hasTricks = tricks !== undefined && tricks !== -1;

                    // Calculate W/L History & Streak for Momentum
                    const history = rounds
                        .filter((r: any) => r.state === 'COMPLETED' && r.bids?.[player.email] !== undefined)
                        .sort((a: any, b: any) => a.index - b.index)
                        .map((r: any) => {
                            const b = r.bids[player.email];
                            const t = r.tricks?.[player.email];
                            return b === t;
                        });

                    // 2. Momentum Glow Calculation
                    let currentStreak = 0;
                    for (let i = history.length - 1; i >= 0; i--) {
                        if (history[i]) currentStreak++;
                        else break;
                    }
                    const isOnFire = currentStreak >= 3;
                    const isGodlike = currentStreak >= 5;

                    // 3. Nemesis Logic: Highlight player directly above user
                    // Current user logic: calculate rank of current user
                    let isNemesis = false;
                    if (currentUserEmail) {
                        const myPlayerRaw = players.find((p: Player) => p.email === currentUserEmail);
                        if (myPlayerRaw) {
                            const myRankIndex = sortedPlayers.findIndex(p => p.email === currentUserEmail);
                            // Nemesis is key if myRankIndex > 0 (not first) and this player is at myRankIndex - 1
                            if (myRankIndex > 0 && index === myRankIndex - 1) {
                                isNemesis = true;
                            }
                        }
                    }

                    return (
                        <div
                            key={player.email}
                            onClick={() => setSelectedPlayer(player)}
                            className={`
                                relative p-4 rounded-xl border bg-[var(--card)] transition-all cursor-pointer hover:bg-[var(--secondary)]/50 touch-manipulation
                                ${isMe ? 'border-[var(--primary)]/50 bg-[var(--primary)]/5' : 'border-[var(--border)]'}
                                ${isLast ? 'border-2 border-purple-500/50 bg-gradient-to-r from-red-500/10 via-orange-500/10 via-yellow-500/10 via-green-500/10 via-blue-500/10 via-indigo-500/10 to-purple-500/10' : ''}
                                ${isNemesis && !isMe ? 'border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : ''}
                                ${isOnFire ? 'shadow-[0_0_15px_rgba(249,115,22,0.15)] border-orange-500/30' : ''}
                                ${isGodlike ? 'shadow-[0_0_20px_rgba(59,130,246,0.25)] border-blue-500/50' : ''}
                            `}
                        >
                            {/* Nemesis Label */}
                            {isNemesis && (
                                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-[10px] font-bold text-white px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1" aria-label="Nemesis Target">
                                    <Target size={10} />
                                    <span>NEMESIS</span>
                                </div>
                            )}

                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    {/* Avatar/Dealer Chip */}
                                    <div className="relative shrink-0">
                                        <img
                                            src={getAvatarUrl(player.image)}
                                            alt={player.name}
                                            className={`w-10 h-10 rounded-full object-cover ${isGodlike ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-[var(--card)]' : ''} ${isOnFire && !isGodlike ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-[var(--card)]' : ''}`}
                                        />
                                        {isDealer && (
                                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full shadow-md flex items-center justify-center border-2 border-white dark:border-gray-800">
                                                <span className="text-[9px] font-bold text-white">D</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        {/* Player Name Row */}
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-[family-name:var(--font-russo)] text-lg leading-tight tracking-wide">
                                                {player.name}
                                            </span>
                                            {positionIndicator && (
                                                <span className="text-base">{positionIndicator}</span>
                                            )}
                                            {/* Momentum Icon */}
                                            {isGodlike ? (
                                                <span className="text-sm animate-pulse" title="5+ Streak!">🔵</span>
                                            ) : isOnFire ? (
                                                <span className="text-sm animate-bounce" title="3+ Streak!">🔥</span>
                                            ) : null}

                                            {isMe && (
                                                <span className="text-xs font-normal text-[var(--muted-foreground)] font-sans">(You)</span>
                                            )}
                                        </div>

                                        {/* W/L History Row - separate row with wrapping */}
                                        {history.length > 0 && (
                                            <div className="flex flex-wrap gap-0.5 mt-1 max-w-full">
                                                {history.map((isWin: boolean, i: number) => (
                                                    <span
                                                        key={i}
                                                        className={`text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-sm ${isWin
                                                            ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                                                            : 'bg-red-500/20 text-red-600 dark:text-red-400'
                                                            }`}
                                                    >
                                                        {isWin ? 'W' : 'L'}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Current Round Stats */}
                                        {activeRound && (
                                            <div className="flex items-center gap-3 text-xs font-mono text-[var(--muted-foreground)] mt-1">
                                                <div className="flex items-center gap-1 bg-[var(--background)] px-1.5 py-0.5 rounded">
                                                    <span>Bid:</span>
                                                    <span className={hasBid ? 'text-[var(--foreground)] font-bold' : ''}>
                                                        {hasBid ? bid : '-'}
                                                    </span>
                                                </div>
                                                {activeRound.state !== 'BIDDING' && (
                                                    <div className="flex items-center gap-1 bg-[var(--background)] px-1.5 py-0.5 rounded">
                                                        <span>Tricks:</span>
                                                        <span className={hasTricks ? 'text-[var(--foreground)] font-bold' : ''}>
                                                            {hasTricks ? tricks : '-'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Total Score with Floating Animation + Prediction Hint */}
                                <div className="relative shrink-0 flex flex-col items-end">
                                    <div className="flex items-center gap-2">
                                        <div className="text-3xl font-bold tracking-tight font-mono">
                                            {player.score}
                                        </div>
                                        {/* Prediction Hint - only for current user */}
                                        {isMe && predictionHints && predictionHints.show && !isGameEnded && (
                                            <PredictionHint hints={predictionHints} />
                                        )}
                                    </div>
                                    <AnimatePresence>
                                        {scoreDiffs[player.email] && (
                                            <motion.div
                                                key={scoreDiffs[player.email].id}
                                                initial={{ opacity: 0, y: 10, scale: 0.5 }}
                                                animate={{ opacity: 1, y: -20, scale: 1.2 }}
                                                exit={{ opacity: 0, y: -40 }}
                                                transition={{ duration: 0.8, ease: "easeOut" }}
                                                className={`absolute top-0 right-0 text-lg font-bold ${scoreDiffs[player.email].val >= 0 ? 'text-green-500' : 'text-red-500'
                                                    }`}
                                            >
                                                {scoreDiffs[player.email].val > 0 ? '+' : ''}{scoreDiffs[player.email].val}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Bottom Bar */}
            <div className="bg-[var(--background)]/90 backdrop-blur-md border-t border-[var(--border)] safe-pb">
                <div className="px-4 pb-4 pt-4">
                    <div className="flex items-center gap-4 max-w-md mx-auto">
                        {/* Secondary Actions - Only show undo for host, and only if game not ended */}
                        {isOwner && !isGameEnded && (
                            <button
                                onClick={onUndo}
                                className="p-3 rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] active:scale-95 transition-transform touch-manipulation"
                            >
                                <Undo2 size={24} />
                            </button>
                        )}

                        {/* Primary Action */}
                        {isGameEnded ? (
                            <div className="flex flex-col gap-2 w-full">
                                <div className="flex gap-2">
                                    {/* Create New Game Button */}
                                    <button
                                        onClick={handleCreateNewGame}
                                        className="flex-1 bg-[var(--primary)] text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform touch-manipulation"
                                    >
                                        <Sparkles size={20} />
                                        New Game
                                    </button>
                                    {/* Dashboard Button */}
                                    <button
                                        onClick={handleGoToDashboard}
                                        className="bg-[var(--secondary)] text-[var(--foreground)] px-6 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform touch-manipulation"
                                    >
                                        <Home size={20} />
                                    </button>
                                </div>
                                {/* Share Button */}
                                <button
                                    onClick={handleShare}
                                    disabled={isSharing}
                                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform touch-manipulation disabled:opacity-75"
                                >
                                    {isSharing ? <Loader2 size={20} className="animate-spin" /> : <Share2 size={20} />}
                                    {isSharing ? 'Generating...' : 'Share Results'}
                                </button>
                            </div>
                        ) : isOwner ? (
                            activeRound?.state === 'COMPLETED' && !isGameEnded ? (
                                <button
                                    onClick={onNextRound}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform touch-manipulation"
                                >
                                    Next Round <ArrowRight size={24} />
                                </button>
                            ) : !isGameEnded ? (
                                <button
                                    onClick={onOpenEntry}
                                    className="flex-1 bg-[var(--primary)] text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform touch-manipulation"
                                >
                                    <Plus size={24} />
                                    {activeRound?.state === 'BIDDING' ? 'Enter Bids' : 'Enter Scores'}
                                </button>
                            ) : null
                        ) : (
                            <div className="flex-1 text-center text-[var(--muted-foreground)] py-3 font-medium">
                                Waiting for host...
                            </div>
                        )}

                        {/* Settings - Only show if game not ended */}
                        {!isGameEnded && (
                            <button
                                onClick={onOpenSettings}
                                className="p-3 rounded-full bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] hover:border-[var(--primary)]/30 active:scale-95 transition-all touch-manipulation shadow-sm"
                            >
                                <Settings size={22} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <PlayerHistoryOverlay
                isOpen={!!selectedPlayer}
                onClose={() => setSelectedPlayer(null)}
                player={selectedPlayer}
                rounds={rounds}
            />

            {/* Hidden Scorecard for Capture */}
            <div style={{ position: 'absolute', top: -9999, left: -9999, visibility: 'visible' }}>
                <ShareableScorecard
                    ref={scorecardRef}
                    gameName={gameState.name}
                    players={gameState.players}
                />
            </div>
        </div>
    );
}
