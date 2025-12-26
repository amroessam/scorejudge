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

    // Helper function to find game with retry logic for race conditions
    function findGame(gameId: string, maxRetries = 3, delayMs = 100): Promise<any> {
        return new Promise((resolve) => {
            let attempts = 0;
            
            const tryFind = () => {
                attempts++;
                
                // Check memory first
                let game = getGame(gameId);
                if (!game) {
                    // Try to resolve temp ID
                    const realSheetId = getSheetIdFromTempId(gameId);
                    if (realSheetId) {
                        console.log(`[findGame] Resolved temp ID ${gameId} to ${realSheetId}`);
                        game = getGame(realSheetId);
                    }
                }
                
                if (game) {
                    console.log(`[findGame] Found game ${gameId} on attempt ${attempts}`);
                    resolve(game);
                    return;
                }
                
                // Log what we're looking for
                if (attempts === 1) {
                    console.log(`[findGame] Looking for game ${gameId}, attempt ${attempts}/${maxRetries}`);
                }
                
                // If not found and we have retries left, try again
                if (attempts < maxRetries) {
                    setTimeout(tryFind, delayMs);
                } else {
                    console.error(`[findGame] Game ${gameId} not found after ${maxRetries} attempts`);
                    resolve(null);
                }
            };
            
            tryFind();
        });
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

            // Try to find game with retry logic to handle race conditions
            // For temp IDs, the game might be created asynchronously
            // Increase retries and delay for temp IDs since they're created in API routes
            const maxRetries = gameId.startsWith('temp_') ? 10 : 3;
            const delayMs = gameId.startsWith('temp_') ? 300 : 100;
            
            console.log(`[WebSocket auth] Looking for game ${gameId} (maxRetries: ${maxRetries}, delay: ${delayMs}ms)`);
            const game = await findGame(gameId, maxRetries, delayMs);
            
            if (!game) {
                console.error(`[WebSocket auth] Game ${gameId} not found after ${maxRetries} retries`);
                // Log available games for debugging (only first few to avoid spam)
                const gameStore = (global as any).gameStore as Map<string, any> | undefined;
                if (gameStore) {
                    const allGames = Array.from(gameStore.keys());
                    console.error(`[WebSocket auth] Available games: ${allGames.slice(0, 5).join(', ')}${allGames.length > 5 ? '...' : ''}`);
                } else {
                    console.error(`[WebSocket auth] gameStore not found on global object!`);
                }
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
        
        // Store both the original gameId and resolve to actual ID if needed
        // This helps with matching in broadcasts
        let actualGameId = gameId;
        if (gameId.startsWith('temp_')) {
            const realSheetId = getSheetIdFromTempId(gameId);
            if (realSheetId) {
                actualGameId = realSheetId;
                console.log(`[WebSocket] Resolved temp ID ${gameId} to ${actualGameId}`);
            }
        }
        
        // Store client with original gameId (for matching) but also track actual ID
        clients.set(ws, { gameId, email: authResult.email! });

        // Send current state - use retry logic to handle race conditions
        const state = await findGame(gameId, gameId.startsWith('temp_') ? 5 : 1, 200);
        
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
        
        // Get the real sheet ID if gameId is a temp ID
        let actualGameId = gameId;
        if (gameId.startsWith('temp_')) {
            const realSheetId = getSheetIdFromTempId(gameId);
            if (realSheetId) {
                actualGameId = realSheetId;
            }
        }
        
        for (const [client, clientInfo] of clients.entries()) {
            if (client.readyState !== WebSocket.OPEN) continue;
            
            // Check if client's gameId matches either the provided gameId or the resolved actualGameId
            // Also check if client's gameId resolves to the same actualGameId
            let clientGameId = clientInfo.gameId;
            let clientActualGameId = clientGameId;
            if (clientGameId.startsWith('temp_')) {
                const resolvedId = getSheetIdFromTempId(clientGameId);
                if (resolvedId) {
                    clientActualGameId = resolvedId;
                }
            }
            
            // Match if: exact match OR both resolve to same actual ID
            const matches = clientGameId === gameId || 
                          clientGameId === actualGameId ||
                          clientActualGameId === gameId ||
                          clientActualGameId === actualGameId;
            
            if (matches) {
                try {
                    client.send(message);
                    sentCount++;
                } catch (e) {
                    console.error('Error sending WebSocket message:', e);
                }
            }
        }
        console.log(`Broadcasted game update for ${gameId} (actual: ${actualGameId}) to ${sentCount} clients`);
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
