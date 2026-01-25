"use client";

import { useEffect, useState, useRef } from "react";
import { Trophy, Loader2, Crown, Share2, ArrowLeft, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { getAvatarUrl } from "@/lib/utils";
import { ShareableLeaderboard } from "@/components/sharing/ShareableLeaderboard";
import { toBlob } from "html-to-image";

interface LeaderboardEntry {
    email: string;
    name: string;
    image: string | null;
    gamesPlayed: number;
    wins: number;
    secondPlace: number;
    thirdPlace: number;
    averagePercentile: number;
    podiumRate: number;
    winRate: number;
    totalScore: number;
    lastPlaceCount: number;
}

export default function LeaderboardPage() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<LeaderboardEntry | null>(null);

    const leaderboardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetch("/api/leaderboard")
            .then((res) => res.json())
            .then((data) => {
                if (data.leaderboard) {
                    setLeaderboard(data.leaderboard);
                }
                setLoading(false);
            })
            .catch((err) => {
                console.error("Error fetching leaderboard:", err);
                setError("Failed to load leaderboard");
                setLoading(false);
            });
    }, []);

    const onShare = async () => {
        setIsSharing(true);
        try {
            if (!leaderboardRef.current) return;

            // Pre-convert all player images to base64 to avoid iOS CORS issues
            const leaderboardWithBase64 = await Promise.all(
                leaderboard.map(async (player) => {
                    if (!player.image || player.image.startsWith('data:')) {
                        return player; // Already base64 or no image
                    }
                    try {
                        const response = await fetch(player.image);
                        const blob = await response.blob();
                        return new Promise<LeaderboardEntry>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                resolve({ ...player, image: reader.result as string });
                            };
                            reader.onerror = () => resolve(player); // Fallback to original
                            reader.readAsDataURL(blob);
                        });
                    } catch {
                        return player; // Fallback to original on error
                    }
                })
            );

            // Temporarily update the leaderboard with base64 images for capture
            setLeaderboard(leaderboardWithBase64);

            // Wait for React to re-render with base64 images
            await new Promise(resolve => setTimeout(resolve, 100));

            // Use html-to-image for better fidelity
            const blob = await toBlob(leaderboardRef.current, {
                cacheBust: true,
                pixelRatio: 3,
                backgroundColor: '#050510',
                style: {
                    transform: 'scale(1)',
                    transformOrigin: 'top left'
                }
            });

            // Restore original leaderboard (with original image URLs)
            setLeaderboard(leaderboard);

            if (!blob) throw new Error('Failed to generate leaderboard blob');

            const file = new File([blob], 'leaderboard.png', { type: 'image/png' });

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'Global Leaderboard',
                        text: 'Check out the ScoreJudge global rankings!',
                        files: [file]
                    });
                } catch (e) {
                    if ((e as Error).name !== 'AbortError') {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'leaderboard.png';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }
                }
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'leaderboard.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }

        } catch (e) {
            console.error('Error sharing leaderboard:', e);
            alert('Failed to share leaderboard');
        } finally {
            setIsSharing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
                <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Loading leaderboard...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--background)] p-4 pb-20">
            {/* Header */}
            <div className="max-w-lg mx-auto mb-6">
                <div className="flex items-center justify-between">
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span>Back</span>
                    </Link>
                    <button
                        onClick={onShare}
                        disabled={isSharing || leaderboard.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-full font-medium hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md active:scale-95 transition-transform"
                    >
                        {isSharing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Share2 className="w-4 h-4" />
                        )}
                        {isSharing ? 'Sharing...' : 'Share'}
                    </button>
                </div>
            </div>

            {/* Title */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <Trophy className="w-8 h-8 text-yellow-500" />
                <h1 className="text-2xl font-bold text-[var(--foreground)]">
                    Global Leaderboard
                </h1>
                <Trophy className="w-8 h-8 text-yellow-500" />
            </div>

            {error || leaderboard.length === 0 ? (
                <div className="max-w-lg mx-auto text-center text-[var(--muted-foreground)] py-12">
                    {error || "No leaderboard data yet. Play at least 3 games to appear!"}
                </div>
            ) : (
                <div className="max-w-lg mx-auto">
                    {/* Leaderboard Table */}
                    <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-lg">
                        {/* Table Header */}
                        <div className="grid grid-cols-[24px_1fr_28px_28px_32px_24px_36px] gap-0.5 px-2 py-2 bg-[var(--muted)]/30 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                            <div className="text-center">#</div>
                            <div>Player</div>
                            <div className="text-center">G</div>
                            <div className="text-center">W</div>
                            <div className="text-center">%</div>
                            <div className="text-center">🌈</div>
                            <div className="text-center">🌈%</div>
                        </div>

                        {/* Table Body */}
                        <div className="divide-y divide-[var(--border)]">
                            {leaderboard.map((player, index) => (
                                <button
                                    key={player.email}
                                    onClick={() => setSelectedPlayer(player)}
                                    className={`w-full grid grid-cols-[24px_1fr_28px_28px_32px_24px_36px] gap-0.5 px-2 py-2.5 items-center transition-colors hover:bg-white/5 text-left ${index === 0 ? "bg-yellow-500/10" :
                                        index === 1 ? "bg-gray-400/10" :
                                            index === 2 ? "bg-orange-600/10" : ""
                                        }`}
                                >
                                    {/* Rank */}
                                    <div className="text-center text-base">
                                        {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : (
                                            <span className="text-[var(--muted-foreground)] text-sm font-medium">{index + 1}</span>
                                        )}
                                    </div>

                                    {/* Player */}
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <div className="w-6 h-6 rounded-full overflow-hidden bg-[var(--muted)] flex-shrink-0 flex items-center justify-center border border-[var(--border)]/50">
                                            <Image
                                                src={getAvatarUrl(player.image)}
                                                alt={player.name}
                                                width={24}
                                                height={24}
                                                className="object-cover"
                                                unoptimized={getAvatarUrl(player.image).startsWith('data:')}
                                            />
                                        </div>
                                        <div className="flex items-center gap-1 min-w-0 flex-wrap">
                                            {index === 0 && <Crown className="w-3 h-3 text-yellow-500 flex-shrink-0" />}
                                            <span className={`text-sm font-medium break-words ${index === 0 ? "text-yellow-500" : "text-[var(--foreground)]"}`}>
                                                {player.name}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Games */}
                                    <div className="text-center text-sm text-[var(--muted-foreground)]">{player.gamesPlayed}</div>

                                    {/* Wins */}
                                    <div className="text-center text-sm font-semibold text-[var(--foreground)]">{player.wins}</div>

                                    {/* Win % */}
                                    <div className="text-center text-sm text-[var(--muted-foreground)]">{player.winRate}%</div>

                                    {/* 🌈 */}
                                    <div className="text-center text-sm text-pink-500 font-medium">
                                        {player.lastPlaceCount > 0 ? player.lastPlaceCount : "-"}
                                    </div>

                                    {/* 🌈% */}
                                    <div className="text-center text-sm text-pink-500">
                                        {player.gamesPlayed > 0 ? Math.round(player.lastPlaceCount / player.gamesPlayed * 100) : 0}%
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <p className="text-center text-xs text-[var(--muted-foreground)] mt-4">
                        Tap a player to see detailed stats
                    </p>
                </div>
            )}

            {/* Player Detail Modal */}
            {selectedPlayer && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedPlayer(null)}>
                    <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full overflow-hidden bg-[var(--muted)] flex items-center justify-center border border-[var(--border)]/50">
                                    <Image
                                        src={getAvatarUrl(selectedPlayer.image)}
                                        alt={selectedPlayer.name}
                                        width={48}
                                        height={48}
                                        className="object-cover"
                                        unoptimized={getAvatarUrl(selectedPlayer.image).startsWith('data:')}
                                    />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-[var(--foreground)]">{selectedPlayer.name}</h3>
                                    <p className="text-sm text-[var(--muted-foreground)]">{selectedPlayer.gamesPlayed} games played</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedPlayer(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-[var(--muted-foreground)]" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-yellow-500/10 rounded-xl p-3 text-center border border-yellow-500/20">
                                <div className="text-2xl font-bold text-yellow-500">{selectedPlayer.wins}</div>
                                <div className="text-xs text-[var(--muted-foreground)]">🥇 1st Place</div>
                            </div>
                            <div className="bg-gray-400/10 rounded-xl p-3 text-center border border-gray-400/20">
                                <div className="text-2xl font-bold text-gray-400">{selectedPlayer.secondPlace}</div>
                                <div className="text-xs text-[var(--muted-foreground)]">🥈 2nd Place</div>
                            </div>
                            <div className="bg-orange-500/10 rounded-xl p-3 text-center border border-orange-500/20">
                                <div className="text-2xl font-bold text-orange-500">{selectedPlayer.thirdPlace}</div>
                                <div className="text-xs text-[var(--muted-foreground)]">🥉 3rd Place</div>
                            </div>
                            <div className="bg-pink-500/10 rounded-xl p-3 text-center border border-pink-500/20">
                                <div className="text-2xl font-bold text-pink-500">{selectedPlayer.lastPlaceCount}</div>
                                <div className="text-xs text-[var(--muted-foreground)]">🌈 Last Place</div>
                            </div>
                        </div>

                        {/* Average Percentile - Main Ranking Stat */}
                        <div className="mt-4 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-xl p-4 text-center border border-indigo-500/30">
                            <div className="text-3xl font-bold text-indigo-400">{selectedPlayer.averagePercentile}%</div>
                            <div className="text-xs text-[var(--muted-foreground)] mt-1">Average Percentile (Ranking Score)</div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3">
                            <div className="bg-[var(--muted)]/30 rounded-xl p-3 text-center">
                                <div className="text-lg font-bold text-cyan-400">{selectedPlayer.winRate}%</div>
                                <div className="text-xs text-[var(--muted-foreground)]">Win Rate</div>
                            </div>
                            <div className="bg-[var(--muted)]/30 rounded-xl p-3 text-center">
                                <div className="text-lg font-bold text-green-400">{selectedPlayer.podiumRate}%</div>
                                <div className="text-xs text-[var(--muted-foreground)]">Podium Rate</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Hidden Leaderboard for Capture */}
            <div style={{ position: 'absolute', top: -9999, left: -9999, visibility: 'visible' }}>
                <ShareableLeaderboard
                    ref={leaderboardRef}
                    leaderboard={leaderboard}
                />
            </div>
        </div>
    );
}
