"use client";

import { 
    Trophy, 
    History, 
    Settings, 
    Plus, 
    Undo2, 
    Crown,
    Home,
    Sparkles
} from "lucide-react";
import { Player } from "@/lib/store";
import { useRouter } from "next/navigation";

interface ScoreboardProps {
    gameId: string;
    gameState: any;
    isOwner: boolean;
    currentUserEmail?: string;
    onOpenEntry: () => void;
    onUndo: () => void;
    onOpenSettings: () => void;
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
    return Math.floor(6 / numPlayers) * 2;
}

export function Scoreboard({ 
    gameId, 
    gameState, 
    isOwner, 
    currentUserEmail, 
    onOpenEntry,
    onUndo,
    onOpenSettings
}: ScoreboardProps) {
    const router = useRouter();
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

    return (
        <div className="flex flex-col h-full bg-[var(--background)]">
            {/* Sticky Top Bar */}
            <div className="sticky top-0 z-10 bg-[var(--background)]/90 backdrop-blur-md border-b border-[var(--border)] p-4 safe-pb-0">
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
                            className="p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] active:scale-95 transition-transform"
                            title="Dashboard"
                        >
                            <Home size={24} />
                        </button>
                    )}
                </div>
            </div>

            {/* Score List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
                {players.map((player: Player) => {
                    const isLeader = player.email === leaderEmail && currentRoundIndex > 1;
                    const isDealer = player.email === dealer?.email;
                    const isMe = player.email === currentUserEmail;
                    
                    const bid = activeRound?.bids?.[player.email];
                    const tricks = activeRound?.tricks?.[player.email];
                    const hasBid = bid !== undefined;
                    const hasTricks = tricks !== undefined && tricks !== -1;

                    return (
                        <div 
                            key={player.email} 
                            className={`
                                relative p-4 rounded-xl border bg-[var(--card)] transition-all
                                ${isMe ? 'border-[var(--primary)]/50 bg-[var(--primary)]/5' : 'border-[var(--border)]'}
                            `}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {/* Avatar/Dealer Chip */}
                                    <div className="relative">
                                        <div className={`
                                            w-10 h-10 rounded-full flex items-center justify-center font-bold
                                            ${isLeader ? 'bg-yellow-500 text-black' : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'}
                                        `}>
                                            {isLeader ? <Trophy size={18} /> : player.name.charAt(0)}
                                        </div>
                                        {isDealer && (
                                            <div className="absolute -top-1 -right-1 bg-[var(--primary)] text-white p-0.5 rounded-full shadow-sm border border-[var(--background)]">
                                                <span className="text-[10px] font-bold px-1">D</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <div className="font-semibold text-lg leading-none mb-1">
                                            {player.name} {isMe && <span className="text-xs font-normal text-[var(--muted-foreground)]">(You)</span>}
                                        </div>
                                        {/* Current Round Stats */}
                                        {activeRound && (
                                            <div className="flex items-center gap-3 text-xs font-mono text-[var(--muted-foreground)]">
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
                                <div className="text-4xl font-bold tracking-tight font-mono">
                                    {player.score}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Sticky Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-[var(--background)]/90 backdrop-blur-md border-t border-[var(--border)] safe-pb">
                <div className="px-4 pb-4 pt-4">
                    <div className="flex items-center gap-4 max-w-md mx-auto">
                        {/* Secondary Actions - Only show undo for host, and only if game not ended */}
                        {isOwner && !isGameEnded && (
                            <button 
                                onClick={onUndo}
                                className="p-3 rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] active:scale-95 transition-transform"
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
                                    className="flex-1 bg-[var(--primary)] text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
                                >
                                    <Sparkles size={20} />
                                    New Game
                                </button>
                                {/* Dashboard Button */}
                                <button 
                                    onClick={handleGoToDashboard}
                                    className="flex-1 bg-[var(--secondary)] text-[var(--foreground)] py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
                                >
                                    <Home size={20} />
                                    Dashboard
                                </button>
                            </>
                        ) : isOwner ? (
                            <button 
                                onClick={onOpenEntry}
                                className="flex-1 bg-[var(--primary)] text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
                            >
                                <Plus size={24} />
                                {activeRound?.state === 'BIDDING' ? 'Enter Bids' : 'Enter Scores'}
                            </button>
                        ) : (
                            <div className="flex-1 text-center text-[var(--muted-foreground)] py-3 font-medium">
                                Waiting for host...
                            </div>
                        )}
                        
                        {/* Settings - Only show if game not ended */}
                        {!isGameEnded && (
                            <button 
                                onClick={onOpenSettings}
                                className="p-3 rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] active:scale-95 transition-transform"
                            >
                                <Settings size={24} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

