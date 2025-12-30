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

            // html2canvas doesn't support oklab() colors from Tailwind CSS 4
            // All colors in shareRef use explicit hex/rgb values
            const canvas = await html2canvas(shareRef.current, {
                backgroundColor: '#0a0a0a',
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
                    
                    {/* 
                        The Card to be Captured 
                        IMPORTANT: html2canvas doesn't support oklab() from Tailwind CSS 4
                        All colors MUST use explicit hex/rgb values, NOT CSS variables or Tailwind classes
                    */}
                    <div 
                        ref={shareRef}
                        style={{
                            width: '320px',
                            padding: '28px 20px',
                            backgroundColor: '#0a0a0a',
                            borderRadius: '20px',
                            border: '1px solid #262626',
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                        }}
                    >
                        {/* Header */}
                        <div style={{ 
                            textAlign: 'center', 
                            marginBottom: '24px',
                        }}>
                            {/* SCOREJUDGE Title with 3D effect */}
                            <div style={{
                                fontSize: '26px',
                                fontWeight: '800',
                                letterSpacing: '2px',
                                color: '#a78bfa',
                                textShadow: '0 2px 0 #7c3aed, 0 3px 0 #5b21b6, 0 4px 8px rgba(0,0,0,0.5)',
                                marginBottom: '8px',
                            }}>
                                SCOREJUDGE
                            </div>
                            
                            {/* Game Name */}
                            <div style={{
                                fontSize: '13px',
                                fontWeight: '500',
                                color: '#a1a1aa',
                                letterSpacing: '1.5px',
                                textTransform: 'uppercase',
                                marginBottom: '12px',
                            }}>
                                {gameName.toUpperCase()}
                            </div>
                            
                            {/* Card Suits - using explicit hex colors */}
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'center', 
                                gap: '10px', 
                                fontSize: '16px',
                            }}>
                                <span style={{ color: '#818cf8' }}>♠</span>
                                <span style={{ color: '#f87171' }}>♥</span>
                                <span style={{ color: '#4ade80' }}>♣</span>
                                <span style={{ color: '#fbbf24' }}>♦</span>
                            </div>
                        </div>

                        {/* Player Cards - using explicit hex/rgb colors only */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {sortedPlayers.map((player, index) => {
                                const isWinner = index === 0;
                                const isLast = index === sortedPlayers.length - 1 && sortedPlayers.length > 1;
                                const medal = getPositionIndicator(index, sortedPlayers.length);

                                // Explicit hex colors for html2canvas compatibility
                                const cardStyles: React.CSSProperties = {
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '12px 14px',
                                    borderRadius: '14px',
                                    backgroundColor: isWinner ? '#332800' : isLast ? '#1f1528' : '#171717',
                                    border: isWinner 
                                        ? '2px solid #ca8a04' 
                                        : isLast 
                                            ? '1px solid #7c3aed' 
                                            : '1px solid #262626',
                                    boxShadow: isWinner ? '0 4px 12px rgba(202, 138, 4, 0.25)' : 'none',
                                };

                                return (
                                    <div key={player.email} style={cardStyles}>
                                        {/* Medal/Position - fixed width */}
                                        <div style={{ 
                                            width: '32px', 
                                            height: '32px', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            fontSize: '18px',
                                            flexShrink: 0,
                                        }}>
                                            {medal || (
                                                <span style={{ 
                                                    color: '#71717a', 
                                                    fontSize: '11px', 
                                                    fontWeight: '700' 
                                                }}>
                                                    #{index + 1}
                                                </span>
                                            )}
                                        </div>
                                        
                                        {/* Avatar - fixed size */}
                                        <div style={{ 
                                            position: 'relative',
                                            flexShrink: 0,
                                            marginRight: '10px',
                                        }}>
                                            {player.image ? (
                                                <img 
                                                    src={player.image} 
                                                    alt="" 
                                                    style={{ 
                                                        width: '40px', 
                                                        height: '40px', 
                                                        borderRadius: '50%', 
                                                        objectFit: 'cover',
                                                        border: isWinner ? '2px solid #eab308' : '2px solid #3f3f46',
                                                    }} 
                                                />
                                            ) : (
                                                <div style={{ 
                                                    width: '40px', 
                                                    height: '40px', 
                                                    borderRadius: '50%', 
                                                    backgroundColor: '#27272a', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center', 
                                                    fontWeight: '700', 
                                                    color: '#d4d4d8',
                                                    fontSize: '16px',
                                                    border: isWinner ? '2px solid #eab308' : '2px solid #3f3f46',
                                                }}>
                                                    {player.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            {/* Crown for winner */}
                                            {isWinner && (
                                                <div style={{ 
                                                    position: 'absolute', 
                                                    top: '-10px', 
                                                    left: '50%',
                                                    transform: 'translateX(-50%)',
                                                    fontSize: '14px',
                                                }}>
                                                    👑
                                                </div>
                                            )}
                                        </div>

                                        {/* Player Name - flex grow, no truncation */}
                                        <div style={{ 
                                            flex: 1,
                                            minWidth: 0,
                                            fontWeight: '600',
                                            fontSize: '15px',
                                            letterSpacing: '0.3px',
                                            color: isWinner ? '#fde047' : '#ffffff',
                                            textShadow: isWinner ? '0 1px 2px rgba(0,0,0,0.4)' : 'none',
                                            wordBreak: 'break-word',
                                            lineHeight: '1.3',
                                        }}>
                                            {player.name}
                                        </div>

                                        {/* Score - fixed width, right aligned */}
                                        <div style={{ 
                                            fontSize: '24px', 
                                            fontWeight: '700',
                                            color: isWinner ? '#fde047' : '#ffffff',
                                            textShadow: isWinner 
                                                ? '0 2px 0 #a16207, 0 3px 6px rgba(0,0,0,0.4)' 
                                                : '0 1px 3px rgba(0,0,0,0.3)',
                                            marginLeft: '12px',
                                            flexShrink: 0,
                                            minWidth: '40px',
                                            textAlign: 'right' as const,
                                        }}>
                                            {player.score}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer - explicit hex colors */}
                        <div style={{ 
                            marginTop: '20px', 
                            textAlign: 'center',
                        }}>
                            <div style={{ 
                                display: 'inline-block', 
                                padding: '6px 14px', 
                                borderRadius: '20px', 
                                backgroundColor: '#171717',
                                border: '1px solid #262626',
                                fontSize: '9px', 
                                fontWeight: '600',
                                color: '#71717a', 
                                letterSpacing: '1.2px',
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
