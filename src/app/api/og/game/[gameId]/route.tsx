import { ImageResponse } from 'next/og';
import { getGame } from '@/lib/db';

const ROW_HEIGHT = 96;

// Font URL (Space Grotesk Bold 700) - Attempting to load again with safety
const fontUrl = 'https://fonts.gstatic.com/s/spacegrotesk/v16/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj49.woff';

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

        // 1. Fetch Resources (Fonts & Avatars)
        // Font fetching causes crashes in this env. Disabled.
        const fontPromise = Promise.resolve(null);

        const avatarPromises = sortedPlayers.map(async (p) => {
            if (!p.image) {
                console.log(`[OG] No image for player ${p.name}`);
                return null;
            }

            // Handle Data URIs directly
            if (p.image.startsWith('data:')) {
                return p.image;
            }

            try {
                // Handle Relative URLs
                let url = p.image;
                if (url.startsWith('/')) {
                    url = `${origin}${url}`;
                }

                console.log(`[OG] Fetching avatar for ${p.name}: ${url}`);

                // 2s Timeout to prevent hanging on dead URLs
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);

                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) throw new Error(`Status ${response.status}`);

                // Safety: Check image size (limit to 2MB)
                const size = response.headers.get('content-length');
                if (size && parseInt(size) > 2 * 1024 * 1024) {
                    console.warn(`[OG] Image too large for ${p.name}: ${size} bytes`);
                    return null;
                }

                const buffer = await response.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                const contentType = response.headers.get('content-type') || 'image/png';
                return `data:${contentType};base64,${base64}`;
            } catch (e: any) {
                if (e.name === 'AbortError') {
                    console.error(`[OG] Avatar fetch timed out for ${p.name}`);
                } else {
                    console.error(`[OG] Failed to fetch avatar for ${p.name}:`, e);
                }
                return null;
            }
        });

        // Wait for all resources
        const [fontData, aliases] = await Promise.all([
            fontPromise,
            Promise.all(avatarPromises)
        ]);

        const playersWithData = sortedPlayers.map((p, i) => ({
            ...p,
            avatarBase64: aliases[i],
            isWinner: i === 0,
            isLast: i === sortedPlayers.length - 1 && sortedPlayers.length > 1,
            rank: i + 1,
        }));

        // Dynamic Height Calculation to fit content
        // Header (~360px) + Padding (~100px) + Rows (N * 110px)
        const rowHeightTotal = playersWithData.length * 110;
        const height = 460 + rowHeightTotal;

        return new ImageResponse(
            (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%',
                        // Authentic Card Table Dark Theme (Deep Charcoal/Blue)
                        background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)', // Slate 900 -> Indigo 950
                        color: 'white',
                        fontFamily: fontData ? '"Space Grotesk", sans-serif' : 'sans-serif',
                        position: 'relative',
                    }}
                >
                    {/* Background Texture/Noise (Simulated with dots) */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '30px 30px', opacity: 0.5 }}></div>

                    {/* Neon Accents */}
                    <div style={{ position: 'absolute', width: 500, height: 500, background: '#6366F1', filter: 'blur(250px)', opacity: 0.15, top: -100, left: -100 }}></div>
                    <div style={{ position: 'absolute', width: 500, height: 500, background: '#EC4899', filter: 'blur(250px)', opacity: 0.15, bottom: -100, right: -100 }}></div>

                    {/* Main Container */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            width: '92%',
                            height: '92%',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 48,
                            padding: '48px 56px',
                            backgroundColor: 'rgba(15, 23, 42, 0.6)', // Glassmorphism
                            boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40, width: '100%' }}>
                            {/* SCOREJUDGE (Primary Purple, Huge) */}
                            <div style={{
                                display: 'flex',
                                fontSize: 80,
                                fontWeight: 900,
                                color: '#6366F1', // Primary Indigo
                                letterSpacing: '-0.04em',
                                lineHeight: 1,
                                textShadow: '0 0 40px rgba(99, 102, 241, 0.4)'
                            }}>
                                SCOREJUDGE
                            </div>

                            {/* Game Name (Below, Cyan) */}
                            <div style={{
                                display: 'flex',
                                fontSize: 32,
                                color: '#22d3ee', // Cyan 400
                                textTransform: 'uppercase',
                                letterSpacing: '0.25em',
                                fontWeight: 700,
                                marginTop: 16,
                                textShadow: '0 0 20px rgba(34, 211, 238, 0.4)'
                            }}>
                                {game.name || 'FRIDAY NIGHT'}
                            </div>

                            {/* 4 Suits Emblem (Standard Card Colors, Bold) */}
                            <div style={{ display: 'flex', flexDirection: 'row', gap: 40, marginTop: 24, fontSize: 48, alignItems: 'center' }}>
                                <div style={{ color: '#E2E8F0', display: 'flex', filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.3))' }}>♠</div>
                                <div style={{ color: '#EF4444', display: 'flex', filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.4))' }}>♥</div>
                                <div style={{ color: '#E2E8F0', display: 'flex', filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.3))' }}>♣</div>
                                <div style={{ color: '#EF4444', display: 'flex', filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.4))' }}>♦</div>
                            </div>
                        </div>

                        {/* Players Grid */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', flex: 1 }}>
                            {playersWithData.map((player) => (
                                <PlayerRow key={player.id} player={player} />
                            ))}
                        </div>

                    </div>
                </div>
            ),
            {
                width: 1080,
                height: height,
                fonts: fontData ? [
                    {
                        name: 'Space Grotesk',
                        data: fontData,
                        weight: 700,
                        style: 'normal',
                    },
                ] : undefined,
            }
        );
    } catch (e: any) {
        console.error('Error generating OG image:', e);
        return new Response(`Failed to generate image: ${e.message}`, { status: 500 });
    }
}

// --- Components ---

function PlayerRow({ player }: { player: any }) {
    // Winner: Gold/Yellow Gradient
    // Last: Red/Pink Gradient
    // Others: Transparent/Subtle
    let bg = 'rgba(255,255,255,0.02)';
    let border = '1px solid rgba(255,255,255,0.06)';
    let shadow = 'none';

    if (player.isWinner) {
        bg = 'linear-gradient(90deg, rgba(234, 179, 8, 0.15) 0%, rgba(234, 179, 8, 0.05) 100%)';
        border = '2px solid rgba(234, 179, 8, 0.5)';
        shadow = '0 0 30px rgba(234, 179, 8, 0.15)';
    } else if (player.isLast) {
        bg = 'linear-gradient(90deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.02) 100%)';
        border = '1px solid rgba(239, 68, 68, 0.3)';
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                height: ROW_HEIGHT,
                padding: "0 24px",
                borderRadius: 24,
                background: bg,
                border: border,
                boxShadow: shadow,
            }}
        >
            {/* Rank Badge (48px) */}
            <div style={{ display: 'flex', width: 48, justifyContent: 'center' }}>
                <RankBadge player={player} />
            </div>

            {/* Avatar (88px) */}
            <div style={{ display: 'flex', width: 88, justifyContent: 'center' }}>
                <AvatarWithCrown player={player} />
            </div>

            {/* Name (Flex 1) */}
            <div style={{ display: 'flex', flex: 1, paddingLeft: 16, overflow: 'hidden' }}>
                <NameBlock player={player} />
            </div>

            {/* Score (110px) */}
            <div style={{ display: 'flex', width: 110, justifyContent: 'flex-end' }}>
                <Score value={player.score} highlight={player.isWinner} />
            </div>
        </div>
    );
}

function RankBadge({ player }: { player: any }) {
    const style = { fontSize: 36, display: 'flex' };
    // Double Rainbow Logic: Rainbow here, Rainbow next to name
    if (player.isLast && !player.isWinner) return <div style={style}>🌈</div>;

    if (player.rank === 1) return <div style={style}>🥇</div>;
    if (player.rank === 2) return <div style={style}>🥈</div>;
    if (player.rank === 3) return <div style={style}>🥉</div>;
    return <div style={{ fontSize: 32, opacity: 0.5, color: '#94A3B8', fontWeight: 800, display: 'flex' }}>{player.rank}</div>;
}

function AvatarWithCrown({ player }: { player: any }) {
    return (
        <div
            style={{
                position: "relative",
                width: 64,
                height: 64,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            {player.isWinner && (
                <div
                    style={{
                        position: "absolute",
                        top: -20, // Higher up
                        fontSize: 32,
                        zIndex: 10,
                        display: 'flex',
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
                    }}
                >
                    👑
                </div>
            )}

            <AvatarImage player={player} />
        </div>
    );
}

function AvatarImage({ player }: { player: any }) {
    // Ring Logic
    // Winner: Gold
    // Last: Rainbow or Red? Let's go with Red/Pink for Last to match row
    // Others: Indigo (Primary)
    let gradient = 'linear-gradient(135deg, #6366F1 0%, #4338ca 100%)';
    if (player.isWinner) gradient = 'linear-gradient(135deg, #FACC15 0%, #EAB308 100%)'; // Yellow 400->500
    else if (player.isLast) gradient = 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)'; // Red

    return (
        <div style={{
            display: 'flex',
            width: 64,
            height: 64,
            borderRadius: '50%',
            padding: 3,
            background: gradient,
            overflow: 'hidden',
            boxShadow: player.isWinner ? '0 0 15px rgba(234, 179, 8, 0.4)' : 'none'
        }}>
            <div style={{
                display: 'flex',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                overflow: 'hidden',
                backgroundColor: '#0F172A',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                {player.avatarBase64 ? (
                    <img
                        src={player.avatarBase64}
                        width="100%"
                        height="100%"
                        style={{ objectFit: 'cover' }}
                    />
                ) : (
                    <div style={{ fontSize: 28, marginTop: 4, display: 'flex' }}>
                        👤
                    </div>
                )}
            </div>
        </div>
    );
}

function NameBlock({ player }: { player: any }) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: 28,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
            }}
        >
            <div style={{
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                color: player.isWinner ? '#Fef3c7' : '#F1F5F9',
                display: 'flex',
            }}>{player.name}</div>

            {player.isLast && !player.isWinner && (
                <div style={{ fontSize: 24, display: 'flex' }}>🌈</div>
            )}
        </div>
    );
}

function Score({ value, highlight }: { value: number, highlight: boolean }) {
    return (
        <div
            style={{
                display: 'flex',
                textAlign: "right",
                fontSize: 44,
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
                color: highlight ? "#FACC15" : "#FFFFFF",
                textShadow: highlight
                    ? "0 0 20px rgba(234, 179, 8, 0.5)"
                    : "none",
            }}
        >
            {value}
        </div>
    );
}
