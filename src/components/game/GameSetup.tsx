"use client";

import { useState, useRef } from "react";
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
    LogIn,
    Upload
} from "lucide-react";
import { Player } from "@/lib/store";
import { ImageCropperOverlay } from "./ImageCropperOverlay";

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
    onUploadImage,
    isGameStarted,
}: { 
    player: Player, 
    isOwner: boolean, 
    isCurrentUser: boolean, 
    firstDealerEmail?: string,
    onToggleDealer: (email: string) => void,
    onNameUpdate: (name: string) => void,
    onDelete: (email: string) => void,
    onUploadImage: () => void,
    isGameStarted: boolean,
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
                className="relative group cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation();
                    if (isCurrentUser) {
                        onUploadImage();
                    } else if (isOwner) {
                        onToggleDealer(player.email);
                    }
                }}
            >
                {player.image ? (
                    <>
                        <img 
                            src={player.image} 
                            alt={player.name}
                            className={`w-10 h-10 rounded-full object-cover ${isFirstDealer ? 'ring-2 ring-[var(--primary)]' : ''}`}
                        />
                        {isCurrentUser && (
                            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Upload size={16} className="text-white" />
                            </div>
                        )}
                    </>
                ) : (
                    <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center relative
                        ${isFirstDealer ? 'bg-[var(--primary)] text-white' : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'}
                    `}>
                        {isFirstDealer ? <Crown size={20} fill="currentColor" /> : <User size={20} />}
                        {isCurrentUser && (
                            <div className="absolute inset-0 bg-black/10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Upload size={16} className="text-[var(--foreground)]" />
                            </div>
                        )}
                    </div>
                )}
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
                        onClick={() => isCurrentUser && !isGameStarted && setIsEditing(true)}
                        className={`font-medium text-lg truncate ${isCurrentUser && !isGameStarted ? 'cursor-pointer hover:text-[var(--primary)] transition-colors' : ''}`}
                    >
                        {player.name} {isCurrentUser && <span className="text-xs text-[var(--muted-foreground)] font-normal">(You)</span>}
                    </div>
                )}
                
                {/* Dealer Status / Toggle */}
                {isOwner ? (
                    <button 
                        onClick={() => onToggleDealer(player.email)}
                        className={`text-xs font-medium flex items-center gap-1 hover:underline ${isFirstDealer ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)] hover:text-[var(--primary)]'}`}
                    >
                        {isFirstDealer ? (
                            <>First Dealer <Crown size={10} /></>
                        ) : (
                            "Make First Dealer"
                        )}
                    </button>
                ) : (
                    isFirstDealer && <div className="text-xs text-[var(--primary)] font-medium">First Dealer</div>
                )}
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
    const [cropperImage, setCropperImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
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
        
        // Prevent name changes after game has started
        if (gameState.currentRoundIndex > 0) {
            return;
        }
        
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
            const res = await fetch(`/api/games/${gameId}/rounds`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'START' })
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                alert(data.error || "Failed to start game");
                setStarting(false);
                return;
            }
            
            // Update game state with the response
            if (data.game) {
                onGameUpdate(data.game);
            } else {
                // Fallback: reload game state
                const reloadRes = await fetch(`/api/games/${gameId}`);
                if (reloadRes.ok) {
                    const reloadData = await reloadRes.json();
                    onGameUpdate(reloadData);
                }
            }
            // Note: The page will automatically switch to PLAYING mode when currentRoundIndex > 0
        } catch (e) {
            console.error("Error starting game:", e);
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

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset the input value so the same file can be selected again if needed
        e.target.value = '';

        // Basic validation
        if (file.size > 10 * 1024 * 1024) { // 10MB limit for cropping
            alert("Image is too large. Please choose an image under 10MB.");
            return;
        }

        // Read the file and open cropper
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setCropperImage(base64String);
        };
        reader.readAsDataURL(file);
    };

    const handleCropComplete = async (croppedImageBase64: string) => {
        try {
            await fetch(`/api/games/${gameId}/players`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: croppedImageBase64 })
            });
        } catch (err) {
            console.error("Failed to upload image", err);
            alert("Failed to update profile picture");
        }
    };

    const players = gameState.players || [];
    const canStart = players.length >= 3;

    return (
        <div className="flex flex-col h-full overflow-hidden bg-[var(--background)]">
            <input 
                type="file" 
                ref={fileInputRef}
                style={{ position: 'absolute', opacity: 0, width: 0, height: 0, overflow: 'hidden' }}
                accept="image/*"
                onChange={handleFileChange}
            />

            {/* Header */}
            <div className="text-center space-y-2 pt-6 pb-4 px-4 shrink-0 z-10 bg-[var(--background)]">
                <h2 className="text-3xl font-bold tracking-tight">{gameState.name}</h2>
                <div className="flex items-center justify-center gap-2">
                    <button 
                        onClick={handleShare}
                        className="bg-[var(--secondary)] text-[var(--foreground)] px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 active:scale-95 transition-transform touch-manipulation"
                    >
                        {copied ? <Check size={16} className="text-green-500" /> : <Share2 size={16} />}
                        {copied ? "Link Copied" : "Invite Players"}
                    </button>
                </div>
            </div>

            {/* Player List */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 overscroll-contain">
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
                                    onUploadImage={() => {
                                        if (fileInputRef.current) {
                                            fileInputRef.current.click();
                                        }
                                    }}
                                    isGameStarted={gameState.currentRoundIndex > 0}
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

            {/* Bottom Bar */}
            <div className="shrink-0 bg-[var(--background)] border-t border-[var(--border)] pt-4 safe-pb z-10">
                <div className="px-4 pb-4">
                    {isOwner ? (
                        <button
                            onClick={handleStartGame}
                            disabled={!canStart || starting}
                            className="w-full bg-[var(--primary)] text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform touch-manipulation"
                        >
                            {starting ? <Loader2 className="animate-spin" /> : "Start Game"}
                        </button>
                    ) : !isJoined ? (
                        <button
                            onClick={handleJoinClick}
                            disabled={joining || players.length >= 12}
                            className="w-full bg-[var(--primary)] text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform touch-manipulation"
                        >
                            {joining ? <Loader2 className="animate-spin" /> : (
                                <>
                                    Join Game <LogIn size={20} />
                                </>
                            )}
                        </button>
                    ) : (
                        <div className="text-center text-[var(--muted-foreground)] py-2 font-medium bg-[var(--secondary)]/50 rounded-xl border border-[var(--border)]">
                            Waiting for host to start...
                        </div>
                    )}
                </div>
            </div>

            <ImageCropperOverlay
                isOpen={!!cropperImage}
                imageSrc={cropperImage || ''}
                onClose={() => setCropperImage(null)}
                onCropComplete={handleCropComplete}
            />
        </div>
    );
}
