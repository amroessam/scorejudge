import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import { getGame, setGame, updateGame, GameState } from './src/lib/store';

// We need a way to share state between Next.js API routes and this custom server process.
// Since they run in the same process in dev/prod (usually), the `store.ts` *should* be shared memory.
// However, in dev mode, Next.js compiles pages separately.
// For a robust implementation, usually Redis is needed.
// Given "No DB", we assume memory is sufficient for single-instance deployment.

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;
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

    // Client tracking
    const clients = new Map<WebSocket, string>(); // ws -> gameId

    wss.on('connection', (ws, req) => {
        const { query } = parse(req.url || '', true);
        const gameId = query.gameId as string;

        if (!gameId) {
            ws.close();
            return;
        }

        console.log(`Client connected to game ${gameId}`);
        clients.set(ws, gameId);

        // Send current state if valid
        const state = getGame(gameId);
        if (state) {
            ws.send(JSON.stringify({ type: 'GAME_UPDATE', state }));
        } else {
            // If state is missing in memory, we might need to fetch it from Sheet?
            // Since this is the WS server, strictly it should have it or we trigger a fetch.
            // But we can't easily call async Sheet API here without an Auth token.
            // Client should probably fetch state via API first, which loads it into memory.
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
        for (const [client, gId] of clients.entries()) {
            if (client.readyState === WebSocket.OPEN && gId === gameId) {
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
