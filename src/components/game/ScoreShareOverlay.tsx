import React, { useRef, useState } from 'react';
import { Player } from '@/lib/store';
import { X, Share2, Spade, Club } from 'lucide-react';
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
                backgroundColor: '#1a1a2e',
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
                            width: '320px',
                            maxWidth: '100%',
                            backgroundColor: '#1a1a2e',
                            borderRadius: '24px',
                            padding: '32px 24px',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Decorative Background Elements */}
                        <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.08 }}>
                            <Spade size={140} color="#ffffff" />
                        </div>
                        <div style={{ position: 'absolute', bottom: '-20px', left: '-20px', opacity: 0.08 }}>
                            <Club size={140} color="#ffffff" />
                        </div>

                        {/* Logo / Header */}
                        <div style={{ textAlign: 'center', marginBottom: '24px', position: 'relative', zIndex: 10 }}>
                            <h2 style={{ 
                                fontSize: '2rem', 
                                fontWeight: 'bold', 
                                color: '#a78bfa',
                                letterSpacing: '0.08em',
                                marginBottom: '8px',
                                margin: 0,
                                fontFamily: 'system-ui, sans-serif',
                                textShadow: '0 0 20px rgba(167, 139, 250, 0.3)'
                            }}>
                                SCOREJUDGE
                            </h2>
                            <p style={{ 
                                fontSize: '0.875rem', 
                                color: '#9ca3af', 
                                fontWeight: '400', 
                                textTransform: 'uppercase', 
                                letterSpacing: '0.15em',
                                margin: '8px 0 0 0'
                            }}>
                                {gameName.toUpperCase()}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '12px' }}>
                                <span style={{ opacity: 0.4, fontSize: '12px' }}>♠</span>
                                <span style={{ opacity: 0.4, fontSize: '12px', color: '#ef4444' }}>♥</span>
                                <span style={{ opacity: 0.4, fontSize: '12px' }}>♣</span>
                                <span style={{ opacity: 0.4, fontSize: '12px', color: '#ef4444' }}>♦</span>
                            </div>
                        </div>

                        {/* Score List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative', zIndex: 10 }}>
                            {sortedPlayers.map((player, index) => {
                                const isWinner = index === 0;
                                const isLast = index === sortedPlayers.length - 1 && sortedPlayers.length > 1;
                                const medal = getPositionIndicator(index, sortedPlayers.length);

                                const cardBg = isWinner 
                                    ? '#3d3d1f'
                                    : '#2d2d3d';
                                
                                const cardBorder = isWinner 
                                    ? '2px solid #a3a33a'
                                    : '1px solid #3d3d4d';

                                return (
                                    <div 
                                        key={player.email}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '14px 16px',
                                            borderRadius: '14px',
                                            border: cardBorder,
                                            backgroundColor: cardBg,
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {/* Rank / Medal */}
                                            <div style={{ 
                                                width: '28px', 
                                                height: '28px', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center', 
                                                fontSize: '1.1rem' 
                                            }}>
                                                {medal || <span style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 'bold' }}>#{index + 1}</span>}
                                            </div>
                                            
                                            {/* Avatar */}
                                            <div style={{ position: 'relative' }}>
                                                {player.image ? (
                                                    <img 
                                                        src={player.image} 
                                                        alt="" 
                                                        style={{ 
                                                            width: '44px', 
                                                            height: '44px', 
                                                            borderRadius: '50%', 
                                                            objectFit: 'cover',
                                                            backgroundColor: '#4a4a5a'
                                                        }} 
                                                    />
                                                ) : (
                                                    <div style={{ 
                                                        width: '44px', 
                                                        height: '44px', 
                                                        borderRadius: '50%', 
                                                        backgroundColor: '#4a4a5a', 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'center', 
                                                        fontWeight: 'bold', 
                                                        color: '#d1d5db',
                                                        fontSize: '1.1rem'
                                                    }}>
                                                        {player.name.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                {isWinner && (
                                                    <div style={{ 
                                                        position: 'absolute', 
                                                        top: '-10px', 
                                                        left: '50%',
                                                        transform: 'translateX(-50%)'
                                                    }}>
                                                        <span style={{ fontSize: '1rem' }}>👑</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Name */}
                                            <div style={{ 
                                                color: isWinner ? '#fde047' : '#ffffff',
                                                fontWeight: '600',
                                                fontSize: '1rem',
                                                maxWidth: '120px',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {player.name}
                                            </div>
                                        </div>

                                        {/* Score */}
                                        <div style={{ 
                                            fontSize: '1.75rem', 
                                            fontWeight: 'bold', 
                                            fontFamily: 'system-ui, sans-serif',
                                            color: isWinner ? '#fde047' : '#ffffff'
                                        }}>
                                            {player.score}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div style={{ marginTop: '24px', textAlign: 'center' }}>
                            <div style={{ 
                                display: 'inline-block', 
                                padding: '6px 16px', 
                                borderRadius: '9999px', 
                                backgroundColor: 'rgba(255, 255, 255, 0.08)', 
                                fontSize: '10px', 
                                color: '#9ca3af', 
                                fontFamily: 'system-ui, sans-serif', 
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase'
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

