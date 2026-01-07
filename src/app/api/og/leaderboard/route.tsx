import { ImageResponse } from 'next/og';
import { getGlobalLeaderboard } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
    try {
        const leaderboard = await getGlobalLeaderboard();
        const topPlayers = leaderboard.slice(0, 10);

        // Gaming card aspect ratio (similar to trading card 2.5:3.5)
        const width = 500;
        const rowHeight = 36;
        const headerHeight = 70;
        const tableHeaderHeight = 28;
        const padding = 24;
        const height = headerHeight + tableHeaderHeight + (topPlayers.length * rowHeight) + padding * 2;

        return new ImageResponse(
            (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(145deg, #0f0f23 0%, #1a1a3e 50%, #0d0d1f 100%)',
                        padding: `${padding}px`,
                        fontFamily: 'sans-serif',
                    }}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', fontSize: '22px', fontWeight: 'bold', color: '#a78bfa', letterSpacing: '2px' }}>
                            SCOREJUDGE LEADERBOARD
                        </div>
                    </div>

                    {/* Table Header */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '6px 12px',
                        background: 'rgba(99,102,241,0.2)',
                        borderRadius: '6px',
                        marginBottom: '6px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                    }}>
                        <div style={{ display: 'flex', width: '28px', justifyContent: 'center' }}>#</div>
                        <div style={{ display: 'flex', flex: 1, marginLeft: '8px' }}>Player</div>
                        <div style={{ display: 'flex', width: '32px', justifyContent: 'center' }}>G</div>
                        <div style={{ display: 'flex', width: '32px', justifyContent: 'center' }}>W</div>
                        <div style={{ display: 'flex', width: '36px', justifyContent: 'center' }}>%</div>
                        <div style={{ display: 'flex', width: '28px', justifyContent: 'center' }}>🌈</div>
                    </div>

                    {/* Table Rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {topPlayers.map((player, index) => (
                            <div
                                key={player.email}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '6px 12px',
                                    height: `${rowHeight}px`,
                                    background: index === 0
                                        ? 'rgba(234,179,8,0.18)'
                                        : index === 1
                                            ? 'rgba(156,163,175,0.12)'
                                            : index === 2
                                                ? 'rgba(234,88,12,0.12)'
                                                : 'rgba(255,255,255,0.03)',
                                    borderRadius: '6px',
                                    borderLeft: index < 3 ? `3px solid ${index === 0 ? '#facc15' : index === 1 ? '#9ca3af' : '#ea580c'}` : 'none',
                                }}
                            >
                                {/* Rank */}
                                <div style={{ display: 'flex', width: '28px', justifyContent: 'center', fontSize: '14px' }}>
                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' :
                                        <div style={{ display: 'flex', color: '#64748b', fontWeight: 'bold', fontSize: '12px' }}>{index + 1}</div>}
                                </div>

                                {/* Name */}
                                <div style={{ display: 'flex', flex: 1, marginLeft: '8px', fontSize: '14px', fontWeight: '600', color: index === 0 ? '#facc15' : '#f1f5f9', alignItems: 'center' }}>
                                    {index === 0 && <div style={{ display: 'flex', marginRight: '4px', fontSize: '12px' }}>👑</div>}
                                    {player.name}
                                </div>

                                {/* Games */}
                                <div style={{ display: 'flex', width: '32px', justifyContent: 'center', fontSize: '12px', color: '#94a3b8' }}>
                                    {player.gamesPlayed}
                                </div>

                                {/* Wins */}
                                <div style={{ display: 'flex', width: '32px', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: '#22d3ee' }}>
                                    {player.wins}
                                </div>

                                {/* Win % */}
                                <div style={{ display: 'flex', width: '36px', justifyContent: 'center', fontSize: '12px', color: '#a3e635' }}>
                                    {player.winRate}%
                                </div>

                                {/* 🌈 */}
                                <div style={{ display: 'flex', width: '28px', justifyContent: 'center', fontSize: '12px', color: '#ec4899', fontWeight: 'bold' }}>
                                    {player.lastPlaceCount}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ),
            {
                width: width,
                height: height,
            }
        );
    } catch (e: any) {
        console.error('Error generating leaderboard image:', e);
        return new Response(`Failed to generate image: ${e.message}`, { status: 500 });
    }
}
