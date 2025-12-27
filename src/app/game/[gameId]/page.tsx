"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { GameSetup } from "@/components/game/GameSetup";
import { Scoreboard } from "@/components/game/Scoreboard";
import { ScoreEntryOverlay } from "@/components/game/ScoreEntryOverlay";
import { Player } from "@/lib/store";
import { DECK_SIZE } from "@/lib/config";

export default function GamePage() {
    const params = useParams();
    const gameId = params.gameId as string;
    const { data: session } = useSession();
    
    const [gameState, setGameState] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [ws, setWs] = useState<WebSocket | null>(null);
    
    // UI State
    const [showEntry, setShowEntry] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    
    // Undo history - track round states before each round completion
    const roundHistoryRef = useRef<Map<number, any>>(new Map());

    // Track game state changes for undo - save state before round completion
    useEffect(() => {
        if (gameState && gameState.currentRoundIndex > 0) {
            const currentRound = gameState.rounds?.find((r: any) => r.index === gameState.currentRoundIndex);
            
            // Save state before a round is completed (when round state changes to COMPLETED)
            if (currentRound && currentRound.state === 'COMPLETED') {
                // Check if we already saved this round's pre-completion state
                if (!roundHistoryRef.current.has(currentRound.index)) {
                    // Save the state BEFORE this round was completed
                    // We need to save the state as it was when the round was in PLAYING state
                    const stateBeforeCompletion = {
                        ...gameState,
                        rounds: gameState.rounds.map((r: any) => {
                            if (r.index === currentRound.index) {
                                // Revert this round to PLAYING state, clear tricks
                                return {
                                    ...r,
                                    state: 'PLAYING',
                                    tricks: {}
                                };
                            }
                            return r;
                        }),
                        // Revert scores - remove points from this round
                        players: gameState.players.map((p: Player) => {
                            const bid = currentRound.bids?.[p.email];
                            const tricks = currentRound.tricks?.[p.email];
                            let pointsToRemove = 0;
                            
                            // Calculate points that were added in this round
                            if (bid !== undefined && tricks !== undefined && tricks !== -1 && bid === tricks) {
                                pointsToRemove = bid + currentRound.cards;
                            }
                            
                            return {
                                ...p,
                                score: Math.max(0, p.score - pointsToRemove)
                            };
                        })
                    };
                    roundHistoryRef.current.set(currentRound.index, stateBeforeCompletion);
                }
            }
        }
    }, [gameState]);

    // Initial Load
    useEffect(() => {
        if (!gameId) return;
        
        const loadGame = () => {
            fetch(`/api/games/${gameId}`)
                .then(res => {
                    if (!res.ok) {
                        return res.json().then(err => {
                            console.error('Game load error:', err.error || 'Failed to load game');
                            setGameState(null);
                            setLoading(false);
                            return null;
                        });
                    }
                    return res.json();
                })
                .then(data => {
                    if (data && !data.error) {
                        console.log('Game state loaded:', data);
                        setGameState(data);
                        // Clear history on fresh load
                        roundHistoryRef.current.clear();
                    } else {
                        setGameState(null);
                    }
                    setLoading(false);
                })
                .catch(err => {
                    console.error('Error loading game:', err);
                    setGameState(null);
                    setLoading(false);
                });
        };
        
        loadGame();
    }, [gameId]);

    // Determine if user has joined (needed for WebSocket connection)
    const players = gameState?.players || [];
    const isOwner = session?.user?.email === gameState?.ownerEmail;
    const isJoined = session?.user?.email ? players.some((p: Player) => p.email === session.user.email) : false;

    // WebSocket Connection - only connect if user has joined the game
    useEffect(() => {
        if (!gameId || !gameState) return;
        
        // Only connect WebSocket if user is a player or owner
        // This prevents "User is not a player" errors for users who haven't joined yet
        if (!isJoined && !isOwner) {
            console.log('[WebSocket] Skipping connection - user has not joined the game yet');
            return;
        }
        
        let socket: WebSocket | null = null;
        let reconnectTimeout: NodeJS.Timeout | null = null;
        let reconnectAttempts = 0;
        const maxReconnectAttempts = 5;
        const reconnectDelay = 3000;
        let permanentError = false; // Track permanent errors that shouldn't trigger reconnection

        const connectWebSocket = () => {
            // Don't attempt to reconnect if we've encountered a permanent error
            if (permanentError) {
                console.log('[WebSocket] Skipping reconnection due to permanent error');
                return;
            }

            try {
                const protocol = globalThis.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${protocol}//${globalThis.location.host}/ws?gameId=${gameId}`;
                socket = new WebSocket(wsUrl);

                socket.onopen = () => {
                    console.log("WebSocket connected");
                    reconnectAttempts = 0;
                    permanentError = false; // Reset permanent error on successful connection
                    socket?.send(JSON.stringify({ type: 'JOIN_GAME', gameId }));
                };

                socket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        console.log('[WebSocket] Received message:', data.type, data);
                        if (data.type === 'GAME_UPDATE') {
                            console.log('[WebSocket] Updating game state from WebSocket');
                            setGameState(data.state);
                        } else if (data.type === 'ERROR') {
                            const errorMessage = data.message || 'Unknown error';
                            console.error('[WebSocket] Error:', errorMessage);
                            
                            // Mark as permanent error if it's a "Game not found" error
                            // These errors indicate the game doesn't exist and reconnection won't help
                            if (errorMessage.includes('Game not found') || 
                                errorMessage.includes('not found') ||
                                errorMessage.includes('Authentication failed')) {
                                permanentError = true;
                                console.log('[WebSocket] Permanent error detected, will not reconnect');
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing WebSocket message:', e);
                    }
                };

                socket.onerror = (event) => {
                    // WebSocket error events don't provide much detail, but we should handle them gracefully
                    console.error('[WebSocket] Error event occurred');
                    // Don't set permanentError here as connection errors might be transient
                };

                socket.onclose = (event) => {
                    console.log('WebSocket disconnected', event.code, event.reason);
                    socket = null;
                    
                    // Don't reconnect for:
                    // - Clean close (1000)
                    // - Policy violation (1008) - typically means "Game not found" or auth failure
                    // - Permanent errors
                    // - Max reconnection attempts reached
                    const isPolicyViolation = event.code === 1008;
                    const shouldReconnect = !permanentError && 
                                          event.code !== 1000 && 
                                          !isPolicyViolation &&
                                          reconnectAttempts < maxReconnectAttempts;
                    
                    if (isPolicyViolation) {
                        permanentError = true;
                        console.log('[WebSocket] Policy violation detected, will not reconnect');
                    }
                    
                    if (shouldReconnect) {
                        reconnectAttempts++;
                        console.log(`[WebSocket] Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
                        reconnectTimeout = setTimeout(connectWebSocket, reconnectDelay);
                    } else if (reconnectAttempts >= maxReconnectAttempts) {
                        console.log('[WebSocket] Max reconnection attempts reached');
                    }
                };

                setWs(socket);
            } catch (e) {
                console.error('Error creating WebSocket connection:', e);
            }
        };

        connectWebSocket();

        return () => {
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            if (socket) socket.close(1000, 'Component unmounting');
        };
    }, [gameId, isJoined, isOwner]); // Removed gameState to prevent infinite reconnection loop

    const handleJoin = async () => {
        if (!session?.user?.email) {
            const callbackUrl = `/game/${gameId}`;
            window.location.href = `/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
            return;
        }

        try {
            const res = await fetch(`/api/games/${gameId}/join`, { method: 'POST' });
            const data = await res.json();
            
            if (!res.ok) {
                alert(`Failed to join: ${data.error || 'Unknown error'}`);
                return;
            }

            if (data.game) {
                setGameState(data.game);
                // WebSocket will automatically connect when gameState updates and isJoined becomes true
            } else {
                // Reload
                const reloadRes = await fetch(`/api/games/${gameId}`);
                if (reloadRes.ok) {
                    const reloadData = await reloadRes.json();
                    setGameState(reloadData);
                    // WebSocket will automatically connect when gameState updates and isJoined becomes true
                }
            }
        } catch (e) {
            console.error("Error joining:", e);
            alert("Error joining game.");
        }
    };

    const handleUndo = async () => {
        if (!gameState || gameState.currentRoundIndex <= 0) {
            alert("Nothing to undo");
            return;
        }

        const currentRoundIndex = gameState.currentRoundIndex;
        const currentRound = gameState.rounds?.find((r: any) => r.index === currentRoundIndex);
        
        if (!currentRound) {
            alert("Current round not found");
            return;
        }

        // Only undo the current round - reset it to BIDDING state
        // Revert scores from current round only
        const revertedPlayers = gameState.players.map((p: Player) => {
            let scoreToRevert = 0;
            
            // Only remove points from the current round if it was completed
            if (currentRound.state === 'COMPLETED') {
                const bid = currentRound.bids?.[p.email];
                const tricks = currentRound.tricks?.[p.email];
                if (bid !== undefined && tricks !== undefined && tricks !== -1 && bid === tricks) {
                    scoreToRevert = bid + currentRound.cards;
                }
            }
            
            return {
                ...p,
                score: Math.max(0, p.score - scoreToRevert)
            };
        });

        // Reset current round to BIDDING state (clear bids and tricks)
        const revertedRounds = gameState.rounds.map((r: any) => {
            if (r.index === currentRoundIndex) {
                return {
                    ...r,
                    state: 'BIDDING',
                    bids: {},
                    tricks: {}
                };
            }
            return r;
        });

        const revertedState = {
            ...gameState,
            rounds: revertedRounds,
            players: revertedPlayers
        };

        // Update local state
        setGameState(revertedState);

        // Call API to update server
        try {
            await fetch(`/api/games/${gameId}/rounds`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'UNDO',
                    targetRoundIndex: currentRoundIndex
                })
            });
        } catch (e) {
            console.error("Failed to undo on server:", e);
            // Still update local state
        }
    };

    const handleNextRound = async () => {
        // Check if game has ended before trying to start next round
        if (gameState) {
            const numPlayers = gameState.players?.length || 0;
            const maxCards = Math.floor(DECK_SIZE / numPlayers);
            const finalRoundNumber = maxCards * 2 - 1;
            const completedRounds = gameState.rounds?.filter((r: any) => r.state === 'COMPLETED') || [];
            const lastCompletedRound = completedRounds.length > 0 
                ? Math.max(...completedRounds.map((r: any) => r.index))
                : 0;
            const isGameEnded = lastCompletedRound >= finalRoundNumber;
            
            if (isGameEnded) {
                // Game has ended - don't try to start next round
                return;
            }
        }
        
        setLoading(true);
        try {
            const res = await fetch(`/api/games/${gameId}/rounds`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'START' })
            });
            const data = await res.json();
            if (res.ok && data.game) {
                setGameState(data.game);
            } else {
                // Don't show alert for "Game has ended" error - it's expected
                if (data.error && data.error.includes('Game has ended')) {
                    // Just update the game state to refresh the UI
                    const reloadRes = await fetch(`/api/games/${gameId}`);
                    if (reloadRes.ok) {
                        const reloadData = await reloadRes.json();
                        setGameState(reloadData);
                    }
                } else {
                    alert(data.error || 'Failed to start next round');
                }
            }
        } catch (e) {
            console.error('Error starting next round:', e);
            alert('Error starting next round');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center bg-[var(--background)] text-[var(--foreground)]"><Loader2 className="animate-spin" /></div>;
    
    if (!gameState) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--background)] text-[var(--foreground)]">
                <div className="text-center space-y-4 max-w-md">
                    <h2 className="text-2xl font-bold">Game Not Found</h2>
                    <p className="text-[var(--muted-foreground)]">
                        The game may not exist or requires sign-in.
                    </p>
                    <Link 
                        href="/dashboard"
                        className="inline-block bg-[var(--primary)] text-white px-6 py-3 rounded-xl font-bold"
                    >
                        Go to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    // Determine Mode
    // Check if game has strictly started (Round > 0)
    const mode = (gameState.currentRoundIndex > 0) ? 'PLAYING' : 'LOBBY';

    return (
        <div className="h-[100dvh] w-full bg-[var(--background)] text-[var(--foreground)] font-sans flex flex-col overflow-hidden">
            {mode === 'LOBBY' ? (
                <GameSetup 
                    gameId={gameId} 
                    gameState={gameState} 
                    isOwner={isOwner} 
                    isJoined={isJoined}
                    currentUserEmail={session?.user?.email || undefined}
                    onGameUpdate={setGameState}
                    onJoin={handleJoin}
                />
            ) : (
                <>
                    <Scoreboard 
                        gameId={gameId} 
                        gameState={gameState} 
                        isOwner={isOwner} 
                        currentUserEmail={session?.user?.email || undefined}
                        onOpenEntry={() => setShowEntry(true)}
                        onUndo={handleUndo}
                        onOpenSettings={() => setShowSettings(true)}
                        onNextRound={handleNextRound}
                    />
                    <ScoreEntryOverlay 
                        isOpen={showEntry} 
                        onClose={() => setShowEntry(false)}
                        gameId={gameId} 
                        gameState={gameState} 
                        onGameUpdate={setGameState}
                    />
                    {showSettings && (
                        <SettingsModal
                            isOpen={showSettings}
                            onClose={() => setShowSettings(false)}
                            gameId={gameId}
                            gameState={gameState}
                            currentUserEmail={session?.user?.email || undefined}
                            onGameUpdate={setGameState}
                        />
                    )}
                </>
            )}
        </div>
    );
}

// Settings Modal Component
function SettingsModal({ 
    isOpen, 
    onClose, 
    gameId, 
    gameState, 
    currentUserEmail,
    onGameUpdate 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    gameId: string; 
    gameState: any; 
    currentUserEmail?: string;
    onGameUpdate: (game: any) => void;
}) {
    const [name, setName] = useState("");
    const [saving, setSaving] = useState(false);
    const currentPlayer = gameState.players.find((p: Player) => p.email === currentUserEmail);

    useEffect(() => {
        if (isOpen && currentPlayer) {
            setName(currentPlayer.name);
        }
    }, [isOpen, currentPlayer]);

    const handleSave = async () => {
        // Prevent name changes after game has started
        if (gameState.currentRoundIndex > 0) {
            return;
        }
        
        if (!name.trim() || !currentUserEmail) return;
        
        setSaving(true);
        try {
            // Optimistic update
            const newPlayers = gameState.players.map((p: Player) => 
                p.email === currentUserEmail ? { ...p, name: name.trim() } : p
            );
            onGameUpdate({ ...gameState, players: newPlayers });

            // API Call
            await fetch(`/api/games/${gameId}/players`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim() })
            });
            
            onClose();
        } catch (e) {
            console.error("Failed to update name", e);
            alert("Failed to update name");
        } finally {
            setSaving(false);
        }
    };

    const isGameStarted = gameState.currentRoundIndex > 0;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] w-full max-w-sm p-6 space-y-4">
                <h3 className="text-xl font-bold">Change Your Name</h3>
                {isGameStarted ? (
                    <div className="p-4 bg-[var(--secondary)] rounded-xl border border-[var(--border)]">
                        <p className="text-sm text-[var(--muted-foreground)]">
                            Name changes are not allowed after the game has started.
                        </p>
                    </div>
                ) : (
                    <>
                        <input
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-lg outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                            placeholder="Your name"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 bg-[var(--secondary)] text-[var(--foreground)] py-3 rounded-xl font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!name.trim() || saving}
                                className="flex-1 bg-[var(--primary)] text-white py-3 rounded-xl font-bold disabled:opacity-50"
                            >
                                {saving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </>
                )}
                {isGameStarted && (
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 bg-[var(--secondary)] text-[var(--foreground)] py-3 rounded-xl font-medium"
                        >
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
