"use client";

import { Users, LogIn } from "lucide-react";

export interface DiscoverableGameCardProps {
  id: string;
  name: string;
  ownerEmail: string;
  playerCount: number;
  onJoin: (gameId: string) => void;
}

export function DiscoverableGameCard({
  id,
  name,
  ownerEmail,
  playerCount,
  onJoin,
}: DiscoverableGameCardProps) {
  return (
    <div
      data-testid={`discoverable-game-${id}`}
      className="glass p-3 rounded-xl flex items-center gap-4 group hover:border-indigo-500/30 transition-all overflow-hidden shrink-0 border border-white/[0.03]"
    >
      <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
        <div className="flex items-center gap-2 mb-1 overflow-hidden">
          <h3 className="font-bold text-base truncate group-hover:text-indigo-400 transition-colors uppercase tracking-tight font-[family-name:var(--font-russo)] leading-none shrink min-w-0">
            {name}
          </h3>
          <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[9px] font-bold border border-indigo-500/20">
            <Users size={9} />
            {playerCount}/12
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground min-w-0">
          <div className="truncate opacity-50 uppercase tracking-widest font-bold">
            Owner: {ownerEmail}
          </div>
        </div>
      </div>
      <button
        onClick={() => onJoin(id)}
        className="shrink-0 relative flex items-center gap-x-2 px-4 py-2 rounded-lg font-bold transition-all hover:scale-[1.03] active:scale-95 group/btn overflow-hidden shadow-lg shadow-indigo-900/40 w-[80px] justify-center"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 group-hover/btn:scale-110 transition-transform" />
        <span className="relative flex items-center gap-1.5 uppercase font-[family-name:var(--font-russo)] text-white text-[10px] tracking-wider">
          <LogIn size={12} /> Join
        </span>
      </button>
    </div>
  );
}
