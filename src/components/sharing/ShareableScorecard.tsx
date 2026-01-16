import React, { forwardRef } from 'react';
import { Player } from '@/lib/store';

interface ShareableScorecardProps {
    gameName: string;
    players: Player[];
}

export const ShareableScorecard = forwardRef<HTMLDivElement, ShareableScorecardProps>(({ gameName, players }, ref) => {
    // Logic from OG route to process players
    // 1. Sort by score descending
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score).slice(0, 20);

    // 2. Dense ranking logic
    const distinctScores = Array.from(new Set(sortedPlayers.map(p => p.score))).sort((a, b) => b - a);
    const topScore = distinctScores[0];
    const bottomScore = distinctScores[distinctScores.length - 1];

    const playersWithData = sortedPlayers.map((p, i) => {
        const denseRank = distinctScores.indexOf(p.score) + 1;
        const isTiedWinner = p.score === topScore;
        const isLastPlace = p.score === bottomScore && distinctScores.length > 1;

        return {
            ...p,
            rank: denseRank,
            displayRank: i + 1,
            isWinner: isTiedWinner,
            isLast: isLastPlace,
        };
    });

    // Dynamic height calculation
    // Header (~260px) + rows (104px each) + footer/padding (~140px)
    const totalHeight = Math.max(850, 260 + (playersWithData.length * 104) + 140);

    return (
        <div
            ref={ref}
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '750px',
                height: `${totalHeight}px`,
                background: '#050510',
                padding: '30px',
                fontFamily: 'sans-serif',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'absolute', // Position absolute to keep it out of flow when hidden
                top: 0,
                left: 0,
                zIndex: -1000,
                // visibility: 'hidden', // html2canvas might not capture if visibility: hidden or display: none. 
                // Better approach for html2canvas is to position it off-screen but visible.
            }}
        >
            {/* Main Card Frame */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(180deg, #101025 0%, #0a0a1a 100%)',
                    borderRadius: '40px',
                    border: '2px solid rgba(167, 139, 250, 0.3)',
                    boxShadow: '0 20px 80px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.1)',
                    padding: '40px 30px',
                    alignItems: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Decorative Glow */}
                <div style={{ position: 'absolute', top: '-100px', left: '-100px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(167, 139, 250, 0.15) 0%, transparent 70%)', display: 'flex' }} />

                {/* Header */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
                    <div style={{
                        display: 'flex',
                        fontSize: '60px',
                        fontWeight: '900',
                        color: '#ffffff',
                        letterSpacing: '4px',
                        textTransform: 'uppercase',
                        textShadow: '0 0 15px rgba(167, 139, 250, 0.6)',
                    }}>
                        SCOREJUDGE
                    </div>
                    <div style={{
                        display: 'flex',
                        fontSize: '20px',
                        color: '#a78bfa',
                        textTransform: 'uppercase',
                        letterSpacing: '8px',
                        marginTop: '4px',
                        fontWeight: '700',
                        opacity: 0.8,
                    }}>
                        {gameName || 'RESULTS'}
                    </div>

                    {/* Suit Symbols Row */}
                    <div style={{ display: 'flex', gap: '20px', marginTop: '16px', fontSize: '24px', opacity: 0.8 }}>
                        <div style={{ display: 'flex', color: '#4466ff' }}>♠</div>
                        <div style={{ display: 'flex', color: '#ff4466' }}>♥</div>
                        <div style={{ display: 'flex', color: '#44ff66' }}>♣</div>
                        <div style={{ display: 'flex', color: '#ffaa44' }}>♦</div>
                    </div>
                </div>

                {/* Players list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', maxWidth: '680px' }}>
                    {playersWithData.map((player, i) => (
                        <div
                            key={player.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '14px 24px',
                                background: player.isWinner
                                    ? 'linear-gradient(90deg, rgba(234,179,8,0.15) 0%, rgba(234,179,8,0.02) 100%)'
                                    : 'rgba(255,255,255,0.03)',
                                borderRadius: '24px',
                                border: player.isWinner
                                    ? '2px solid rgba(234,179,8,0.6)'
                                    : '1px solid rgba(255,255,255,0.06)',
                                boxShadow: player.isWinner ? '0 0 30px rgba(234,179,8,0.1)' : 'none',
                            }}
                        >
                            {/* Rank */}
                            <div style={{ display: 'flex', width: '50px', justifyContent: 'center', alignItems: 'center' }}>
                                {player.isLast && !player.isWinner ? <div style={{ display: 'flex', fontSize: '24px' }}>🌈</div> :
                                    player.rank === 1 ? (
                                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ display: 'flex' }}>
                                            <path d="M12 15C15.3137 15 18 12.3137 18 9V2H6V9C6 12.3137 8.68629 15 12 15Z" fill="#fbbf24" opacity="0.9" />
                                            <path d="M12 15V22M7 22H17M6 4H4C2.89543 4 2 4.89543 2 6V7C2 9.20914 3.79086 11 6 11M18 4H20C21.1046 4 22 4.89543 22 6V7C22 9.20914 20.2091 11 18 11" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                    ) : player.rank === 2 ? (
                                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ display: 'flex' }}>
                                            <path d="M12 15C15.3137 15 18 12.3137 18 9V2H6V9C6 12.3137 8.68629 15 12 15Z" fill="#cbd5e1" opacity="0.9" />
                                            <path d="M12 15V22M7 22H17M6 4H4C2.89543 4 2 4.89543 2 6V7C2 9.20914 3.79086 11 6 11M18 4H20C21.1046 4 22 4.89543 22 6V7C22 9.20914 20.2091 11 18 11" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                    ) : player.rank === 3 ? (
                                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ display: 'flex' }}>
                                            <path d="M12 15C15.3137 15 18 12.3137 18 9V2H6V9C6 12.3137 8.68629 15 12 15Z" fill="#b45309" opacity="0.9" />
                                            <path d="M12 15V22M7 22H17M6 4H4C2.89543 4 2 4.89543 2 6V7C2 9.20914 3.79086 11 6 11M18 4H20C21.1046 4 22 4.89543 22 6V7C22 9.20914 20.2091 11 18 11" stroke="#b45309" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                    ) : (
                                        <div style={{ display: 'flex', fontSize: '18px', color: '#64748b', fontWeight: 'bold' }}>{player.rank}</div>
                                    )
                                }
                            </div>

                            {/* Avatar */}
                            <div style={{ display: 'flex', marginLeft: '12px', position: 'relative' }}>
                                {player.isWinner && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '-35px',
                                        left: '12px',
                                        fontSize: '44px',
                                        zIndex: 10,
                                    }}>👑</div>
                                )}
                                <div
                                    style={{
                                        display: 'flex',
                                        width: '74px',
                                        height: '74px',
                                        borderRadius: '50%',
                                        background: player.isWinner ? '#eab308' : 'rgba(255,255,255,0.1)',
                                        padding: '2px',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <div style={{
                                        display: 'flex',
                                        width: '100%',
                                        height: '100%',
                                        borderRadius: '50%',
                                        overflow: 'hidden',
                                        background: '#0a0a1a',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        {/* Use img tag for client-side rendering with CORS */}
                                        {player.image ? (
                                            <img
                                                src={player.image}
                                                width="100%"
                                                height="100%"
                                                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                                                crossOrigin="anonymous"
                                                alt={player.name}
                                            />
                                        ) : (
                                            <div style={{
                                                display: 'flex',
                                                fontSize: '28px',
                                                fontWeight: 'bold',
                                                color: player.isWinner ? '#facc15' : '#6366f1'
                                            }}>
                                                {(player.name || '?')[0].toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Name */}
                            <div style={{
                                display: 'flex',
                                flex: 1,
                                marginLeft: '20px',
                                fontSize: '24px',
                                fontWeight: '600',
                                color: player.isWinner ? '#fef3c7' : '#ffffff',
                                alignItems: 'center',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '380px',
                            }}>
                                <div style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {player.name}
                                </div>
                                {player.isLast && !player.isWinner && <span style={{ marginLeft: '8px', fontSize: '20px', opacity: 0.9, flexShrink: 0 }}>🌈</span>}
                            </div>

                            {/* Score */}
                            <div style={{
                                display: 'flex',
                                fontSize: '38px',
                                fontWeight: '900',
                                color: player.isWinner ? '#facc15' : 'white',
                            }}>
                                {player.score}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});

ShareableScorecard.displayName = 'ShareableScorecard';
