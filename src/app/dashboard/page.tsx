"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Loader2, CheckCircle, PlayCircle, AlertCircle, Spade, Heart, Club, Diamond, Trophy, History, Settings } from "lucide-react";
import { ProfileSettingsOverlay } from "@/components/dashboard/ProfileSettingsOverlay";
import { GameCard } from "@/components/dashboard/GameCard";
import { DiscoverableGameCard } from "@/components/dashboard/DiscoverableGameCard";
import { getAvatarUrl } from "@/lib/utils";

interface GameFile {
    id: string;
    name: string;
    createdTime: string;
    isHidden?: boolean;
    ownerEmail: string;
    playerCount: number;
    currentRoundIndex: number;
    isCompleted?: boolean;
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

import { getFinalRoundNumber } from "@/lib/game-logic";

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
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [userProfile, setUserProfile] = useState<any>(null);

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
    }, [session, showHistory, router]);

    // Fetch user profile for avatar
    useEffect(() => {
        if (session) {
            fetch("/api/user/profile")
                .then(res => res.json())
                .then(data => {
                    setUserProfile(data);
                    // Automatically open profile settings if it's a new user
                    if (data.isNew) {
                        setIsProfileOpen(true);
                    }
                })
                .catch(err => console.error("Error fetching profile:", err));
        }
    }, [session]);

    // Periodic refresh of discoverable games
    useEffect(() => {
        if (!session) return;

        // Initial fetch
        fetchDiscoverableGames();

        // Refresh discoverable games every 30 seconds
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
        const reconnectDelay = 3000;

        const connect = () => {
            try {
                socket = new WebSocket(wsUrl);

                socket.onopen = () => {
                    console.log('[Discovery] WebSocket connected');
                    reconnectAttempts = 0;
                };

                socket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);

                        if (data.type === 'ERROR') {
                            console.error('[Discovery] WebSocket server error:', data.message);
                            return;
                        }

                        if (data.type === 'DISCOVERY_UPDATE') {
                            console.log('[Discovery] Received update:', data);

                            if (data.updateType === 'GAME_DELETED' && data.game) {
                                setDiscoverableGames((prev) =>
                                    prev.filter((g) => g.id !== data.game.id)
                                );
                            } else {
                                fetchDiscoverableGames();
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing discovery WebSocket message:', e);
                    }
                };

                socket.onerror = (event) => {
                    if (process.env.NODE_ENV === 'development') {
                        console.log('[Discovery] WebSocket error event:', event);
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

    const handleJoin = (gameId: string) => {
        router.push(`/game/${gameId}`);
    };

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

    const canDelete = (game: GameFile): boolean => {
        return true;
    };

    const getGameStatus = (game: GameFile) => {
        const state = gameStates[game.id];

        const numPlayers = state?.players?.length || game.playerCount || 0;
        const currentRoundIndex = state?.currentRoundIndex ?? game.currentRoundIndex ?? 0;
        const finalRound = getFinalRoundNumber(numPlayers);

        const completedRounds = state?.rounds?.filter(r => r.state === 'COMPLETED') || [];
        const lastCompletedRound = completedRounds.length > 0
            ? Math.max(...completedRounds.map(r => r.index))
            : 0;

        const isCompleted = game.isCompleted || (lastCompletedRound >= finalRound && numPlayers > 0);

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

    if (status === 'loading' || !session) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="animate-spin text-muted-foreground" size={32} />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground font-sans">
            {/* Header - Fixed */}
            <header className="p-4 md:p-6 pb-2 border-b border-white/5 relative z-10 shrink-0">
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

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button
                            onClick={() => setIsProfileOpen(true)}
                            className="relative group w-12 h-12 md:w-14 md:h-14 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg overflow-hidden shrink-0 border-2 border-white/10 hover:border-[var(--primary)]"
                        >
                            <img
                                src={getAvatarUrl(userProfile?.image)}
                                alt="Profile"
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Settings size={16} className="text-white" />
                            </div>
                        </button>

                        <div className="grid grid-cols-2 gap-3 flex-1 md:w-80">
                            <Link
                                href="/create"
                                className="relative group px-4 py-3 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-95 shadow-lg hover:shadow-indigo-500/25 flex justify-center items-center overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-violet-600 opacity-90 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
                                <div className="absolute inset-0 border border-white/20 rounded-xl" />
                                <span className="relative flex items-center gap-2 font-bold text-white tracking-wide text-sm whitespace-nowrap">
                                    <Plus size={18} strokeWidth={3} />
                                    <span className="font-[family-name:var(--font-russo)]">NEW GAME</span>
                                </span>
                            </Link>
                            <Link
                                href="/leaderboard"
                                className="relative group px-4 py-3 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-95 shadow-lg hover:shadow-yellow-500/25 flex justify-center items-center overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-yellow-600 to-orange-600 opacity-90 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
                                <div className="absolute inset-0 border border-white/20 rounded-xl" />
                                <span className="relative flex items-center gap-2 font-bold text-white tracking-wide text-sm whitespace-nowrap">
                                    <Trophy size={18} />
                                    <span className="font-[family-name:var(--font-russo)]">STATS</span>
                                </span>
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            {/* Dashboard Content - Non-scrolling body, internal scroll for games */}
            <main className="flex-1 overflow-hidden p-4 md:p-6 flex flex-col gap-6 safe-pb">
                {/* Discover Section - Static height or minimal */}
                {discoverableGames.length > 0 && (
                    <section className="shrink-0 max-h-[35%] flex flex-col">
                        <div className="bg-background/95 backdrop-blur-md py-2 z-10 -mx-2 px-2 shrink-0">
                            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-600 font-[family-name:var(--font-russo)] uppercase tracking-tight">
                                Discover Games
                            </h2>
                            <p className="text-muted-foreground text-xs font-medium opacity-80">Join games that haven't started yet</p>
                        </div>

                        {loadingDiscoverable ? (
                            <div className="flex justify-center py-10 shrink-0">
                                <Loader2 className="animate-spin text-muted-foreground" size={24} />
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 mt-2 overflow-y-auto custom-scrollbar pr-1 pb-2">
                                {discoverableGames.map((game) => (
                                    <DiscoverableGameCard
                                        key={game.id}
                                        id={game.id}
                                        name={game.name}
                                        ownerEmail={game.ownerEmail}
                                        playerCount={game.playerCount}
                                        onJoin={handleJoin}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* My Games Section - Fills remaining space and scrolls */}
                <section className="flex-1 min-h-0 flex flex-col gap-4">
                    <div className="flex items-center justify-between shrink-0">
                        <div>
                            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent uppercase tracking-tight font-[family-name:var(--font-russo)] leading-none">My Games</h2>
                            <p className="text-xs text-muted-foreground mt-1 font-medium opacity-80 uppercase tracking-wider">Games you've created or joined</p>
                        </div>
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-wider transition-all border border-white/5"
                        >
                            <History size={16} />
                            {showHistory ? 'Hide History' : 'Show History'}
                        </button>
                    </div>

                    <div className="flex-1 min-h-0 flex flex-col glass rounded-xl overflow-hidden border-white/5 shadow-2xl">
                        {loading ? (
                            <div className="flex-1 flex items-center justify-center">
                                <Loader2 className="animate-spin text-muted-foreground" size={32} />
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                {games.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                                        <Trophy size={48} className="mb-4 text-muted-foreground" />
                                        <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">No entries found</p>
                                    </div>
                                ) : (
                                    games.map((g) => (
                                        <GameCard
                                            key={g.id}
                                            id={g.id}
                                            name={g.name}
                                            createdTime={g.createdTime}
                                            isHidden={g.isHidden}
                                            status={getGameStatus(g)}
                                            showDelete={canDelete(g)}
                                            isDeleting={deleting === g.id}
                                            onDelete={handleDelete}
                                        />
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </section>
            </main>

            <ProfileSettingsOverlay
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                onUpdate={(newProfile) => setUserProfile(newProfile)}
            />
        </div>
    );
}
