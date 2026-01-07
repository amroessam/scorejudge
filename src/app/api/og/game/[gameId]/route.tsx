import { ImageResponse } from 'next/og';
import { getGame } from '@/lib/db';

// Force Node.js runtime for production stability
export const runtime = 'nodejs';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ gameId: string }> }
) {
    try {
        const { gameId } = await params;
        const game = await getGame(gameId);

        if (!game) {
            return new Response('Game not found', { status: 404 });
        }

        const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score).slice(0, 20);
        const origin = new URL(request.url).origin;

        // Fetch avatars with timeout
        const avatarPromises = sortedPlayers.map(async (p) => {
            if (!p.image) return null;

            // Use data URIs directly
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

        // Dynamic height: Header (280px) + rows (90px each) + padding (80px)
        const height = 280 + (playersWithData.length * 90) + 80;

        return new ImageResponse(
            (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0d0d1f 100%)',
                        padding: '40px',
                        fontFamily: 'sans-serif',
                    }}
                >
                    {/* Neon glow effects */}
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)', display: 'flex' }} />
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(236,72,153,0.3) 0%, transparent 70%)', display: 'flex' }} />

                    {/* Main card container */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            width: '100%',
                            height: '100%',
                            background: 'linear-gradient(180deg, rgba(30,30,60,0.9) 0%, rgba(20,20,40,0.95) 100%)',
                            borderRadius: '32px',
                            border: '2px solid rgba(99,102,241,0.4)',
                            boxShadow: '0 0 60px rgba(99,102,241,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
                            padding: '32px 40px',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', fontSize: '56px', fontWeight: 'bold', color: '#6366f1', letterSpacing: '-2px', textShadow: '0 0 40px rgba(99,102,241,0.6)' }}>
                                SCOREJUDGE
                            </div>
                            <div style={{ display: 'flex', fontSize: '22px', color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '4px', marginTop: '8px', textShadow: '0 0 20px rgba(34,211,238,0.5)' }}>
                                {game.name || 'Game Results'}
                            </div>
                            {/* Card suits */}
                            <div style={{ display: 'flex', gap: '24px', marginTop: '16px', fontSize: '28px' }}>
                                <div style={{ display: 'flex', color: '#e2e8f0', filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.3))' }}>♠</div>
                                <div style={{ display: 'flex', color: '#ef4444', filter: 'drop-shadow(0 0 8px rgba(239,68,68,0.5))' }}>♥</div>
                                <div style={{ display: 'flex', color: '#e2e8f0', filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.3))' }}>♣</div>
                                <div style={{ display: 'flex', color: '#ef4444', filter: 'drop-shadow(0 0 8px rgba(239,68,68,0.5))' }}>♦</div>
                            </div>
                        </div>

                        {/* Players list */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                            {playersWithData.map((player) => (
                                <div
                                    key={player.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '12px 20px',
                                        background: player.isWinner
                                            ? 'linear-gradient(90deg, rgba(234,179,8,0.2) 0%, rgba(234,179,8,0.05) 100%)'
                                            : player.isLast
                                                ? 'linear-gradient(90deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.03) 100%)'
                                                : 'rgba(255,255,255,0.03)',
                                        borderRadius: '16px',
                                        border: player.isWinner
                                            ? '2px solid rgba(234,179,8,0.5)'
                                            : player.isLast
                                                ? '1px solid rgba(239,68,68,0.3)'
                                                : '1px solid rgba(255,255,255,0.08)',
                                        boxShadow: player.isWinner ? '0 0 30px rgba(234,179,8,0.15)' : 'none',
                                    }}
                                >
                                    {/* Rank */}
                                    <div style={{ display: 'flex', width: '50px', justifyContent: 'center', fontSize: '28px' }}>
                                        {player.isLast && !player.isWinner ? '🌈' :
                                            player.rank === 1 ? '🥇' :
                                                player.rank === 2 ? '🥈' :
                                                    player.rank === 3 ? '🥉' :
                                                        <div style={{ display: 'flex', fontSize: '20px', color: '#64748b', fontWeight: 'bold' }}>{player.rank}</div>}
                                    </div>

                                    {/* Avatar */}
                                    <div style={{ display: 'flex', marginLeft: '12px' }}>
                                        <div
                                            style={{
                                                display: 'flex',
                                                width: '52px',
                                                height: '52px',
                                                borderRadius: '50%',
                                                background: player.isWinner
                                                    ? 'linear-gradient(135deg, #facc15 0%, #eab308 100%)'
                                                    : player.isLast
                                                        ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
                                                        : 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                                                padding: '3px',
                                                boxShadow: player.isWinner ? '0 0 15px rgba(234,179,8,0.4)' : 'none',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    width: '100%',
                                                    height: '100%',
                                                    borderRadius: '50%',
                                                    background: '#1a1a3e',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                {player.avatar ? (
                                                    <img src={player.avatar} width="100%" height="100%" style={{ objectFit: 'cover' }} />
                                                ) : (
                                                    <div style={{ display: 'flex', fontSize: '22px' }}>👤</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Name + crown/rainbow */}
                                    <div style={{ display: 'flex', flex: 1, marginLeft: '16px', alignItems: 'center', gap: '8px' }}>
                                        {player.isWinner && <div style={{ display: 'flex', fontSize: '20px' }}>👑</div>}
                                        <div style={{
                                            display: 'flex',
                                            fontSize: '20px',
                                            fontWeight: '600',
                                            color: player.isWinner ? '#fef3c7' : '#f1f5f9',
                                            textShadow: player.isWinner ? '0 0 10px rgba(234,179,8,0.3)' : 'none',
                                        }}>
                                            {player.name}
                                        </div>
                                        {player.isLast && !player.isWinner && <div style={{ display: 'flex', fontSize: '18px' }}>🌈</div>}
                                    </div>

                                    {/* Score */}
                                    <div style={{
                                        display: 'flex',
                                        fontSize: '32px',
                                        fontWeight: 'bold',
                                        color: player.isWinner ? '#facc15' : player.isLast ? '#ec4899' : '#ffffff',
                                        textShadow: player.isWinner ? '0 0 20px rgba(234,179,8,0.5)' : player.isLast ? '0 0 15px rgba(236,72,153,0.4)' : 'none',
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
                width: 800,
                height: height,
            }
        );
    } catch (e: any) {
        console.error('Error generating OG image:', e);
        return new Response(`Failed to generate image: ${e.message}`, { status: 500 });
    }
}
