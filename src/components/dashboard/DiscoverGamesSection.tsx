"use client";

import { Loader2 } from "lucide-react";
import { DiscoverableGameCard } from "./DiscoverableGameCard";

export interface DiscoverableGame {
  id: string;
  name: string;
  ownerEmail: string;
  playerCount: number;
  createdAt?: number;
}

export interface DiscoverGamesSectionProps {
  games: DiscoverableGame[];
  loading: boolean;
  onJoin: (gameId: string) => void;
}

export function DiscoverGamesSection({
  games,
  loading,
  onJoin,
}: DiscoverGamesSectionProps) {
  if (games.length === 0) {
    return null;
  }

  return (
    <section className="shrink-0 max-h-[35%] flex flex-col">
      <div className="bg-background/95 backdrop-blur-md py-2 z-10 -mx-2 px-2 shrink-0">
        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-600 font-[family-name:var(--font-russo)] uppercase tracking-tight">
          Discover Games
        </h2>
        <p className="text-muted-foreground text-xs font-medium opacity-80">
          Join games that haven&apos;t started yet
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10 shrink-0">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : (
        <div className="flex flex-col gap-3 mt-2 overflow-y-auto custom-scrollbar pr-1 pb-2">
          {games.map((game) => (
            <DiscoverableGameCard
              key={game.id}
              id={game.id}
              name={game.name}
              ownerEmail={game.ownerEmail}
              playerCount={game.playerCount}
              onJoin={onJoin}
            />
          ))}
        </div>
      )}
    </section>
  );
}
