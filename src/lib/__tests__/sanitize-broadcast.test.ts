import { sanitizeGameForBroadcast } from '@/lib/sanitize-broadcast';
import { GameState } from '@/lib/store';

describe('sanitizeGameForBroadcast', () => {
    const makeGame = (): GameState => ({
        id: 'game-1',
        name: 'Test',
        players: [
            { id: 'p1', name: 'Alice', email: 'alice@secret.com', score: 100, bid: 0, tricks: 0, playerOrder: 0 },
            { id: 'p2', name: 'Bob', email: 'bob@secret.com', score: 50, bid: 0, tricks: 0, playerOrder: 1 },
        ],
        rounds: [],
        currentRoundIndex: 0,
        ownerEmail: 'alice@secret.com',
        operatorEmail: 'alice@secret.com',
        createdAt: Date.now(),
        lastUpdated: Date.now(),
    });

    it('removes email addresses from players', () => {
        const sanitized = sanitizeGameForBroadcast(makeGame());
        expect(sanitized.players[0]).not.toHaveProperty('email');
        expect(sanitized.players[1]).not.toHaveProperty('email');
        expect(sanitized.players[0].name).toBe('Alice');
        expect(sanitized.players[0].id).toBe('p1');
    });

    it('preserves ownerEmail for client auth checks', () => {
        const sanitized = sanitizeGameForBroadcast(makeGame());
        expect(sanitized.ownerEmail).toBe('alice@secret.com');
    });

    it('preserves operatorEmail for client auth checks', () => {
        const sanitized = sanitizeGameForBroadcast(makeGame());
        expect(sanitized.operatorEmail).toBe('alice@secret.com');
    });

    it('preserves all non-email player fields', () => {
        const sanitized = sanitizeGameForBroadcast(makeGame());
        const player = sanitized.players[0];
        expect(player.id).toBe('p1');
        expect(player.name).toBe('Alice');
        expect(player.score).toBe(100);
        expect(player.bid).toBe(0);
        expect(player.tricks).toBe(0);
        expect(player.playerOrder).toBe(0);
    });

    it('does not modify the original game object', () => {
        const game = makeGame();
        sanitizeGameForBroadcast(game);
        expect(game.players[0].email).toBe('alice@secret.com');
        expect(game.players[1].email).toBe('bob@secret.com');
        expect(game.ownerEmail).toBe('alice@secret.com');
    });
});
