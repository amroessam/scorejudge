"use client";

import { useState, useEffect } from "react";
import { 
    Settings, 
    Plus, 
    Undo2, 
    Crown,
    Home,
    Sparkles,
    ArrowRight
} from "lucide-react";
import { Player } from "@/lib/store";
import { useRouter } from "next/navigation";
import { PlayerHistoryOverlay } from "./PlayerHistoryOverlay";
import { DECK_SIZE } from "@/lib/config";
import confetti from "canvas-confetti";

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
function getPositionIndicator(position: number, totalPlayers: number, isGameEnded: boolean): string | null {
    if (position === 0) return '🥇'; // Gold - 1st place
    if (position === 1) return '🥈'; // Silver - 2nd place
    if (position === 2) return '🥉'; // Bronze - 3rd place
    if (position === totalPlayers - 1 && isGameEnded) return '🏳️‍🌈'; // Last place (only when game ended)
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
    const { players, currentRoundIndex, rounds, firstDealerEmail } = gameState;
    const activeRound = rounds.find((r: any) => r.index === currentRoundIndex);
    
    // Calculate final round and check if game ended
    const finalRoundNumber = getFinalRoundNumber(players.length);
    const completedRounds = rounds.filter((r: any) => r.state === 'COMPLETED');
    const lastCompletedRound = completedRounds.length > 0 
        ? Math.max(...completedRounds.map((r: any) => r.index))
        : 0;
    const isGameEnded = lastCompletedRound >= finalRoundNumber;
    
    const handleCreateNewGame = () => {
        router.push('/create');
    };
    
    const handleGoToDashboard = () => {
        router.push('/dashboard');
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
    const leaderEmail = sortedPlayers[0]?.email;
    const lastPlayer = sortedPlayers[sortedPlayers.length - 1];
    const isWinner = currentUserEmail === leaderEmail;
    const isLastPlayer = currentUserEmail === lastPlayer?.email;

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
            {isGameEnded && isLastPlayer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-gradient-to-r from-red-500 via-orange-500 via-yellow-500 via-green-500 via-blue-500 via-indigo-500 to-purple-500 p-1 rounded-2xl animate-pulse">
                        <div className="bg-[var(--card)] rounded-xl p-8 text-center">
                            <div className="text-8xl mb-4 animate-bounce">🏳️‍🌈</div>
                            <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 via-yellow-500 via-green-500 via-blue-500 via-indigo-500 to-purple-500 mb-2">
                                YOU ARE GAY
                            </div>
                            <div className="text-xl text-[var(--muted-foreground)] mt-4">
                                Better luck next time! 🎮
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Top Bar */}
            <div className="z-10 bg-[var(--background)]/90 backdrop-blur-md border-b border-[var(--border)] p-4 pt-safe-top">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                            {isGameEnded ? 'Game Ended' : `Round ${currentRoundIndex}`}
                        </h2>
                        {isGameEnded ? (
                            <div className="text-lg font-bold text-green-400">
                                Final Round ({finalRoundNumber}) Completed
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

            {/* Score List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 overscroll-contain">
                {sortedPlayers.map((player: Player, index: number) => {
                    const isDealer = player.email === dealer?.email;
                    const isMe = player.email === currentUserEmail;
                    const isLast = index === sortedPlayers.length - 1 && isGameEnded;
                    const positionIndicator = getPositionIndicator(index, sortedPlayers.length, isGameEnded);
                    
                    const bid = activeRound?.bids?.[player.email];
                    const tricks = activeRound?.tricks?.[player.email];
                    const hasBid = bid !== undefined;
                    const hasTricks = tricks !== undefined && tricks !== -1;

                     // Calculate W/L History
                    const history = rounds
                        .filter((r: any) => r.state === 'COMPLETED' && r.bids?.[player.email] !== undefined)
                        .sort((a: any, b: any) => a.index - b.index)
                        .map((r: any) => {
                            const bid = r.bids[player.email];
                            const tricks = r.tricks?.[player.email];
                            // Win if bid met exactly, Loss otherwise
                            return bid === tricks;
                        });

                    return (
                        <div 
                            key={player.email} 
                            onClick={() => setSelectedPlayer(player)}
                            className={`
                                relative p-4 rounded-xl border bg-[var(--card)] transition-all cursor-pointer hover:bg-[var(--secondary)]/50 touch-manipulation
                                ${isMe ? 'border-[var(--primary)]/50 bg-[var(--primary)]/5' : 'border-[var(--border)]'}
                                ${isLast ? 'border-2 border-purple-500/50 bg-gradient-to-r from-red-500/10 via-yellow-500/10 via-green-500/10 via-blue-500/10 via-indigo-500/10 to-purple-500/10' : ''}
                            `}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    {/* Avatar/Dealer Chip */}
                                    <div className="relative shrink-0">
                                        {player.image ? (
                                            <img 
                                                src={player.image} 
                                                alt={player.name}
                                                className="w-10 h-10 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold bg-[var(--secondary)] text-[var(--muted-foreground)]">
                                                {player.name.charAt(0)}
                                            </div>
                                        )}
                                        {isDealer && (
                                            <div className="absolute -top-1 -right-1 bg-[var(--primary)] text-white p-0.5 rounded-full shadow-sm border border-[var(--background)]">
                                                <span className="text-[10px] font-bold px-1">D</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="min-w-0 flex-1">
                                        {/* Player Name Row */}
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-semibold text-lg leading-tight">
                                                {player.name}
                                            </span>
                                            {positionIndicator && (
                                                <span className="text-base">{positionIndicator}</span>
                                            )}
                                            {isMe && (
                                                <span className="text-xs font-normal text-[var(--muted-foreground)]">(You)</span>
                                            )}
                                        </div>
                                        
                                        {/* W/L History Row - separate row with wrapping */}
                                        {history.length > 0 && (
                                            <div className="flex flex-wrap gap-0.5 mt-1 max-w-full">
                                                {history.map((isWin: boolean, i: number) => (
                                                    <span 
                                                        key={i} 
                                                        className={`text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-sm ${
                                                            isWin 
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

                                {/* Total Score */}
                                <div className="text-3xl font-bold tracking-tight font-mono shrink-0">
                                    {player.score}
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
                            <>
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
                                    className="flex-1 bg-[var(--secondary)] text-[var(--foreground)] py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform touch-manipulation"
                                >
                                    <Home size={20} />
                                    Dashboard
                                </button>
                            </>
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
                                className="p-3 rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] active:scale-95 transition-transform touch-manipulation"
                            >
                                <Settings size={24} />
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
        </div>
    );
}
