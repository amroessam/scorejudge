import { calculatePredictions, formatBidHint, PredictionHints } from '../predictions';
import { Player } from '../store';

// Helper to create test players
function createPlayer(name: string, email: string, score: number): Player {
    return {
        id: email,
        name,
        email,
        score,
        bid: 0,
        tricks: 0,
    };
}

describe('calculatePredictions', () => {
    describe('show flag behavior', () => {
        it('should NOT show when all scores are 0 (round 1 before scoring)', () => {
            const players = [
                createPlayer('Alice', 'alice@test.com', 0),
                createPlayer('Bob', 'bob@test.com', 0),
                createPlayer('Charlie', 'charlie@test.com', 0),
            ];

            const hints = calculatePredictions('alice@test.com', players, 1, 10, 3, false);

            expect(hints.show).toBe(false);
        });

        it('should show when at least one player has scored', () => {
            const players = [
                createPlayer('Alice', 'alice@test.com', 18),
                createPlayer('Bob', 'bob@test.com', 0),
                createPlayer('Charlie', 'charlie@test.com', 0),
            ];

            const hints = calculatePredictions('bob@test.com', players, 1, 10, 3, false);

            expect(hints.show).toBe(true);
        });

        it('should return show=false if current user not found', () => {
            const players = [
                createPlayer('Alice', 'alice@test.com', 50),
                createPlayer('Bob', 'bob@test.com', 40),
            ];

            const hints = calculatePredictions('unknown@test.com', players, 1, 10, 2, false);

            expect(hints.show).toBe(false);
        });
    });

    describe('position and ties', () => {
        it('should correctly identify position when leading', () => {
            const players = [
                createPlayer('Alice', 'alice@test.com', 50),
                createPlayer('Bob', 'bob@test.com', 40),
                createPlayer('Charlie', 'charlie@test.com', 30),
            ];

            const hints = calculatePredictions('alice@test.com', players, 1, 10, 3, false);

            expect(hints.position).toBe(1);
            expect(hints.tiedWith).toEqual([]);
        });

        it('should identify tied players correctly', () => {
            const players = [
                createPlayer('Alice', 'alice@test.com', 50),
                createPlayer('Bob', 'bob@test.com', 50),
                createPlayer('Charlie', 'charlie@test.com', 30),
            ];

            const hints = calculatePredictions('alice@test.com', players, 1, 10, 3, false);

            expect(hints.position).toBe(1);
            expect(hints.tiedWith).toContain('Bob');
        });
    });

    describe('User Scenario: 6 Players, Round 6 (3 cards)', () => {
        const players = [
            createPlayer('P1', 'p1@test.com', 50),
            createPlayer('P2', 'p2@test.com', 60),
            createPlayer('P3', 'p3@test.com', 45),
            createPlayer('P4', 'p4@test.com', 70),
            createPlayer('P5', 'p5@test.com', 30),
            createPlayer('P6', 'p6@test.com', 25),
        ];

        it('P4 (1st) should be safe', () => {
            const hints = calculatePredictions('p4@test.com', players, 6, 3, 6, false);
            expect(hints.position).toBe(1);
            expect(hints.winCondition?.message).toContain('Safe');
        });

        it('P3 (4th) should need 3+ if P1 misses', () => {
            // Gap between P1 (50) and P3 (45) is 5.
            // If P1 misses, P3 needs gap + 1 = 6 pts.
            // Points = bid + cards = bid + 3.
            // minBid = 6 - 3 = 3.
            const hints = calculatePredictions('p3@test.com', players, 6, 3, 6, false);
            expect(hints.catchUp?.targetName).toBe('P1');
            expect(hints.catchUp?.minBid).toBe(3);
            expect(hints.catchUp?.impossibleIfTheyMake).toBe(true); // gap+3+1 = 9 pts needed. Max round is 6.
        });
    });

    describe('User Scenario: 6 Players, Final Round (8 cards)', () => {
        const players = [
            createPlayer('P1', 'p1@test.com', 80),
            createPlayer('P2', 'p2@test.com', 70),
            createPlayer('P3', 'p3@test.com', 69),
            createPlayer('P4', 'p4@test.com', 50),
            createPlayer('P5', 'p5@test.com', 52),
            createPlayer('P6', 'p6@test.com', 36),
        ];

        it('P1 (1st) should have defensive advice for P2', () => {
            const hints = calculatePredictions('p1@test.com', players, 15, 8, 6, true);
            expect(hints.winCondition?.message).toContain('P2');
            expect(hints.winCondition?.message).toContain('Make your bid');
        });

        it('P6 should be eliminated (Gay message)', () => {
            // Gap to P4 (5th) is 50 - 36 = 14.
            // Remaining potential in final round is 0 (it's the last round).
            // Max points in round is 16.
            // Wait, P6 is 36. P4 is 50. Gap is 14. 
            // P6 can actually pass P4 if they get 16 and P4 gets 0!
            // Let's adjust scores to ensure elimination for the test.
            const playersElim = [
                ...players.slice(0, 5),
                createPlayer('P6', 'p6@test.com', 10)
            ];
            const hints = calculatePredictions('p6@test.com', playersElim, 15, 8, 6, true);
            expect(hints.isEliminated).toBe(true);
        });
    });
});

describe('formatBidHint', () => {
    it('should format zero bid as "Any bid made"', () => {
        expect(formatBidHint(0)).toBe('Any bid made');
    });

    it('should format non-zero bid with + suffix', () => {
        expect(formatBidHint(3)).toBe('Bid 3+');
    });
});
