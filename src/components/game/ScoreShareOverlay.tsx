import React, { useState } from 'react';
import { Player } from '@/lib/store';
import { X, Share2, Download, Loader2 } from 'lucide-react';

interface ScoreShareOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    players: Player[];
    gameName: string;
}

export function ScoreShareOverlay({ isOpen, onClose, players, gameName }: ScoreShareOverlayProps) {
    const [generating, setGenerating] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Pre-load preview when opening (optional, or just load on demand)
    // For now, we construct the URL dynamically
    const getOgImageUrl = () => {
        const playersData = JSON.stringify(players.map(p => ({
            name: p.name,
            score: p.score,
            image: p.image
        })));

        const params = new URLSearchParams({
            name: gameName,
            players: playersData
        });

        return `/api/og?${params.toString()}`;
    };

    if (!isOpen) return null;

    const handleShare = async () => {
        setGenerating(true);
        try {
            const imageUrl = getOgImageUrl();
            const blob = await (await fetch(imageUrl)).blob();
            const file = new File([blob], `scorejudge-${gameName.replace(/\s+/g, '-').toLowerCase()}.png`, { type: 'image/png' });

            if (navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: `ScoreJudge Results: ${gameName}`,
                    text: `Check out the results for ${gameName}!`,
                    files: [file]
                });
            } else {
                // Fallback to download
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `scorejudge-${gameName.replace(/\s+/g, '-').toLowerCase()}.png`;
                link.click();
            }
        } catch (e) {
            console.error('Error sharing:', e);
            alert('Failed to share results. Please try again.');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-[var(--card)] rounded-3xl overflow-hidden shadow-2xl border border-[var(--border)] flex flex-col max-h-[90vh]">

                {/* Header Actions */}
                <div className="p-4 flex justify-between items-center border-b border-[var(--border)] bg-[var(--background)]/50 backdrop-blur-md sticky top-0 z-10">
                    <h3 className="font-[family-name:var(--font-russo)] text-xl">Share Results</h3>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-[var(--secondary)] transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Preview Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-[var(--background)] flex items-center justify-center">
                    <div className="relative w-full aspect-[4/5] rounded-xl overflow-hidden shadow-2xl border border-[var(--border)] bg-[#121212]">
                        {/* Live Preview of the API Image */}
                        <img
                            src={getOgImageUrl()}
                            alt="Result Preview"
                            className="w-full h-full object-contain"
                        />
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-[var(--border)] bg-[var(--background)]/50 backdrop-blur-md">
                    <button
                        onClick={handleShare}
                        disabled={generating}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold text-lg shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed group"
                        style={{
                            boxShadow: '0 4px 0 #5b21b6, 0 6px 12px rgba(0,0,0,0.3)',
                        }}
                    >
                        {generating ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Share2 size={20} className="group-hover:-translate-y-0.5 transition-transform" />
                                Share Image
                            </>
                        )}
                    </button>
                    <div className="text-center mt-3 text-xs text-[var(--muted-foreground)] opacity-70">
                        High-quality image generated instantly
                    </div>
                </div>
            </div>
        </div>
    );
}
