import { ImageResponse } from 'next/og';
import { getGame } from '@/lib/db';

// Force Node.js runtime instead of Edge (more compatible)
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

        const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score).slice(0, 10);

        // Calculate height based on player count
        const height = 400 + (sortedPlayers.length * 80);

        return new ImageResponse(
            (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                        padding: '40px',
                        color: 'white',
                        fontFamily: 'sans-serif',
                    }}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '30px' }}>
                        <div style={{ display: 'flex', fontSize: '48px', fontWeight: 'bold', color: '#6366f1' }}>
                            SCOREJUDGE
                        </div>
                        <div style={{ display: 'flex', fontSize: '24px', color: '#22d3ee', marginTop: '10px' }}>
                            {game.name || 'Game Results'}
                        </div>
                    </div>

                    {/* Players List */}
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '12px' }}>
                        {sortedPlayers.map((player, index) => (
                            <div
                                key={player.id}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '16px 24px',
                                    background: index === 0
                                        ? 'linear-gradient(90deg, rgba(234,179,8,0.2) 0%, rgba(234,179,8,0.05) 100%)'
                                        : 'rgba(255,255,255,0.05)',
                                    borderRadius: '12px',
                                    border: index === 0 ? '2px solid rgba(234,179,8,0.5)' : '1px solid rgba(255,255,255,0.1)',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ display: 'flex', fontSize: '24px' }}>
                                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                                    </div>
                                    <div style={{ display: 'flex', fontSize: '20px', fontWeight: '600' }}>
                                        {player.name}
                                    </div>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    fontSize: '28px',
                                    fontWeight: 'bold',
                                    color: index === 0 ? '#facc15' : 'white'
                                }}>
                                    {player.score}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ),
            {
                width: 600,
                height: height,
            }
        );
    } catch (e: any) {
        console.error('Error generating OG image:', e);
        return new Response(`Failed to generate image: ${e.message}`, { status: 500 });
    }
}
