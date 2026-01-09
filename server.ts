import 'dotenv/config';
import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import { getGame, type GameState } from './src/lib/store';
import { getGame as getDbGame, purgeStaleGames } from './src/lib/db';
import { getToken } from 'next-auth/jwt';
import { IncomingMessage } from 'http';
import { runMigrations } from './src/lib/db-admin';

// We need a way to share state between Next.js API routes and this custom server process.
// Since they run in the same process in dev/prod (usually), the `store.ts` *should* be shared memory.
// However, in dev mode, Next.js compiles pages separately.
// For a robust implementation, usually Redis is needed.
// Given "No DB", we assume memory is sufficient for single-instance deployment.

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
    // Run migrations before starting the server
    await runMigrations();

    // Check for SSL certificates
    const certDir = path.join(process.cwd(), 'certificates');
    const keyPath = path.join(certDir, 'key.pem');
    const certPath = path.join(certDir, 'cert.pem');
    const useHttps = existsSync(keyPath) && existsSync(certPath);

    const requestHandler = async (req: IncomingMessage, res: any) => {
        try {
            const parsedUrl = parse(req.url!, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    };

    const server = useHttps
        ? createHttpsServer({
            key: readFileSync(keyPath),
            cert: readFileSync(certPath)
        }, requestHandler)
        : createServer(requestHandler);

    const wss = new WebSocketServer({ noServer: true });

    // Helper function to get token with proper cookie name handling (similar to auth-utils)
    async function getWebSocketToken(req: IncomingMessage) {
        const cookieHeader = req.headers.cookie;
        if (!cookieHeader) return null;

        // Parse cookies manually
        const cookies: Record<string, string> = {};
        cookieHeader.split(';').forEach(cookie => {
            const [name, ...valueParts] = cookie.trim().split('=');
            if (name && valueParts.length > 0) {
                cookies[name.trim()] = decodeURIComponent(valueParts.join('=').trim());
            }
        });

        // Create a mock request object that matches Next.js Request structure
        const mockReq = {
            headers: {
                cookie: cookieHeader,
                host: req.headers.host || 'localhost:3000',
            },
            cookies: {
                get: (name: string) => {
                    const value = cookies[name];
                    return value ? { name, value } : undefined;
                },
                getAll: () => Object.entries(cookies).map(([name, value]) => ({ name, value })),
            },
            url: req.url || '',
        } as any;

        const isProduction = process.env.NODE_ENV === 'production';

        // Try production cookie name first if in production
        if (isProduction) {
            try {
                const token = await getToken({
                    req: mockReq,
                    secret: process.env.NEXTAUTH_SECRET,
                    cookieName: '__Secure-next-auth.session-token'
                });
                if (token) return token;
            } catch (e) {
                // Fall through to try standard cookie name
            }
        }

        // Try standard cookie name
        try {
            const token = await getToken({
                req: mockReq,
                secret: process.env.NEXTAUTH_SECRET,
                cookieName: 'next-auth.session-token'
            });
            return token;
        } catch (e) {
            console.error('Error getting WebSocket token:', e);
            return null;
        }
    }

    async function findGame(gameId: string): Promise<GameState | null> {
        return getGame(gameId) || await getDbGame(gameId);
    }

    // Helper function to validate WebSocket authentication
    async function validateWebSocketAuth(req: IncomingMessage, gameId: string): Promise<{ valid: boolean; email?: string; error?: string }> {
        try {
            // Get token using the helper that tries both cookie names
            const token = await getWebSocketToken(req);

            if (!token) {
                console.error('WebSocket auth: No token found. Available cookies:', req.headers.cookie?.split(';').map(c => c.split('=')[0]));
                return { valid: false, error: 'Invalid or missing session token' };
            }

            if (!token.email) {
                console.error('WebSocket auth: Token missing email field. Token keys:', Object.keys(token));
                return { valid: false, error: 'Invalid or missing session token' };
            }

            // For discovery channel, only validate authentication (no game check needed)
            if (gameId === 'discovery') {
                return { valid: true, email: token.email as string };
            }

            const game = await findGame(gameId);

            if (!game) {
                console.error(`[WebSocket auth] Game ${gameId} not found`);
                return { valid: false, error: 'Game not found' };
            }

            console.log(`[WebSocket auth] Found game ${gameId}, validating player membership`);

            // Check if user is a player in the game OR is the owner
            // Owner should be able to connect even if not explicitly in players list (edge case)
            const isPlayer = game.players.some((p: any) => p.email === token.email);
            const isOwner = game.ownerEmail === token.email;

            if (!isPlayer && !isOwner) {
                console.error(`WebSocket auth: User ${token.email} is not a player or owner. Players:`, game.players.map((p: any) => p.email), 'Owner:', game.ownerEmail);
                return { valid: false, error: 'User is not a player in this game' };
            }

            return { valid: true, email: token.email as string };
        } catch (error: any) {
            console.error('WebSocket auth validation error:', error);
            return { valid: false, error: 'Authentication failed' };
        }
    }

    // Client tracking
    const clients = new Map<WebSocket, { gameId: string; email: string }>(); // ws -> {gameId, email}
    const discoveryClients = new Set<WebSocket>(); // Clients listening for discovery updates

    wss.on('connection', async (ws, req) => {
        const { query } = parse(req.url || '', true);
        const gameId = query.gameId as string;
        const channel = query.channel as string; // 'discovery' for discovery channel

        // Handle discovery channel
        if (channel === 'discovery') {
            // Validate authentication
            const authResult = await validateWebSocketAuth(req, 'discovery');
            if (!authResult.valid) {
                ws.send(JSON.stringify({ type: 'ERROR', message: authResult.error || 'Authentication failed' }));
                ws.close(1008, authResult.error || 'Authentication failed');
                return;
            }

            console.log(`Discovery client connected (user: ${authResult.email})`);
            discoveryClients.add(ws);

            ws.on('close', () => {
                discoveryClients.delete(ws);
            });

            ws.on('message', (message) => {
                console.log('Discovery client message:', message.toString());
            });

            return; // Don't process as game connection
        }

        if (!gameId) {
            ws.close(1008, 'Missing gameId');
            return;
        }

        // Validate authentication
        const authResult = await validateWebSocketAuth(req, gameId);
        if (!authResult.valid) {
            ws.send(JSON.stringify({ type: 'ERROR', message: authResult.error || 'Authentication failed' }));
            ws.close(1008, authResult.error || 'Authentication failed');
            return;
        }

        console.log(`Client connected to game ${gameId} (user: ${authResult.email})`);

        clients.set(ws, { gameId, email: authResult.email! });

        // Send current state
        const state = await findGame(gameId);

        if (state) {
            ws.send(JSON.stringify({ type: 'GAME_UPDATE', state }));
        } else {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Game not loaded in memory. Visit page to load.' }));
        }

        ws.on('message', (message) => {
            console.log('Received:', message.toString());
            // Handle incoming messages if any (e.g. ping)
        });

        ws.on('close', () => {
            clients.delete(ws);
        });
    });

    // We need a mechanism to broadcast updates from API routes to WS.
    // We can expose a global broadcast function or use an event emitter.
    // Since `server.ts` is the entry point, we can attach to `global`

    (global as any).broadcastGameUpdate = (gameId: string, state: GameState) => {
        let latestState = getGame(gameId) || state;
        const message = JSON.stringify({ type: 'GAME_UPDATE', state: latestState });
        let sentCount = 0;

        console.log(`[Broadcast] Broadcasting update for gameId=${gameId}, connectedClients=${clients.size}`);

        for (const [client, clientInfo] of clients.entries()) {
            if (client.readyState !== WebSocket.OPEN) continue;

            if (clientInfo.gameId === gameId) {
                try {
                    client.send(message);
                    sentCount++;
                } catch (e) {
                    console.error(`[Broadcast] Error sending to client ${clientInfo.email}:`, e);
                }
            }
        }
    };

    // Broadcast discovery updates (new games, game updates that affect discoverability)
    (global as any).broadcastDiscoveryUpdate = (updateType: 'GAME_CREATED' | 'GAME_UPDATED' | 'GAME_DELETED', game: GameState) => {
        const message = JSON.stringify({
            type: 'DISCOVERY_UPDATE',
            updateType,
            game: {
                id: game.id,
                name: game.name,
                ownerEmail: game.ownerEmail,
                playerCount: game.players?.length || 0,
                currentRoundIndex: game.currentRoundIndex,
            }
        });

        let sentCount = 0;
        for (const client of discoveryClients) {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(message);
                    sentCount++;
                } catch (e) {
                    console.error(`[Discovery Broadcast] Error sending to client:`, e);
                }
            }
        }
        console.log(`[Discovery Broadcast] Sent ${updateType} update to ${sentCount} clients`);
    };

    server.on('upgrade', (req, socket, head) => {
        const { pathname } = parse(req.url || '', true);
        if (pathname === '/ws') {
            wss.handleUpgrade(req, socket, head, (ws) => {
                wss.emit('connection', ws, req);
            });
        }
    });

    server.listen(port, () => {
        const protocol = useHttps ? 'https' : 'http';
        console.log(`> Ready on ${protocol}://${hostname}:${port}`);

        // Set up maintenance interval (run every hour)
        // This will purge stale incomplete games (lobby/ongoing) older than 6 hours
        // We run once immediately on startup and then every hour
        purgeStaleGames().catch(err => console.error('[Maintenance] Initial purge failed:', err));

        setInterval(() => {
            console.log('[Maintenance] Running scheduled stale game purge...');
            purgeStaleGames().catch(err => console.error('[Maintenance] Scheduled purge failed:', err));
        }, 60 * 60 * 1000); // 1 hour
    });
});
