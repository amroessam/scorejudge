"use client";

import { useEffect, useState } from "react";
import { Trophy, Loader2, Crown } from "lucide-react";
import Image from "next/image";

interface LeaderboardEntry {
    email: string;
    name: string;
    image: string | null;
    gamesPlayed: number;
    wins: number;
    winRate: number;
    totalScore: number;
    lastPlaceCount: number;
}

export function GlobalLeaderboard() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    if (loading) {
        return (
            <div className="w-full max-w-md mx-auto p-6">
                <div className="flex items-center justify-center gap-2 text-[var(--muted-foreground)]">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Loading leaderboard...</span>
                </div>
            </div>
        );
    }

    if (error || leaderboard.length === 0) {
        return (
            <div className="w-full max-w-md mx-auto p-6 text-center text-[var(--muted-foreground)]">
                {error || "No leaderboard data yet. Play at least 3 games to appear!"}
            </div>
        );
    }

    return (
        <div className="w-full max-w-md mx-auto">
            {/* Header */}
            <div className="flex items-center justify-center gap-2 mb-4">
                <Trophy className="w-6 h-6 text-yellow-500" />
                <h2 className="text-xl font-bold text-[var(--foreground)]">
                    Global Leaderboard
                </h2>
                <Trophy className="w-6 h-6 text-yellow-500" />
            </div>

            {/* Leaderboard Table */}
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-lg">
                {/* Table Header */}
                <div className="grid grid-cols-[40px_1fr_50px_50px_50px_40px] gap-2 px-4 py-3 bg-[var(--muted)]/30 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                    <div className="text-center">#</div>
                    <div>Player</div>
                    <div className="text-center">Games</div>
                    <div className="text-center">Wins</div>
                    <div className="text-center">%</div>
                    <div className="text-center">🌈</div>
                </div>

                {/* Table Body */}
                <div className="divide-y divide-[var(--border)]">
                    {leaderboard.slice(0, 10).map((player, index) => (
                        <div
                            key={player.email}
                            className={`grid grid-cols-[40px_1fr_50px_50px_50px_40px] gap-2 px-4 py-3 items-center transition-colors ${index === 0
                                    ? "bg-yellow-500/10"
                                    : index === 1
                                        ? "bg-gray-400/10"
                                        : index === 2
                                            ? "bg-orange-600/10"
                                            : ""
                                }`}
                        >
                            {/* Rank */}
                            <div className="text-center text-lg">
                                {index === 0 ? (
                                    "🥇"
                                ) : index === 1 ? (
                                    "🥈"
                                ) : index === 2 ? (
                                    "🥉"
                                ) : (
                                    <span className="text-[var(--muted-foreground)] font-medium">
                                        {index + 1}
                                    </span>
                                )}
                            </div>

                            {/* Player */}
                            <div className="flex items-center gap-2 min-w-0">
                                {/* Avatar */}
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--muted)] flex-shrink-0 flex items-center justify-center">
                                    {player.image ? (
                                        <Image
                                            src={player.image}
                                            alt={player.name}
                                            width={32}
                                            height={32}
                                            className="object-cover"
                                        />
                                    ) : (
                                        <span className="text-sm">👤</span>
                                    )}
                                </div>
                                {/* Name + Crown for #1 */}
                                <div className="flex items-center gap-1 min-w-0">
                                    {index === 0 && (
                                        <Crown className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                                    )}
                                    <span
                                        className={`truncate text-sm font-medium ${index === 0
                                                ? "text-yellow-500"
                                                : "text-[var(--foreground)]"
                                            }`}
                                    >
                                        {player.name}
                                    </span>
                                </div>
                            </div>

                            {/* Games */}
                            <div className="text-center text-sm text-[var(--muted-foreground)]">
                                {player.gamesPlayed}
                            </div>

                            {/* Wins */}
                            <div className="text-center text-sm font-semibold text-[var(--foreground)]">
                                {player.wins}
                            </div>

                            {/* Win % */}
                            <div className="text-center text-sm text-[var(--muted-foreground)]">
                                {player.winRate}%
                            </div>

                            {/* 🌈 Count */}
                            <div className="text-center text-sm text-pink-500 font-medium">
                                {player.lastPlaceCount > 0 ? player.lastPlaceCount : "-"}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer note */}
            <p className="text-center text-xs text-[var(--muted-foreground)] mt-3">
                Minimum 3 games to appear on leaderboard
            </p>
        </div>
    );
}
