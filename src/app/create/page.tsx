"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight } from "lucide-react";

export default function CreateGame() {
    const [name, setName] = useState("");
    const [creating, setCreating] = useState(false);
    const router = useRouter();

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;
        setCreating(true);

        try {
            const res = await fetch("/api/games", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });

            const responseText = await res.text();
            
            if (res.ok) {
                try {
                    const data = JSON.parse(responseText);
                    router.push(`/game/${data.gameId}`);
                    return;
                } catch (e) {
                    console.error("Failed to parse response:", e);
                    alert("Failed to create game");
                }
            } else {
                alert("Failed to create game");
            }
        } catch (err) {
            console.error(err);
            alert("Error creating game");
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--background)] safe-pb">
            <div className="w-full max-w-sm">
                <form onSubmit={handleCreate} className="space-y-8">
                    <div className="space-y-2">
                        <label className="text-[var(--muted-foreground)] text-sm font-medium uppercase tracking-wider ml-1">
                            Game Name
                        </label>
                        <input
                            autoFocus
                            className="w-full bg-transparent border-b-2 border-[var(--border)] text-3xl font-bold py-2 px-1 focus:border-[var(--primary)] outline-none transition-colors placeholder:text-[var(--muted)]"
                            placeholder="Friday Poker"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={creating}
                        />
                    </div>
                    
                    <button
                        disabled={creating || !name}
                        className="w-full bg-[var(--primary)] text-white py-4 rounded-full font-bold text-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95"
                    >
                        {creating ? <Loader2 className="animate-spin" /> : (
                            <>
                                Create & Invite <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
