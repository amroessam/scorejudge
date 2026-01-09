import { ImageResponse } from 'next/og';
import { getGlobalLeaderboard } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
    try {
        const leaderboard = await getGlobalLeaderboard();
        const topPlayers = leaderboard.slice(0, 10);
        const origin = new URL(request.url).origin;

        // 1. Avatar fetching logic (shared with game scorecard)
        const avatarPromises = topPlayers.map(async (p) => {
            if (!p.image) return null;
            if (p.image.startsWith('data:')) return p.image;

            try {
                let url = p.image;
                if (url.startsWith('/')) url = `${origin}${url}`;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);

                const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
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

        // Dynamic height calculation
        const rowHeight = 104;
        const totalHeight = Math.max(850, 260 + (topPlayers.length * rowHeight) + 140);

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
                                GLOBAL LEADERBOARD
                            </div>

                            {/* Suit Symbols Row */}
                            <div style={{ display: 'flex', gap: '20px', marginTop: '16px', fontSize: '24px', opacity: 0.8 }}>
                                <div style={{ display: 'flex', color: '#4466ff' }}>♠</div>
                                <div style={{ display: 'flex', color: '#ff4466' }}>♥</div>
                                <div style={{ display: 'flex', color: '#44ff66' }}>♣</div>
                                <div style={{ display: 'flex', color: '#ffaa44' }}>♦</div>
                            </div>
                        </div>

                        {/* Table Header */}
                        <div style={{
                            display: 'flex',
                            width: '100%',
                            maxWidth: '680px',
                            padding: '0 24px 8px 24px',
                            borderBottom: '1px solid rgba(255,255,255,0.1)',
                            marginBottom: '8px',
                        }}>
                            <div style={{ display: 'flex', width: '50px', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', color: '#64748b', letterSpacing: '1px' }}>RANK</div>
                            <div style={{ display: 'flex', marginLeft: '86px', flex: 1, fontSize: '10px', fontWeight: 'bold', color: '#64748b', letterSpacing: '1px' }}>PLAYER</div>
                            <div style={{ display: 'flex', width: '50px', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', color: '#64748b', letterSpacing: '1px' }}>G</div>
                            <div style={{ display: 'flex', width: '50px', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', color: '#64748b', letterSpacing: '1px' }}>W</div>
                            <div style={{ display: 'flex', width: '55px', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', color: '#64748b', letterSpacing: '1px' }}>%</div>
                            <div style={{ display: 'flex', width: '40px', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', color: '#64748b', letterSpacing: '1px' }}>🌈</div>
                        </div>

                        {/* Players list */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '680px' }}>
                            {topPlayers.map((player, i) => (
                                <div
                                    key={player.email}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '12px 24px',
                                        background: i === 0
                                            ? 'linear-gradient(90deg, rgba(234,179,8,0.1) 0%, rgba(234,179,8,0.02) 100%)'
                                            : 'rgba(255,255,255,0.02)',
                                        borderRadius: '20px',
                                        border: i === 0
                                            ? '1.5px solid rgba(234,179,8,0.5)'
                                            : '1px solid rgba(255,255,255,0.05)',
                                    }}
                                >
                                    {/* Rank */}
                                    <div style={{ display: 'flex', width: '50px', justifyContent: 'center', alignItems: 'center' }}>
                                        {i === 0 ? (
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ display: 'flex' }}>
                                                <path d="M12 15C15.3137 15 18 12.3137 18 9V2H6V9C6 12.3137 8.68629 15 12 15Z" fill="#fbbf24" opacity="0.9" />
                                                <path d="M12 15V22M7 22H17M6 4H4C2.89543 4 2 4.89543 2 6V7C2 9.20914 3.79086 11 6 11M18 4H20C21.1046 4 22 4.89543 22 6V7C22 9.20914 20.2091 11 18 11" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
                                            </svg>
                                        ) : i === 1 ? (
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ display: 'flex' }}>
                                                <path d="M12 15C15.3137 15 18 12.3137 18 9V2H6V9C6 12.3137 8.68629 15 12 15Z" fill="#cbd5e1" opacity="0.9" />
                                                <path d="M12 15V22M7 22H17M6 4H4C2.89543 4 2 4.89543 2 6V7C2 9.20914 3.79086 11 6 11M18 4H20C21.1046 4 22 4.89543 22 6V7C22 9.20914 20.2091 11 18 11" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                                            </svg>
                                        ) : i === 2 ? (
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ display: 'flex' }}>
                                                <path d="M12 15C15.3137 15 18 12.3137 18 9V2H6V9C6 12.3137 8.68629 15 12 15Z" fill="#b45309" opacity="0.9" />
                                                <path d="M12 15V22M7 22H17M6 4H4C2.89543 4 2 4.89543 2 6V7C2 9.20914 3.79086 11 6 11M18 4H20C21.1046 4 22 4.89543 22 6V7C22 9.20914 20.2091 11 18 11" stroke="#b45309" strokeWidth="2" strokeLinecap="round" />
                                            </svg>
                                        ) : (
                                            <div style={{ display: 'flex', fontSize: '16px', color: '#64748b', fontWeight: 'bold' }}>{i + 1}</div>
                                        )}
                                    </div>

                                    {/* Avatar */}
                                    <div style={{ display: 'flex', marginLeft: '12px', position: 'relative' }}>
                                        {i === 0 && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '-20px',
                                                left: '10px',
                                                fontSize: '36px',
                                                zIndex: 10,
                                            }}>👑</div>
                                        )}
                                        <div
                                            style={{
                                                display: 'flex',
                                                width: '60px',
                                                height: '60px',
                                                borderRadius: '50%',
                                                background: i === 0 ? '#eab308' : 'rgba(255,255,255,0.1)',
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
                                                {avatars[i] ? (
                                                    <img src={avatars[i]!} width="100%" height="100%" style={{ objectFit: 'cover' }} />
                                                ) : (
                                                    <div style={{
                                                        display: 'flex',
                                                        fontSize: '24px',
                                                        fontWeight: 'bold',
                                                        color: i === 0 ? '#facc15' : '#6366f1'
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
                                        flexDirection: 'column',
                                        flex: 1,
                                        marginLeft: '14px',
                                        justifyContent: 'center',
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            fontSize: '20px',
                                            fontWeight: '600',
                                            color: i === 0 ? '#fef3c7' : '#ffffff',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            alignItems: 'center',
                                        }}>
                                            {player.name}
                                            {i === topPlayers.length - 1 && i > 0 && <span style={{ marginLeft: '8px', fontSize: '16px', opacity: 0.9 }}>🌈</span>}
                                        </div>
                                    </div>

                                    {/* Stats (Table Style) */}
                                    <div style={{ display: 'flex', width: '50px', justifyContent: 'center', fontSize: '18px', color: '#94a3b8', fontWeight: '500' }}>
                                        {player.gamesPlayed}
                                    </div>
                                    <div style={{ display: 'flex', width: '50px', justifyContent: 'center', fontSize: '18px', color: '#22d3ee', fontWeight: 'bold' }}>
                                        {player.wins}
                                    </div>
                                    <div style={{ display: 'flex', width: '55px', justifyContent: 'center', fontSize: '18px', color: '#a3e635', fontWeight: '600' }}>
                                        {player.winRate}%
                                    </div>
                                    <div style={{ display: 'flex', width: '40px', justifyContent: 'center', fontSize: '18px', color: '#ec4899', fontWeight: 'bold' }}>
                                        {player.lastPlaceCount > 0 ? player.lastPlaceCount : '-'}
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
                headers: {
                    'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
                },
            }
        );
    } catch (e: any) {
        console.error('Error generating leaderboard image:', e);
        return new Response(`Failed to generate image: ${e.message}`, { status: 500 });
    }
}
