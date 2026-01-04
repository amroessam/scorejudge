import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const gameName = searchParams.get('name')?.slice(0, 100).toUpperCase() || 'GAME';

        let players: any[] = [];
        try {
            const playersParam = searchParams.get('players');
            if (playersParam) {
                players = JSON.parse(playersParam);
            }
        } catch (e) {
            console.error('Failed to parse players', e);
        }

        const sortedPlayers = players.sort((a: any, b: any) => b.score - a.score);
        // Limit to top 10 for Stories layout
        const displayPlayers = sortedPlayers.slice(0, 10);

        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        backgroundColor: '#050806', // Gold Standard: Dark Green/Black
                        backgroundImage: 'radial-gradient(circle at 50% 0%, #1f2e26, #050806)', // Poker Table Spotlight
                        fontFamily: 'sans-serif',
                        color: 'white',
                        position: 'relative',
                    }}
                >
                    {/* Background Watermarks */}
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        opacity: 0.05,
                        zIndex: 0,
                    }}>
                        <div style={{ display: 'flex', position: 'absolute', top: 100, left: 100, fontSize: 400, transform: 'rotate(-20deg)' }}>♠️</div>
                        <div style={{ display: 'flex', position: 'absolute', top: 500, right: 50, fontSize: 350, transform: 'rotate(15deg)' }}>♥️</div>
                        <div style={{ display: 'flex', position: 'absolute', bottom: 400, left: 50, fontSize: 380, transform: 'rotate(-10deg)' }}>♣️</div>
                        <div style={{ display: 'flex', position: 'absolute', bottom: 100, right: 100, fontSize: 420, transform: 'rotate(25deg)' }}>♦️</div>
                    </div>

                    {/* Main Content Container */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: '100%',
                        height: '100%',
                        padding: '100px 60px',
                        zIndex: 1,
                    }}>
                        {/* Header Section */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            marginBottom: 80,
                        }}>
                            <div style={{
                                display: 'flex',
                                fontSize: 100,
                                fontWeight: 900,
                                color: '#fbbf24', // Gold
                                textTransform: 'uppercase',
                                marginBottom: 20,
                                letterSpacing: '6px',
                            }}>
                                SCOREJUDGE
                            </div>
                            <div style={{
                                display: 'flex',
                                fontSize: 40,
                                color: '#d4d4d8', // Zinc 300
                                textTransform: 'uppercase',
                                letterSpacing: '8px',
                                fontWeight: 'bold',
                            }}>
                                {gameName}
                            </div>
                        </div>

                        {/* Player Rows */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '30px',
                            width: '100%',
                            alignItems: 'center'
                        }}>
                            {displayPlayers.map((player: any, index: number) => {
                                const isFirst = index === 0;
                                const isSecond = index === 1;
                                const isThird = index === 2;
                                const isLast = index === sortedPlayers.length - 1 && sortedPlayers.length > 1;

                                // Rank Skin
                                let bg = '#18181b'; // Zinc 950
                                let border = '1px solid #3f3f46'; // Zinc 700
                                let textColor = 'white';
                                let scoreColor = '#d4d4d8';
                                let rankIcon = null;

                                if (isFirst) {
                                    bg = '#422006'; // Gold/Brown
                                    border = '3px solid #ca8a04';
                                    textColor = '#fef08a';
                                    scoreColor = '#fbbf24';
                                    rankIcon = <span style={{ display: 'flex', fontSize: 60 }}>👑</span>;
                                } else if (isSecond) {
                                    rankIcon = <span style={{ display: 'flex', fontSize: 50 }}>🥈</span>;
                                } else if (isThird) {
                                    rankIcon = <span style={{ display: 'flex', fontSize: 50 }}>🥉</span>;
                                } else if (isLast) {
                                    bg = '#450a0a'; // Muted Red
                                    border = '1px solid #991b1b';
                                    rankIcon = <span style={{ display: 'flex', fontSize: 50 }}>🏳️‍🌈</span>;
                                } else {
                                    rankIcon = <span style={{ display: 'flex', fontSize: 45, fontWeight: 'bold', color: '#71717a' }}>{index + 1}</span>;
                                }

                                const initials = player.name ? player.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : '??';

                                return (
                                    <div key={index} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        width: '100%',
                                        padding: '30px 50px',
                                        borderRadius: '30px',
                                        background: bg,
                                        border: border,
                                        height: '140px',
                                    }}>
                                        {/* Rank Column */}
                                        <div style={{ display: 'flex', width: 80, justifyContent: 'center', marginRight: 40 }}>
                                            {rankIcon}
                                        </div>

                                        {/* Avatar Column */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: 80,
                                            height: 80,
                                            borderRadius: '50%',
                                            backgroundColor: '#27272a',
                                            border: '2px solid #52525b',
                                            marginRight: 40,
                                        }}>
                                            <span style={{ display: 'flex', fontSize: 32, fontWeight: 'bold', color: '#a1a1aa' }}>{initials}</span>
                                        </div>

                                        {/* Name Column */}
                                        <div style={{
                                            display: 'flex',
                                            fontSize: 45,
                                            fontWeight: 'bold',
                                            color: textColor,
                                            flexGrow: 1,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                        }}>
                                            {player.name}
                                        </div>

                                        {/* Score Column */}
                                        <div style={{
                                            display: 'flex',
                                            fontSize: 65,
                                            fontWeight: 900,
                                            color: scoreColor,
                                            marginLeft: 30
                                        }}>
                                            {player.score}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer Section */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            marginTop: 'auto',
                            paddingTop: 100,
                        }}>
                            <div style={{ display: 'flex', fontSize: 30, letterSpacing: '4px', color: '#71717a', marginBottom: 10 }}>PLAYED ON</div>
                            <div style={{ display: 'flex', fontSize: 40, fontWeight: 900, letterSpacing: '8px', color: 'white' }}>SCOREJUDGE.APP</div>
                        </div>
                    </div>
                </div>
            ),
            {
                width: 1080,
                height: 1920,
            },
        );
    } catch (e: any) {
        console.error('OG Gen Error:', e);
        return new Response('Failed to generate image', { status: 500 });
    }
}
