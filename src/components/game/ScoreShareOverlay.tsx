import React, { useRef, useState } from 'react';
import { Player } from '@/lib/store';
import { X, Share2, Download, Spade, Heart, Club, Diamond } from 'lucide-react';
import html2canvas from 'html2canvas';

interface ScoreShareOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    players: Player[];
    gameName: string;
}

export function ScoreShareOverlay({ isOpen, onClose, players, gameName }: ScoreShareOverlayProps) {
    const shareRef = useRef<HTMLDivElement>(null);
    const [capturing, setCapturing] = useState(false);

    if (!isOpen) return null;

    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    const getPositionIndicator = (index: number, total: number) => {
        if (index === 0) return '🥇';
        if (index === 1) return '🥈';
        if (index === total - 1) return '🏳️‍🌈';
        if (index === 2) return '🥉';
        return null;
    };

    const handleShare = async () => {
        if (!shareRef.current) return;
        
        setCapturing(true);
        try {
            // Wait for images to load if any (though we use emojis mainly)
            await new Promise(resolve => setTimeout(resolve, 500));

            const canvas = await html2canvas(shareRef.current, {
                backgroundColor: '#121212',
                scale: 2, // Higher quality
                useCORS: true,
                logging: false,
                allowTaint: true
            });

            const imageUrl = canvas.toDataURL('image/png');

            // Try native sharing first (mobile)
            if (navigator.share) {
                try {
                    const blob = await (await fetch(imageUrl)).blob();
                    const file = new File([blob], 'scorejudge-results.png', { type: 'image/png' });
                    
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            title: `ScoreJudge Results: ${gameName}`,
                            text: `Check out the results for ${gameName}!`,
                            files: [file]
                        });
                        setCapturing(false);
                        return;
                    }
                } catch (e) {
                    console.error('Error sharing file:', e);
                }
            }

            // Fallback: Download image
            const link = document.createElement('a');
            link.download = `scorejudge-${gameName.replace(/\s+/g, '-').toLowerCase()}.png`;
            link.href = imageUrl;
            link.click();
            
        } catch (e) {
            console.error('Error generating image:', e);
            alert('Failed to generate image. Please try again.');
        } finally {
            setCapturing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
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

                {/* Share Preview Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 bg-[var(--background)] flex items-center justify-center">
                    
                    {/* The Card to be Captured */}
                    <div 
                        ref={shareRef}
                        className="w-full bg-[#1a1a1a] rounded-2xl p-6 relative overflow-hidden shadow-2xl border border-white/5"
                        style={{
                            backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.15) 0%, rgba(0, 0, 0, 0) 50%)'
                        }}
                    >
                        {/* Decorative Background Elements */}
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Spade size={120} />
                        </div>
                        <div className="absolute bottom-0 left-0 p-4 opacity-5">
                            <Heart size={120} />
                        </div>

                        {/* Logo / Header */}
                        <div className="text-center mb-8 relative z-10">
                            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 font-[family-name:var(--font-russo)] tracking-wider drop-shadow-sm mb-2">
                                SCOREJUDGE
                            </h2>
                            <p className="text-sm text-gray-400 font-medium uppercase tracking-widest">
                                {gameName}
                            </p>
                            <div className="flex justify-center gap-2 mt-3 opacity-50">
                                <Spade size={12} className="text-indigo-400" />
                                <Heart size={12} className="text-rose-400" />
                                <Club size={12} className="text-emerald-400" />
                                <Diamond size={12} className="text-amber-400" />
                            </div>
                        </div>

                        {/* Score List */}
                        <div className="space-y-3 relative z-10">
                            {sortedPlayers.map((player, index) => {
                                const isWinner = index === 0;
                                const isLast = index === sortedPlayers.length - 1;
                                const medal = getPositionIndicator(index, sortedPlayers.length);

                                return (
                                    <div 
                                        key={player.email}
                                        className={`
                                            flex items-center justify-between p-3 rounded-xl border relative overflow-hidden
                                            ${isWinner 
                                                ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/5 border-yellow-500/30' 
                                                : isLast 
                                                    ? 'bg-gradient-to-r from-red-500/10 via-yellow-500/10 to-blue-500/10 border-white/10' 
                                                    : 'bg-white/5 border-white/5'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Rank / Medal */}
                                            <div className="w-8 h-8 flex items-center justify-center text-xl">
                                                {medal || <span className="text-gray-500 text-sm font-bold">#{index + 1}</span>}
                                            </div>
                                            
                                            {/* Avatar */}
                                            <div className="relative">
                                                {player.image ? (
                                                    <img src={player.image} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-gray-400">
                                                        {player.name.charAt(0)}
                                                    </div>
                                                )}
                                                {isWinner && (
                                                    <div className="absolute -top-2 -right-2 transform rotate-12">
                                                        <span className="text-xl">👑</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Name */}
                                            <div>
                                                <div className={`font-[family-name:var(--font-russo)] ${isWinner ? 'text-yellow-400' : 'text-white'}`}>
                                                    {player.name}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Score */}
                                        <div className={`text-2xl font-bold font-mono ${isWinner ? 'text-yellow-400' : 'text-white'}`}>
                                            {player.score}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="mt-8 text-center">
                            <div className="inline-block px-4 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] text-gray-500 font-mono tracking-widest">
                                PLAYED ON SCOREJUDGE
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-[var(--border)] bg-[var(--background)]/50 backdrop-blur-md">
                    <button
                        onClick={handleShare}
                        disabled={capturing}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-bold text-lg shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {capturing ? (
                            <>Generating...</>
                        ) : (
                            <>
                                <Share2 size={20} />
                                Share Results
                            </>
                        )}
                    </button>
                    <div className="text-center mt-2 text-xs text-[var(--muted-foreground)]">
                        Supports WhatsApp, Instagram, and more
                    </div>
                </div>
            </div>
        </div>
    );
}

