"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ArrowRight, Loader2, Trash2, Clock, CheckCircle, PlayCircle, AlertCircle, Users, LogIn, Spade, Heart, Club, Diamond, Trophy } from "lucide-react";

interface GameFile {
    id: string;
    name: string;
    createdTime: string;
    isHidden?: boolean;
    ownerEmail: string;
    playerCount: number;
    currentRoundIndex: number;
}

interface GameState {
    id: string;
    ownerEmail: string;
    currentRoundIndex: number;
    rounds?: Array<{ index: number; state: string; cards: number }>;
    players?: Array<any>;
}

interface DiscoverableGame {
    id: string;
    name: string;
    ownerEmail: string;
    playerCount: number;
    createdAt?: number;
}

import { DECK_SIZE } from "@/lib/config";

// Helper to calculate final round number
function getFinalRoundNumber(numPlayers: number): number {
    if (!numPlayers) return 12; // Default fallback
    const maxCards = Math.floor(DECK_SIZE / numPlayers);
    return maxCards * 2 - 1;
}

export default function Dashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [games, setGames] = useState<GameFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [gameStates, setGameStates] = useState<Record<string, GameState>>({});
    const [deleting, setDeleting] = useState<string | null>(null);
    const [discoverableGames, setDiscoverableGames] = useState<DiscoverableGame[]>([]);
    const [loadingDiscoverable, setLoadingDiscoverable] = useState(true);
    const [showHistory, setShowHistory] = useState(false);

    // Redirect to sign in if not authenticated
    useEffect(() => {
        if (status === 'unauthenticated' || (status !== 'loading' && !session)) {
            const callbackUrl = encodeURIComponent('/dashboard');
            router.replace(`/api/auth/signin?callbackUrl=${callbackUrl}`);
        }
    }, [session, status, router]);

    // Helper function to fetch discoverable games
    const fetchDiscoverableGames = () => {
        fetch("/api/games/discover")
            .then((res) => {
                if (!res.ok) {
                    throw new Error('Failed to fetch discoverable games');
                }
                return res.json();
            })
            .then((data: DiscoverableGame[]) => {
                if (Array.isArray(data)) {
                    setDiscoverableGames(data);
                }
                setLoadingDiscoverable(false);
            })
            .catch((err) => {
                console.error('Error fetching discoverable games:', err);
                setLoadingDiscoverable(false);
            });
    };

    // Fetch games on mount or when showHistory changes
    useEffect(() => {
        if (session) {
            setLoading(true);
            fetch(`/api/games?includeHidden=${showHistory}`)
                .then((res) => {
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                    return res.json();
                })
                .then((data) => {
                    if (Array.isArray(data)) {
                        // Sort games by creation time, newest first
                        const sortedGames = [...data].sort((a: GameFile, b: GameFile) =>
                            new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime()
                        );
                        setGames(sortedGames);
                    }
                    setLoading(false);
                })
                .catch((err) => {
                    console.error('Error fetching games:', err);
                    setLoading(false);
                });
        }
    }, [session, showHistory, router]); // Added router to dependencies for safety

    // Periodic refresh of discoverable games as fallback for WebSocket failures
    useEffect(() => {
        if (!session) return;

        // Initial fetch
        fetchDiscoverableGames();

        // Refresh discoverable games every 30 seconds as a fallback
        const refreshInterval = setInterval(() => {
            fetchDiscoverableGames();
        }, 30000);

        return () => clearInterval(refreshInterval);
    }, [session]);

    // WebSocket connection for discovery updates
    useEffect(() => {
        if (!session) return;

        const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${typeof window !== 'undefined' ? window.location.host : 'localhost:3000'}/ws?channel=discovery`;

        let socket: WebSocket | null = null;
        let reconnectTimeout: NodeJS.Timeout | null = null;
        let reconnectAttempts = 0;
        const maxReconnectAttempts = 5;
        const reconnectDelay = 3000; // 3 seconds

        const connect = () => {
            try {
                socket = new WebSocket(wsUrl);

                socket.onopen = () => {
                    console.log('[Discovery] WebSocket connected');
                    reconnectAttempts = 0; // Reset on successful connection
                };

                socket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);

                        // Check for error messages from server
                        if (data.type === 'ERROR') {
                            console.error('[Discovery] WebSocket server error:', data.message);
                            return;
                        }

                        if (data.type === 'DISCOVERY_UPDATE') {
                            console.log('[Discovery] Received update:', data);

                            // Handle deletion updates immediately (remove from local state)
                            if (data.updateType === 'GAME_DELETED' && data.game) {
                                setDiscoverableGames((prev) =>
                                    prev.filter((g) => g.id !== data.game.id)
                                );
                            } else {
                                // For creation/update, refresh the full list to get sorted order
                                fetch("/api/games/discover")
                                    .then((res) => {
                                        if (!res.ok) {
                                            throw new Error('Failed to fetch discoverable games');
                                        }
                                        return res.json();
                                    })
                                    .then((data: DiscoverableGame[]) => {
                                        if (Array.isArray(data)) {
                                            setDiscoverableGames(data);
                                        }
                                    })
                                    .catch((err) => {
                                        console.error('Error fetching discoverable games:', err);
                                    });
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing discovery WebSocket message:', e);
                    }
                };

                socket.onerror = (event) => {
                    if (process.env.NODE_ENV === 'development') {
                        console.log('[Discovery] WebSocket error event (connection issue, will attempt reconnect):', event);
                    }
                };

                socket.onclose = (event) => {
                    const wasClean = event.wasClean;
                    const code = event.code;
                    const isPolicyViolation = code === 1008;
                    const shouldReconnect = !wasClean && !isPolicyViolation && reconnectAttempts < maxReconnectAttempts;

                    if (shouldReconnect) {
                        reconnectAttempts++;
                        reconnectTimeout = setTimeout(() => {
                            connect();
                        }, reconnectDelay);
                    }
                };
            } catch (error) {
                console.error('[Discovery] Failed to create WebSocket:', error);
            }
        };

        connect();

        return () => {
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
            if (socket) {
                socket.close();
            }
        };
    }, [session]);

    const handleDelete = async (gameId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!confirm("Are you sure you want to remove this game from your dashboard? You can still view it in your history later, and it will count towards the leaderboard.")) {
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

    const hasGameStarted = (game: GameFile): boolean => {
        const state = gameStates[game.id];
        if (state) {
            return state.currentRoundIndex > 0 ||
                (state.rounds !== undefined && state.rounds !== null && state.rounds.some((r: any) => r.state === 'COMPLETED' || r.state === 'PLAYING'));
        }
        return game.currentRoundIndex > 0;
    };

    const canDelete = (game: GameFile): boolean => {
        const state = gameStates[game.id];
        if (state) {
            return state.ownerEmail === session?.user?.email;
        }
        return game.ownerEmail === session?.user?.email;
    };

    const getGameStatus = (game: GameFile) => {
        const state = gameStates[game.id];

        const numPlayers = state?.players?.length || game.playerCount || 0;
        const currentRoundIndex = state?.currentRoundIndex ?? game.currentRoundIndex ?? 0;
        const finalRound = getFinalRoundNumber(numPlayers);

        // Determine if game is completed
        const completedRounds = state?.rounds?.filter(r => r.state === 'COMPLETED') || [];
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

        if (currentRoundIndex > 0 || (state?.rounds && state.rounds.some(r => r.state === 'COMPLETED' || r.state === 'PLAYING'))) {
            return {
                label: `Round ${currentRoundIndex} of ${finalRound}`,
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

    // Show loading state while checking authentication or redirecting
    if (status === 'loading' || !session) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="animate-spin text-muted-foreground" size={32} />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col max-w-4xl mx-auto">
            {/* Fixed Header */}
            <header className="flex-none p-4 md:p-6 bg-[var(--background)]/95 backdrop-blur-md z-10 border-b border-[var(--border)]">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0">
                    <div>
                        <div className="flex items-center gap-2 md:gap-3 mb-1">
                            <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 font-[family-name:var(--font-russo)] tracking-wider drop-shadow-sm">
                                SCOREJUDGE
                            </h1>
                            <div className="flex gap-1 ml-1 shrink-0">
                                <Spade size={14} className="md:w-[18px] md:h-[18px] text-indigo-400 fill-indigo-400/20" />
                                <Heart size={14} className="md:w-[18px] md:h-[18px] text-rose-400 fill-rose-400/20" />
                                <Club size={14} className="md:w-[18px] md:h-[18px] text-emerald-400 fill-emerald-400/20" />
                                <Diamond size={14} className="md:w-[18px] md:h-[18px] text-amber-400 fill-amber-400/20" />
                            </div>
                        </div>
                        <p className="text-muted-foreground font-medium text-sm md:text-base">Live scorekeeper for Judgement</p>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto">
                        <Link
                            href="/create"
                            className="relative group flex-1 md:flex-none px-6 py-3 rounded-xl transition-all duration-300 hover:scale-[1.02] md:hover:scale-105 active:scale-95 shadow-lg hover:shadow-indigo-500/25 flex justify-center items-center"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl opacity-90 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
                            <div className="absolute inset-0 border border-white/20 rounded-xl" />
                            <span className="relative flex items-center gap-2 font-bold text-white tracking-wide">
                                <Plus size={20} strokeWidth={3} />
                                <span className="font-[family-name:var(--font-russo)]">NEW GAME</span>
                            </span>
                        </Link>
                        <Link
                            href="/leaderboard"
                            className="relative group flex-1 md:flex-none px-6 py-3 rounded-xl transition-all duration-300 hover:scale-[1.02] md:hover:scale-105 active:scale-95 shadow-lg hover:shadow-yellow-500/25 flex justify-center items-center"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-yellow-600 to-orange-600 rounded-xl opacity-90 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
                            <div className="absolute inset-0 border border-white/20 rounded-xl" />
                            <span className="relative flex items-center gap-2 font-bold text-white tracking-wide">
                                <Trophy size={20} />
                                <span className="font-[family-name:var(--font-russo)]">LEADERBOARD</span>
                            </span>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 safe-pb">
                {/* Discover Games Section */}
                <div className="space-y-4">
                    <div className="sticky top-0 bg-[var(--background)]/95 backdrop-blur-md py-2 z-10 -mx-2 px-2">
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-600">
                            Discover Games
                        </h2>
                        <p className="text-muted-foreground text-sm">Join games that haven't started yet</p>
                    </div>

                    {loadingDiscoverable ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="animate-spin text-muted-foreground" size={24} />
                        </div>
                    ) : discoverableGames.length === 0 ? (
                        <div className="text-center py-10 glass rounded-xl">
                            <p className="text-muted-foreground">No joinable games available.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {discoverableGames.map((game) => (
                                <div key={game.id} className="glass p-5 rounded-xl flex items-center justify-between group hover:scale-[1.01] transition-all">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="font-semibold text-lg">{game.name}</h3>
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                <Users size={12} />
                                                {game.playerCount}/12 players
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Owner: {game.ownerEmail}
                                        </div>
                                    </div>
                                    <Link
                                        href={`/game/${game.id}`}
                                        className="ml-4 px-4 py-2 bg-[var(--primary)] text-white rounded-lg font-medium flex items-center gap-2 hover:bg-[var(--primary)]/90 transition-all active:scale-95"
                                    >
                                        <LogIn size={16} />
                                        Join
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* My Games Section */}
                <div className="space-y-4">
                    <div className="sticky top-0 bg-[var(--background)]/95 backdrop-blur-md py-2 z-10 -mx-2 px-2 flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
                                My Games
                            </h2>
                            <p className="text-muted-foreground text-sm">Games you've created or joined</p>
                        </div>
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${showHistory
                                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-lg shadow-purple-500/10"
                                : "bg-[var(--muted)]/50 text-[var(--muted-foreground)] hover:bg-[var(--muted)] border border-transparent"
                                }`}
                        >
                            <Clock size={16} />
                            {showHistory ? "Showing History" : "Show History"}
                        </button>
                    </div>

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
                                    const showDelete = canDelete(g);
                                    const isDeleting = deleting === g.id;
                                    const status = getGameStatus(g);
                                    const StatusIcon = status.icon;

                                    return (
                                        <div key={g.id} className="glass p-5 rounded-xl flex items-center justify-between group hover:scale-[1.01] transition-all">
                                            <Link href={`/game/${g.id}`} className="flex-1 flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-semibold text-lg">{g.name.replace('ScoreJudge - ', '')}</h3>
                                                        <div className="flex gap-2">
                                                            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${status.bg} ${status.color} ${status.border || ''}`}>
                                                                <StatusIcon size={12} />
                                                                {status.label}
                                                            </div>
                                                            {g.isHidden && (
                                                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                                                                    Hidden
                                                                </div>
                                                            )}
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
                                                    title="Remove from dashboard (it will still be in your history)"
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
            </div>
        </div>
    );
}
