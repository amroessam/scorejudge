import { withStateRollback } from '@/lib/state-transaction';
import { GameState } from '@/lib/store';

function makeTestGame(): GameState {
    return {
        id: 'rollback-test-game',
        name: 'Rollback Test',
        players: [
            { id: 'p1', name: 'Alice', email: 'a@test.com', score: 100, bid: 0, tricks: 0, playerOrder: 0 },
            { id: 'p2', name: 'Bob', email: 'b@test.com', score: 50, bid: 0, tricks: 0, playerOrder: 1 },
            { id: 'p3', name: 'Carol', email: 'c@test.com', score: 75, bid: 0, tricks: 0, playerOrder: 2 },
        ],
        rounds: [
            { index: 1, cards: 5, trump: 'hearts', state: 'PLAYING' as const, bids: { 'a@test.com': 2, 'b@test.com': 1, 'c@test.com': 2 }, tricks: {} },
        ],
        currentRoundIndex: 1,
        ownerEmail: 'a@test.com',
        operatorEmail: 'a@test.com',
        createdAt: Date.now(),
        lastUpdated: Date.now(),
    };
}

describe('Rounds route rollback behavior', () => {
    it('TRICKS: game state is unchanged when DB write returns false', async () => {
        const game = makeTestGame();
        const originalScores = game.players.map(p => p.score);
        const originalRoundState = game.rounds[0].state;

        const result = await withStateRollback(game, async (g) => {
            g.players[0].score += 20;
            g.players[1].score += 10;
            g.rounds[0].tricks = { 'a@test.com': 2, 'b@test.com': 1, 'c@test.com': 2 };
            g.rounds[0].state = 'COMPLETED';
            return false; // Simulate DB failure
        });

        expect(result).toBe(false);
        expect(game.players.map(p => p.score)).toEqual(originalScores);
        expect(game.rounds[0].state).toBe(originalRoundState);
        expect(game.rounds[0].tricks).toEqual({});
    });

    it('BIDS: game state is unchanged when DB write returns false', async () => {
        const game = makeTestGame();
        game.rounds[0].state = 'BIDDING';
        game.rounds[0].bids = {};

        const result = await withStateRollback(game, async (g) => {
            g.rounds[0].bids = { 'a@test.com': 2, 'b@test.com': 1, 'c@test.com': 2 };
            g.rounds[0].state = 'PLAYING';
            return false; // Simulate DB failure
        });

        expect(result).toBe(false);
        expect(game.rounds[0].bids).toEqual({});
        expect(game.rounds[0].state).toBe('BIDDING');
    });

    it('TRICKS: game state is updated when DB write succeeds', async () => {
        const game = makeTestGame();

        const result = await withStateRollback(game, async (g) => {
            g.players[0].score += 20;
            g.players[1].score += 10;
            g.rounds[0].tricks = { 'a@test.com': 2, 'b@test.com': 1, 'c@test.com': 2 };
            g.rounds[0].state = 'COMPLETED';
            return { isGameComplete: false };
        });

        expect(result).toEqual({ isGameComplete: false });
        expect(game.players[0].score).toBe(120);
        expect(game.players[1].score).toBe(60);
        expect(game.rounds[0].state).toBe('COMPLETED');
    });

    it('currentRoundIndex rolls back on failure', async () => {
        const game = makeTestGame();
        const originalIndex = game.currentRoundIndex;

        const result = await withStateRollback(game, async (g) => {
            g.currentRoundIndex += 1;
            return false;
        });

        expect(result).toBe(false);
        expect(game.currentRoundIndex).toBe(originalIndex);
    });

    it('state rolls back on thrown error', async () => {
        const game = makeTestGame();
        const originalScores = game.players.map(p => p.score);

        await expect(
            withStateRollback(game, async (g) => {
                g.players[0].score += 100;
                throw new Error('DB connection lost');
            })
        ).rejects.toThrow('DB connection lost');

        expect(game.players.map(p => p.score)).toEqual(originalScores);
    });
});
