import React, { useRef, useState } from 'react';
import { Player } from '@/lib/store';
import { X, Share2 } from 'lucide-react';
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
            await new Promise(resolve => setTimeout(resolve, 300));

            const canvas = await html2canvas(shareRef.current, {
                backgroundColor: '#0f0f0f',
                scale: 2,
                useCORS: true,
                logging: false,
                allowTaint: true
            });

            const imageUrl = canvas.toDataURL('image/png');

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

                {/* Share Preview Content */}
                <div className="flex-1 overflow-y-auto p-4 bg-[var(--background)] flex items-center justify-center">
                    
                    {/* The Card to be Captured */}
                    <div 
                        ref={shareRef}
                        style={{
                            width: '340px',
                            padding: '24px 20px',
                            backgroundColor: '#0f0f0f',
                            borderRadius: '24px',
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                        }}
                    >
                        {/* Header with Logo */}
                        <div style={{ 
                            textAlign: 'center', 
                            marginBottom: '20px',
                        }}>
                            {/* SCOREJUDGE Title with 3D effect */}
                            <div style={{
                                fontSize: '28px',
                                fontWeight: '900',
                                letterSpacing: '3px',
                                color: '#a78bfa',
                                textShadow: '0 2px 0 #7c3aed, 0 4px 0 #5b21b6, 0 6px 8px rgba(0,0,0,0.4)',
                                marginBottom: '6px',
                            }}>
                                SCOREJUDGE
                            </div>
                            
                            {/* Game Name */}
                            <div style={{
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#a1a1aa',
                                letterSpacing: '2px',
                                textTransform: 'uppercase',
                            }}>
                                {gameName.toUpperCase()}
                            </div>
                            
                            {/* Card Suits */}
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'center', 
                                gap: '8px', 
                                marginTop: '10px',
                                fontSize: '14px',
                            }}>
                                <span style={{ color: '#818cf8' }}>♠</span>
                                <span style={{ color: '#f87171' }}>♥</span>
                                <span style={{ color: '#4ade80' }}>♣</span>
                                <span style={{ color: '#fbbf24' }}>♦</span>
                            </div>
                        </div>

                        {/* Player Cards */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {sortedPlayers.map((player, index) => {
                                const isWinner = index === 0;
                                const isLast = index === sortedPlayers.length - 1 && sortedPlayers.length > 1;
                                const medal = getPositionIndicator(index, sortedPlayers.length);

                                // Card styling based on position
                                let cardBg = '#1c1c1e';
                                let cardBorder = '1px solid #2c2c2e';
                                let cardShadow = 'none';
                                
                                if (isWinner) {
                                    cardBg = 'linear-gradient(135deg, #3d3d00 0%, #2a2a00 100%)';
                                    cardBorder = '2px solid #ca8a04';
                                    cardShadow = '0 4px 12px rgba(202, 138, 4, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)';
                                } else if (isLast) {
                                    cardBg = 'linear-gradient(135deg, #2d1f3d 0%, #1f1f2e 100%)';
                                    cardBorder = '1px solid #7c3aed';
                                }

                                return (
                                    <div 
                                        key={player.email}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '14px 16px',
                                            borderRadius: '16px',
                                            background: cardBg,
                                            border: cardBorder,
                                            boxShadow: cardShadow,
                                        }}
                                    >
                                        {/* Left side: Medal + Avatar + Name */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {/* Medal/Position */}
                                            <div style={{ 
                                                width: '28px', 
                                                height: '28px', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                fontSize: '20px',
                                            }}>
                                                {medal || (
                                                    <span style={{ 
                                                        color: '#71717a', 
                                                        fontSize: '12px', 
                                                        fontWeight: '700' 
                                                    }}>
                                                        #{index + 1}
                                                    </span>
                                                )}
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
                                                            border: isWinner ? '2px solid #eab308' : '2px solid #3f3f46',
                                                        }} 
                                                    />
                                                ) : (
                                                    <div style={{ 
                                                        width: '44px', 
                                                        height: '44px', 
                                                        borderRadius: '50%', 
                                                        backgroundColor: '#27272a', 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'center', 
                                                        fontWeight: '700', 
                                                        color: '#a1a1aa',
                                                        fontSize: '18px',
                                                        border: isWinner ? '2px solid #eab308' : '2px solid #3f3f46',
                                                        textShadow: isWinner ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
                                                    }}>
                                                        {player.name.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                {/* Crown for winner */}
                                                {isWinner && (
                                                    <div style={{ 
                                                        position: 'absolute', 
                                                        top: '-12px', 
                                                        left: '50%',
                                                        transform: 'translateX(-50%)',
                                                        fontSize: '16px',
                                                        filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))',
                                                    }}>
                                                        👑
                                                    </div>
                                                )}
                                            </div>

                                            {/* Player Name */}
                                            <div style={{ 
                                                fontWeight: '700',
                                                fontSize: '16px',
                                                letterSpacing: '0.5px',
                                                color: isWinner ? '#fde047' : '#ffffff',
                                                textShadow: isWinner 
                                                    ? '0 1px 0 #a16207, 0 2px 4px rgba(0,0,0,0.3)' 
                                                    : '0 1px 2px rgba(0,0,0,0.3)',
                                                maxWidth: '120px',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {player.name}
                                            </div>
                                        </div>

                                        {/* Score */}
                                        <div style={{ 
                                            fontSize: '28px', 
                                            fontWeight: '800',
                                            fontFamily: 'system-ui, sans-serif',
                                            color: isWinner ? '#fde047' : '#ffffff',
                                            textShadow: isWinner 
                                                ? '0 2px 0 #a16207, 0 4px 8px rgba(0,0,0,0.4)' 
                                                : '0 2px 4px rgba(0,0,0,0.3)',
                                            letterSpacing: '-1px',
                                        }}>
                                            {player.score}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div style={{ 
                            marginTop: '20px', 
                            textAlign: 'center',
                        }}>
                            <div style={{ 
                                display: 'inline-block', 
                                padding: '6px 14px', 
                                borderRadius: '20px', 
                                backgroundColor: '#1c1c1e',
                                border: '1px solid #2c2c2e',
                                fontSize: '10px', 
                                fontWeight: '600',
                                color: '#71717a', 
                                letterSpacing: '1.5px',
                                textTransform: 'uppercase',
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
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold text-lg shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        style={{
                            boxShadow: '0 4px 0 #5b21b6, 0 6px 12px rgba(0,0,0,0.3)',
                        }}
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
