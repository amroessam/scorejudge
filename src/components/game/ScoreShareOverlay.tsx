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
                    
                    {/* The Card to be Captured - Using inline styles for html2canvas compatibility */}
                    <div 
                        ref={shareRef}
                        style={{
                            width: '100%',
                            backgroundColor: '#1a1a1a',
                            borderRadius: '16px',
                            padding: '24px',
                            position: 'relative',
                            overflow: 'hidden',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.15) 0%, rgba(0, 0, 0, 0) 50%)'
                        }}
                    >
                        {/* Decorative Background Elements */}
                        <div style={{ position: 'absolute', top: 0, right: 0, padding: '16px', opacity: 0.05 }}>
                            <Spade size={120} color="#ffffff" />
                        </div>
                        <div style={{ position: 'absolute', bottom: 0, left: 0, padding: '16px', opacity: 0.05 }}>
                            <Heart size={120} color="#ffffff" />
                        </div>

                        {/* Logo / Header */}
                        <div style={{ textAlign: 'center', marginBottom: '32px', position: 'relative', zIndex: 10 }}>
                            <h2 style={{ 
                                fontSize: '1.875rem', 
                                fontWeight: 'bold', 
                                background: 'linear-gradient(to right, #60a5fa, #a855f7, #ec4899)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                                letterSpacing: '0.05em',
                                marginBottom: '8px',
                                fontFamily: 'var(--font-russo), sans-serif'
                            }}>
                                SCOREJUDGE
                            </h2>
                            <p style={{ fontSize: '0.875rem', color: '#9ca3af', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                {gameName}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px', opacity: 0.5 }}>
                                <Spade size={12} color="#818cf8" />
                                <Heart size={12} color="#fb7185" />
                                <Club size={12} color="#34d399" />
                                <Diamond size={12} color="#fbbf24" />
                            </div>
                        </div>

                        {/* Score List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', zIndex: 10 }}>
                            {sortedPlayers.map((player, index) => {
                                const isWinner = index === 0;
                                const isLast = index === sortedPlayers.length - 1;
                                const medal = getPositionIndicator(index, sortedPlayers.length);

                                const cardStyle: React.CSSProperties = {
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '12px',
                                    borderRadius: '12px',
                                    border: isWinner 
                                        ? '1px solid rgba(234, 179, 8, 0.3)' 
                                        : isLast 
                                            ? '1px solid rgba(255, 255, 255, 0.1)' 
                                            : '1px solid rgba(255, 255, 255, 0.05)',
                                    background: isWinner 
                                        ? 'linear-gradient(to right, rgba(234, 179, 8, 0.2), rgba(245, 158, 11, 0.05))' 
                                        : isLast 
                                            ? 'linear-gradient(to right, rgba(239, 68, 68, 0.1), rgba(234, 179, 8, 0.1), rgba(59, 130, 246, 0.1))' 
                                            : 'rgba(255, 255, 255, 0.05)',
                                    position: 'relative',
                                    overflow: 'hidden'
                                };

                                return (
                                    <div 
                                        key={player.email}
                                        style={cardStyle}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {/* Rank / Medal */}
                                            <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                                                {medal || <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 'bold' }}>#{index + 1}</span>}
                                            </div>
                                            
                                            {/* Avatar */}
                                            <div style={{ position: 'relative' }}>
                                                {player.image ? (
                                                    <img src={player.image} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.1)' }} />
                                                ) : (
                                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#9ca3af' }}>
                                                        {player.name.charAt(0)}
                                                    </div>
                                                )}
                                                {isWinner && (
                                                    <div style={{ position: 'absolute', top: '-8px', right: '-8px', transform: 'rotate(12deg)' }}>
                                                        <span style={{ fontSize: '1.25rem' }}>👑</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Name */}
                                            <div>
                                                <div style={{ fontFamily: 'var(--font-russo), sans-serif', color: isWinner ? '#facc15' : '#ffffff' }}>
                                                    {player.name}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Score */}
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'monospace', color: isWinner ? '#facc15' : '#ffffff' }}>
                                            {player.score}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div style={{ marginTop: '32px', textAlign: 'center' }}>
                            <div style={{ 
                                display: 'inline-block', 
                                padding: '4px 16px', 
                                borderRadius: '9999px', 
                                backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                                border: '1px solid rgba(255, 255, 255, 0.05)', 
                                fontSize: '10px', 
                                color: '#6b7280', 
                                fontFamily: 'monospace', 
                                letterSpacing: '0.1em' 
                            }}>
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

