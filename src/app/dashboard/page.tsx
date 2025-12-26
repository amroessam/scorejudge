"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ArrowRight, Loader2, Trash2, Clock, CheckCircle, PlayCircle, AlertCircle } from "lucide-react";

interface GameFile {
    id: string;
    name: string;
    createdTime: string;
}

interface GameState {
    id: string;
    ownerEmail: string;
    currentRoundIndex: number;
    rounds?: Array<{ index: number; state: string; cards: number }>;
    players?: Array<any>;
}

// Helper to calculate final round number
function getFinalRoundNumber(numPlayers: number): number {
    if (!numPlayers) return 12; // Default fallback
    const maxCards = Math.floor(52 / numPlayers);
    return maxCards * 2 - 1;
}

export default function Dashboard() {
    const { data: session } = useSession();
    const router = useRouter();
    const [games, setGames] = useState<GameFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [gameStates, setGameStates] = useState<Record<string, GameState>>({});
    const [deleting, setDeleting] = useState<string | null>(null);

    useEffect(() => {
        if (session) {
            fetch("/api/games")
                .then((res) => res.json())
                .then((data) => {
                    if (Array.isArray(data)) {
                        setGames(data);
                        // Fetch game states to check if they've started
                        data.forEach((game: GameFile) => {
                            fetch(`/api/games/${game.id}`)
                                .then((res) => res.json())
                                .then((gameState: GameState) => {
                                    setGameStates((prev) => ({
                                        ...prev,
                                        [game.id]: gameState,
                                    }));
                                })
                                .catch((err) => {
                                    console.error(`Failed to fetch state for game ${game.id}:`, err);
                                });
                        });
                    }
                    setLoading(false);
                })
                .catch((err) => {
                    console.error(err);
                    setLoading(false);
                });
        }
    }, [session]);

    const handleDelete = async (gameId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!confirm("Are you sure you want to delete this game? This will permanently delete the game from Google Drive and cannot be undone.")) {
            return;
        }

        setDeleting(gameId);
        try {
            const res = await fetch(`/api/games/${gameId}`, {
                method: 'DELETE',
            });

            const data = await res.json();

            if (!res.ok) {
                alert(`Failed to delete game: ${data.error || 'Unknown error'}`);
                setDeleting(null);
                return;
            }

            // Remove from local state
            setGames((prev) => prev.filter((g) => g.id !== gameId));
            setGameStates((prev) => {
                const newState = { ...prev };
                delete newState[gameId];
                return newState;
            });
        } catch (err) {
            console.error(err);
            alert("Error deleting game. Please try again.");
        } finally {
            setDeleting(null);
        }
    };

    const hasGameStarted = (gameId: string): boolean => {
        const state = gameStates[gameId];
        if (!state) return false; // Assume started if we don't know
        return state.currentRoundIndex > 0 || 
            (state.rounds !== undefined && state.rounds !== null && state.rounds.some((r: any) => r.state === 'COMPLETED' || r.state === 'PLAYING'));
    };

    const canDelete = (gameId: string): boolean => {
        const state = gameStates[gameId];
        if (!state) return false;
        return state.ownerEmail === session?.user?.email && !hasGameStarted(gameId);
    };

    const getGameStatus = (gameId: string) => {
        const state = gameStates[gameId];
        if (!state) return { label: 'Loading...', color: 'text-gray-500', bg: 'bg-gray-500/10', icon: Loader2 };

        const numPlayers = state.players?.length || 0;
        const finalRound = getFinalRoundNumber(numPlayers);
        
        // Determine if game is completed
        // A game is completed if the last round is marked as COMPLETED and its index >= finalRound
        const completedRounds = state.rounds?.filter(r => r.state === 'COMPLETED') || [];
        const lastCompletedRound = completedRounds.length > 0 
            ? Math.max(...completedRounds.map(r => r.index))
            : 0;
        
        const isCompleted = lastCompletedRound >= finalRound && numPlayers > 0;
        
        if (isCompleted) {
            return { 
                label: 'Completed', 
                color: 'text-green-400', 
                bg: 'bg-green-500/10',
                border: 'border-green-500/20',
                icon: CheckCircle 
            };
        }

        if (state.currentRoundIndex > 0 || (state.rounds && state.rounds.some(r => r.state === 'COMPLETED' || r.state === 'PLAYING'))) {
            return { 
                label: `Round ${state.currentRoundIndex} of ${finalRound}`, 
                color: 'text-indigo-400', 
                bg: 'bg-indigo-500/10',
                border: 'border-indigo-500/20',
                icon: PlayCircle 
            };
        }

        return { 
            label: 'Not Started', 
            color: 'text-yellow-400', 
            bg: 'bg-yellow-500/10',
            border: 'border-yellow-500/20',
            icon: AlertCircle 
        };
    };

    if (!session) return <div className="p-10 text-center">Please sign in.</div>;

    return (
        <div className="min-h-screen p-6 max-w-4xl mx-auto space-y-8">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
                        My Games
                    </h1>
                    <p className="text-muted-foreground">Manage your ScoreJudge sessions.</p>
                </div>
                <Link href="/create" className="glass px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-white/10 transition">
                    <Plus size={18} /> New Game
                </Link>
            </header>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-muted-foreground" size={32} />
                </div>
            ) : (
                <div className="grid gap-4">
                    {games.length === 0 ? (
                        <div className="text-center py-20 glass rounded-xl">
                            <p className="text-muted-foreground">No games found. Start one now!</p>
                        </div>
                    ) : (
                        games.map((g) => {
                            const showDelete = canDelete(g.id);
                            const isDeleting = deleting === g.id;
                            const status = getGameStatus(g.id);
                            const StatusIcon = status.icon;
                            
                            return (
                                <div key={g.id} className="glass p-5 rounded-xl flex items-center justify-between group hover:scale-[1.01] transition-all">
                                    <Link href={`/game/${g.id}`} className="flex-1 flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="font-semibold text-lg">{g.name.replace('ScoreJudge - ', '')}</h3>
                                                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${status.bg} ${status.color} ${status.border || ''}`}>
                                                    <StatusIcon size={12} />
                                                    {status.label}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Clock size={12} />
                                                    {new Date(g.createdTime).toLocaleDateString()}
                                                </span>
                                                {status.label !== 'Completed' && status.label !== 'Not Started' && status.label !== 'Loading...' && (
                                                    <span className="text-indigo-400 font-medium flex items-center gap-1">
                                                        Resume Game <ArrowRight size={12} />
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity mr-4">
                                            <ArrowRight className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </Link>
                                    {showDelete && (
                                        <button
                                            onClick={(e) => handleDelete(g.id, e)}
                                            disabled={isDeleting}
                                            className="ml-2 p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Delete game (only for games that haven't started)"
                                        >
                                            {isDeleting ? (
                                                <Loader2 className="animate-spin w-5 h-5" />
                                            ) : (
                                                <Trash2 className="w-5 h-5" />
                                            )}
                                        </button>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
