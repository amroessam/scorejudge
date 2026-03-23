import { withStateRollback } from '@/lib/state-transaction';
import { GameState } from '@/lib/store';

function makeGame(): GameState {
    return {
        id: 'game-1',
        name: 'Test Game',
        players: [
            { id: 'p1', name: 'Alice', email: 'a@test.com', score: 100, bid: 0, tricks: 0, playerOrder: 0 },
            { id: 'p2', name: 'Bob', email: 'b@test.com', score: 50, bid: 0, tricks: 0, playerOrder: 1 },
        ],
        rounds: [
            { index: 1, cards: 5, trump: 'hearts', state: 'PLAYING' as const, bids: { 'a@test.com': 2 }, tricks: {} },
        ],
        currentRoundIndex: 1,
        ownerEmail: 'a@test.com',
        createdAt: Date.now(),
        lastUpdated: Date.now(),
    };
}

describe('withStateRollback', () => {
    it('returns the result when the async operation succeeds', async () => {
        const game = makeGame();
        const result = await withStateRollback(game, async (g) => {
            g.players[0].score = 200;
            return true;
        });
        expect(result).toBe(true);
        expect(game.players[0].score).toBe(200);
    });

    it('rolls back game state when the async operation throws', async () => {
        const game = makeGame();
        const originalScore = game.players[0].score;
        await expect(
            withStateRollback(game, async (g) => {
                g.players[0].score = 999;
                g.currentRoundIndex = 99;
                throw new Error('DB write failed');
            })
        ).rejects.toThrow('DB write failed');
        expect(game.players[0].score).toBe(originalScore);
        expect(game.currentRoundIndex).toBe(1);
    });

    it('rolls back game state when the async operation returns false', async () => {
        const game = makeGame();
        const originalScore = game.players[0].score;
        const result = await withStateRollback(game, async (g) => {
            g.players[0].score = 999;
            return false;
        });
        expect(result).toBe(false);
        expect(game.players[0].score).toBe(originalScore);
    });

    it('preserves round state changes on success', async () => {
        const game = makeGame();
        await withStateRollback(game, async (g) => {
            g.rounds[0].state = 'COMPLETED';
            g.rounds[0].tricks = { 'a@test.com': 2, 'b@test.com': 3 };
            return true;
        });
        expect(game.rounds[0].state).toBe('COMPLETED');
        expect(game.rounds[0].tricks['a@test.com']).toBe(2);
    });

    it('rolls back round state changes on failure', async () => {
        const game = makeGame();
        await expect(
            withStateRollback(game, async (g) => {
                g.rounds[0].state = 'COMPLETED';
                g.rounds[0].tricks = { 'a@test.com': 2 };
                throw new Error('Failed');
            })
        ).rejects.toThrow('Failed');
        expect(game.rounds[0].state).toBe('PLAYING');
        expect(game.rounds[0].tricks).toEqual({});
    });
});
