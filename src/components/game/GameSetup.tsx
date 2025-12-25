"use client";

import { useState } from "react";
import { 
    DndContext, 
    closestCenter, 
    KeyboardSensor, 
    PointerSensor, 
    useSensor, 
    useSensors, 
    DragEndEvent 
} from '@dnd-kit/core';
import { 
    arrayMove, 
    SortableContext, 
    sortableKeyboardCoordinates, 
    verticalListSortingStrategy, 
    useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
    Share2, 
    Check, 
    GripVertical, 
    User, 
    Crown, 
    Loader2,
    LogIn
} from "lucide-react";
import { Player } from "@/lib/store";

interface GameSetupProps {
    gameId: string;
    gameState: any;
    isOwner: boolean;
    isJoined: boolean;
    currentUserEmail?: string;
    onGameUpdate: (game: any) => void;
    onJoin: () => void;
}

// Sortable Item Component
function SortablePlayerItem({ 
    player, 
    isOwner, 
    isCurrentUser, 
    firstDealerEmail, 
    onToggleDealer, 
    onNameUpdate,
}: { 
    player: Player, 
    isOwner: boolean, 
    isCurrentUser: boolean, 
    firstDealerEmail?: string,
    onToggleDealer: (email: string) => void,
    onNameUpdate: (name: string) => void,
    onDelete: (email: string) => void
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: player.email, disabled: !isOwner });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.8 : 1,
    };

    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(player.name);

    const handleSaveName = async () => {
        if (!name.trim() || name === player.name) {
            setIsEditing(false);
            return;
        }
        try {
            await onNameUpdate(name);
            setIsEditing(false);
        } catch (e) {
            console.error("Failed to update name", e);
            setName(player.name); // Revert on error
        }
    };

    const isFirstDealer = firstDealerEmail === player.email;

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            className={`
                bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-3 relative
                ${isFirstDealer ? 'ring-2 ring-[var(--primary)]' : ''}
            `}
        >
            {/* Drag Handle (Owner only) */}
            {isOwner && (
                <div 
                    {...attributes} 
                    {...listeners} 
                    className="text-[var(--muted-foreground)] touch-none p-1 -ml-2"
                >
                    <GripVertical size={20} />
                </div>
            )}

            {/* Avatar / Dealer Indicator */}
            <div 
                className="relative"
                onClick={() => isOwner && onToggleDealer(player.email)}
            >
                <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    ${isFirstDealer ? 'bg-[var(--primary)] text-white' : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'}
                `}>
                    <User size={20} />
                </div>
                {isFirstDealer && (
                    <div className="absolute -top-1 -right-1 bg-yellow-500 text-black p-0.5 rounded-full shadow-sm">
                        <Crown size={12} fill="currentColor" />
                    </div>
                )}
            </div>

            {/* Name Input / Display */}
            <div className="flex-1 min-w-0">
                {isEditing ? (
                    <input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={handleSaveName}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                        className="w-full bg-transparent border-b border-[var(--primary)] outline-none text-[var(--foreground)] font-medium p-0"
                    />
                ) : (
                    <div 
                        onClick={() => isCurrentUser && setIsEditing(true)}
                        className={`font-medium text-lg truncate ${isCurrentUser ? 'cursor-pointer hover:text-[var(--primary)] transition-colors' : ''}`}
                    >
                        {player.name} {isCurrentUser && <span className="text-xs text-[var(--muted-foreground)] font-normal">(You)</span>}
                    </div>
                )}
                {isFirstDealer && <div className="text-xs text-[var(--primary)] font-medium">First Dealer</div>}
            </div>
        </div>
    );
}

export function GameSetup({ 
    gameId, 
    gameState, 
    isOwner, 
    isJoined,
    currentUserEmail, 
    onGameUpdate, 
    onJoin 
}: GameSetupProps) {
    const [copied, setCopied] = useState(false);
    const [starting, setStarting] = useState(false);
    const [joining, setJoining] = useState(false);
    
    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = gameState.players.findIndex((p: Player) => p.email === active.id);
            const newIndex = gameState.players.findIndex((p: Player) => p.email === over.id);

            const newPlayers = arrayMove(gameState.players, oldIndex, newIndex);
            
            // Optimistic update
            onGameUpdate({ ...gameState, players: newPlayers });

            // API update
            try {
                await fetch(`/api/games/${gameId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ players: newPlayers })
                });
            } catch (e) {
                console.error("Failed to reorder players", e);
            }
        }
    };

    const handleNameUpdate = async (name: string) => {
        if (!currentUserEmail) return;
        
        // Optimistic update
        const newPlayers = gameState.players.map((p: Player) => 
            p.email === currentUserEmail ? { ...p, name } : p
        );
        onGameUpdate({ ...gameState, players: newPlayers });

        // API Call
        await fetch(`/api/games/${gameId}/players`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
    };

    const handleToggleDealer = async (email: string) => {
        // Optimistic
        const isCurrentlyDealer = gameState.firstDealerEmail === email;
        const newDealer = isCurrentlyDealer ? undefined : email;
        
        onGameUpdate({ ...gameState, firstDealerEmail: newDealer });

        // API Call
        await fetch(`/api/games/${gameId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstDealerEmail: newDealer })
        });
    };

    const handleShare = async () => {
        const url = window.location.href;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Join ${gameState.name}`,
                    url
                });
            } catch (e) {
                // Ignore abort
            }
        } else {
            navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleStartGame = async () => {
        if (gameState.players.length < 3) return;
        setStarting(true);
        try {
            await fetch(`/api/games/${gameId}/rounds`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'START' })
            });
            // WebSocket will handle the redirect/update to play mode
        } catch (e) {
            alert("Failed to start game");
            setStarting(false);
        }
    };
    
    const handleJoinClick = async () => {
        setJoining(true);
        try {
            await onJoin();
        } finally {
            setJoining(false);
        }
    };

    const players = gameState.players || [];
    const canStart = players.length >= 3;

    return (
        <div className="flex flex-col h-full space-y-6 pb-24 px-4">
            {/* Header */}
            <div className="text-center space-y-2 pt-6">
                <h2 className="text-3xl font-bold tracking-tight">{gameState.name}</h2>
                <div className="flex items-center justify-center gap-2">
                    <button 
                        onClick={handleShare}
                        className="bg-[var(--secondary)] text-[var(--foreground)] px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 active:scale-95 transition-transform"
                    >
                        {copied ? <Check size={16} className="text-green-500" /> : <Share2 size={16} />}
                        {copied ? "Link Copied" : "Invite Players"}
                    </button>
                </div>
            </div>

            {/* Player List */}
            <div className="flex-1">
                <div className="flex items-center justify-between mb-2 text-sm text-[var(--muted-foreground)]">
                    <span>{players.length} Players</span>
                    {isOwner && <span>Drag to order</span>}
                </div>
                
                <DndContext 
                    sensors={sensors} 
                    collisionDetection={closestCenter} 
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext 
                        items={players.map((p: Player) => p.email)} 
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-3">
                            {players.map((player: Player) => (
                                <SortablePlayerItem 
                                    key={player.email} 
                                    player={player}
                                    isOwner={isOwner}
                                    isCurrentUser={player.email === currentUserEmail}
                                    firstDealerEmail={gameState.firstDealerEmail}
                                    onToggleDealer={handleToggleDealer}
                                    onNameUpdate={handleNameUpdate}
                                    onDelete={() => {}} 
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>

                {!canStart && isOwner && (
                    <div className="mt-6 text-center text-sm text-[var(--muted-foreground)] bg-[var(--secondary)]/50 p-4 rounded-xl">
                        Need at least 3 players to start.
                    </div>
                )}
            </div>

            {/* Bottom Bar (Sticky) */}
            <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--background)] to-transparent pt-12 safe-pb">
                <div className="px-4 pb-4">
                    {isOwner ? (
                        <button
                            onClick={handleStartGame}
                            disabled={!canStart || starting}
                            className="w-full bg-[var(--primary)] text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform"
                        >
                            {starting ? <Loader2 className="animate-spin" /> : "Start Game"}
                        </button>
                    ) : !isJoined ? (
                        <button
                            onClick={handleJoinClick}
                            disabled={joining || players.length >= 12}
                            className="w-full bg-[var(--primary)] text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform"
                        >
                            {joining ? <Loader2 className="animate-spin" /> : (
                                <>
                                    Join Game <LogIn size={20} />
                                </>
                            )}
                        </button>
                    ) : (
                        <div className="text-center text-[var(--muted-foreground)] py-2 font-medium bg-[var(--background)]/80 backdrop-blur rounded-xl border border-[var(--border)]">
                            Waiting for host to start...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
