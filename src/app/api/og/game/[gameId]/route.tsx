import { ImageResponse } from 'next/og';
import { getGame } from '@/lib/db';

// Force Node.js runtime for production stability
export const runtime = 'nodejs';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ gameId: string }> }
) {
    const startTime = Date.now();

    try {
        const { gameId } = await params;

        // 1. Database fetch timing
        const dbStart = Date.now();
        const game = await getGame(gameId);
        console.log(`[OG] DB fetch: ${Date.now() - dbStart}ms`);

        if (!game) {
            return new Response('Game not found', { status: 404 });
        }

        const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score).slice(0, 20);
        const origin = new URL(request.url).origin;

        // 2. Avatar fetching timing
        const avatarStart = Date.now();
        const avatarPromises = sortedPlayers.map(async (p) => {
            if (!p.image) return null;

            // Use data URIs directly (already embedded - instant)
            if (p.image.startsWith('data:')) {
                return p.image;
            }

            try {
                let url = p.image;
                if (url.startsWith('/')) {
                    url = `${origin}${url}`;
                }

                // 3s timeout for avatar fetch
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);

                const response = await fetch(url, {
                    signal: controller.signal,
                    cache: 'no-store'
                });
                clearTimeout(timeoutId);

                if (!response.ok) return null;

                const buffer = await response.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                const contentType = response.headers.get('content-type') || 'image/png';
                return `data:${contentType};base64,${base64}`;
            } catch {
                return null;
            }
        });

        const avatars = await Promise.all(avatarPromises);
        console.log(`[OG] Avatar fetch (${sortedPlayers.length} players): ${Date.now() - avatarStart}ms`);

        // Dense ranking: players with same score get same rank/medal
        const distinctScores = Array.from(new Set(sortedPlayers.map(p => p.score))).sort((a, b) => b - a);
        const topScore = distinctScores[0];
        const bottomScore = distinctScores[distinctScores.length - 1];

        const playersWithData = sortedPlayers.map((p, i) => {
            const denseRank = distinctScores.indexOf(p.score) + 1;
            const isTiedWinner = p.score === topScore;
            const isLastPlace = p.score === bottomScore && distinctScores.length > 1;

            return {
                ...p,
                avatar: avatars[i],
                rank: denseRank,
                displayRank: i + 1, // For display numbering
                isWinner: isTiedWinner,
                isLast: isLastPlace,
            };
        });

        // Dynamic height: Header (~260px) + rows (104px each) + footer/padding (~140px)
        const totalHeight = Math.max(850, 260 + (playersWithData.length * 104) + 140);

        return new ImageResponse(
            (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        height: '100%',
                        background: '#050510',
                        padding: '30px',
                        fontFamily: 'sans-serif',
                        alignItems: 'center',
                        justifyContent: 'center',
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
                                {game.name || 'RESULTS'}
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
                                                top: '-24px',
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
                                                {player.avatar ? (
                                                    <img src={player.avatar} width="100%" height="100%" style={{ objectFit: 'cover' }} />
                                                ) : (
                                                    <div style={{
                                                        display: 'flex',
                                                        fontSize: '28px',
                                                        fontWeight: 'bold',
                                                        color: player.isWinner ? '#facc15' : '#6366f1'
                                                    }}>
                                                        {player.name[0].toUpperCase()}
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
            ),
            {
                width: 750,
                height: totalHeight,
            }
        );

        // Note: Can't log after ImageResponse as it streams, but startTime is captured above
    } catch (e: any) {
        console.error('Error generating OG image:', e);
        return new Response(`Failed to generate image: ${e.message}`, { status: 500 });
    }
}
