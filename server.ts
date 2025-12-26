import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import { getGame, setGame, updateGame, GameState, getSheetIdFromTempId } from './src/lib/store';
import { getToken } from 'next-auth/jwt';
import { IncomingMessage } from 'http';

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

app.prepare().then(() => {
    const server = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url!, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    });

    const wss = new WebSocketServer({ noServer: true });

    // Helper function to validate WebSocket authentication
    async function validateWebSocketAuth(req: IncomingMessage, gameId: string): Promise<{ valid: boolean; email?: string; error?: string }> {
        try {
            // Parse cookies from request headers
            const cookieHeader = req.headers.cookie;
            if (!cookieHeader) {
                console.error('WebSocket auth: No cookies in headers');
                return { valid: false, error: 'No cookies provided' };
            }

            const cookieName = process.env.NODE_ENV === 'production'
                ? '__Secure-next-auth.session-token'
                : 'next-auth.session-token';

            // Parse cookies manually
            const cookies: Record<string, string> = {};
            cookieHeader.split(';').forEach(cookie => {
                const [name, ...valueParts] = cookie.trim().split('=');
                if (name && valueParts.length > 0) {
                    cookies[name.trim()] = decodeURIComponent(valueParts.join('=').trim());
                }
            });

            if (!cookies[cookieName]) {
                console.error('WebSocket auth: Session token cookie not found. Cookie name:', cookieName);
                console.error('WebSocket auth: Available cookies:', Object.keys(cookies));
                return { valid: false, error: 'Session token cookie not found' };
            }

            // Create a mock request object that matches Next.js Request structure
            // getToken expects a request with cookies() method
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

            // Validate session token
            const token = await getToken({
                req: mockReq,
                secret: process.env.NEXTAUTH_SECRET,
                cookieName: cookieName
            });

            if (!token) {
                console.error('WebSocket auth: getToken returned null/undefined');
                return { valid: false, error: 'Invalid or missing session token' };
            }

            if (!token.email) {
                console.error('WebSocket auth: Token missing email field. Token keys:', Object.keys(token));
                return { valid: false, error: 'Invalid or missing session token' };
            }

            // Check if user is a player in the game
            let game = getGame(gameId);
            if (!game) {
                // Try to resolve temp ID
                const realSheetId = getSheetIdFromTempId(gameId);
                if (realSheetId) {
                    game = getGame(realSheetId);
                }
            }
            
            if (!game) {
                return { valid: false, error: 'Game not found' };
            }

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

    wss.on('connection', async (ws, req) => {
        const { query } = parse(req.url || '', true);
        const gameId = query.gameId as string;

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

        // Send current state if valid
        let state = getGame(gameId);
        if (!state) {
            // Try to resolve temp ID
            const realSheetId = getSheetIdFromTempId(gameId);
            if (realSheetId) {
                state = getGame(realSheetId);
            }
        }
        
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
        const message = JSON.stringify({ type: 'GAME_UPDATE', state });
        let sentCount = 0;
        for (const [client, clientInfo] of clients.entries()) {
            if (client.readyState === WebSocket.OPEN && clientInfo.gameId === gameId) {
                try {
                    client.send(message);
                    sentCount++;
                } catch (e) {
                    console.error('Error sending WebSocket message:', e);
                }
            }
        }
        console.log(`Broadcasted game update for ${gameId} to ${sentCount} clients`);
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
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});
