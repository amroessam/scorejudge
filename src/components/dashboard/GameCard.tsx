"use client";

import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Trash2,
  Clock,
  CheckCircle,
  ChevronRight,
} from "lucide-react";

export interface GameCardStatus {
  label: string;
  color: string;
  bg: string;
  border?: string;
  icon: React.ComponentType<{ size?: number }>;
}

export interface GameCardProps {
  id: string;
  name: string;
  createdTime: string;
  isHidden?: boolean;
  status: GameCardStatus;
  showDelete: boolean;
  isDeleting: boolean;
  onDelete: (gameId: string, e: React.MouseEvent) => void;
}

export function GameCard({
  id,
  name,
  createdTime,
  isHidden,
  status,
  showDelete,
  isDeleting,
  onDelete,
}: GameCardProps) {
  const StatusIcon = status.icon;
  const isCompleted = status.label === "Completed";

  return (
    <div
      data-testid={`game-card-${id}`}
      className="group relative glass p-4 rounded-xl flex items-center gap-4 hover:bg-white/[0.07] transition-all border-white/[0.03]"
    >
      <Link
        href={`/game/${id}`}
        className="min-w-0 flex-1 flex items-center justify-between"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h3 className="font-bold text-lg truncate uppercase tracking-tight font-[family-name:var(--font-russo)] leading-none">
              {name.replace("ScoreJudge - ", "")}
            </h3>
            <div className="flex gap-1.5 shrink-0">
              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-widest ${status.bg} ${status.color} ${status.border || ""}`}
              >
                <StatusIcon size={10} />
                {status.label}
              </div>
              {isCompleted && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                  <CheckCircle size={10} />
                </div>
              )}
              {isHidden && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20 uppercase tracking-widest">
                  Hidden
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
            <span className="text-muted-foreground flex items-center gap-1 opacity-60">
              <Clock size={10} />
              {new Date(createdTime).toLocaleDateString()}
            </span>
            {!isCompleted &&
              status.label !== "Not Started" &&
              status.label !== "Loading..." && (
                <span className="text-indigo-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Resume <ArrowRight size={10} />
                </span>
              )}
            {isCompleted && (
              <span className="text-emerald-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                View Stats <ArrowRight size={10} />
              </span>
            )}
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0">
          <ChevronRight className="text-muted-foreground" size={20} />
        </div>
      </Link>

      {showDelete && (
        <button
          onClick={(e) => onDelete(id, e)}
          disabled={isDeleting}
          className="shrink-0 p-2.5 text-red-400/50 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-50"
          title={
            isCompleted
              ? "Hide from dashboard"
              : "Permanently remove or leave game"
          }
        >
          {isDeleting ? (
            <Loader2 className="animate-spin w-4 h-4" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  );
}
