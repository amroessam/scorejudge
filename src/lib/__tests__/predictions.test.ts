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

            const hints = calculatePredictions('alice@test.com', players, 5, 3, false);

            expect(hints.show).toBe(false);
        });

        it('should show when at least one player has scored', () => {
            const players = [
                createPlayer('Alice', 'alice@test.com', 18),
                createPlayer('Bob', 'bob@test.com', 0),
                createPlayer('Charlie', 'charlie@test.com', 0),
            ];

            const hints = calculatePredictions('bob@test.com', players, 5, 3, false);

            expect(hints.show).toBe(true);
        });

        it('should return show=false if current user not found', () => {
            const players = [
                createPlayer('Alice', 'alice@test.com', 50),
                createPlayer('Bob', 'bob@test.com', 40),
            ];

            const hints = calculatePredictions('unknown@test.com', players, 5, 2, false);

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

            const hints = calculatePredictions('alice@test.com', players, 5, 3, false);

            expect(hints.position).toBe(1);
            expect(hints.tiedWith).toEqual([]);
        });

        it('should correctly identify position when in middle', () => {
            const players = [
                createPlayer('Alice', 'alice@test.com', 50),
                createPlayer('Bob', 'bob@test.com', 40),
                createPlayer('Charlie', 'charlie@test.com', 30),
            ];

            const hints = calculatePredictions('bob@test.com', players, 5, 3, false);

            expect(hints.position).toBe(2);
        });

        it('should identify tied players correctly', () => {
            const players = [
                createPlayer('Alice', 'alice@test.com', 50),
                createPlayer('Bob', 'bob@test.com', 50),
                createPlayer('Charlie', 'charlie@test.com', 30),
            ];

            const hints = calculatePredictions('alice@test.com', players, 5, 3, false);

            expect(hints.position).toBe(1);
            expect(hints.tiedWith).toContain('Bob');
        });

        it('should identify multiple ties', () => {
            const players = [
                createPlayer('Alice', 'alice@test.com', 50),
                createPlayer('Bob', 'bob@test.com', 50),
                createPlayer('Charlie', 'charlie@test.com', 50),
            ];

            const hints = calculatePredictions('alice@test.com', players, 5, 3, false);

            expect(hints.tiedWith).toHaveLength(2);
            expect(hints.tiedWith).toContain('Bob');
            expect(hints.tiedWith).toContain('Charlie');
        });
    });

    describe('catchUp hints (offensive)', () => {
        it('should calculate minimum bid to catch up to player above', () => {
            // Scenario: 5 cards/player, 2 players = 10 total cards dealt
            // Points if bid made = bid + 10
            // Bob (40) needs to beat Alice (50) = needs 11+ points
            // minBid = max(0, 11 - 10) = 1
            const players = [
                createPlayer('Alice', 'alice@test.com', 50),
                createPlayer('Bob', 'bob@test.com', 40),
            ];

            const hints = calculatePredictions('bob@test.com', players, 5, 2, false);

            expect(hints.catchUp).toBeDefined();
            expect(hints.catchUp!.targetName).toBe('Alice');
            expect(hints.catchUp!.targetScore).toBe(50);
            expect(hints.catchUp!.minBid).toBe(1); // 11 - 10 = 1
            expect(hints.catchUp!.impossible).toBe(false);
        });

        it('should mark catch up as impossible when gap too large', () => {
            // 5 cards/player, 2 players = 10 total cards
            // Max points possible = 5 + 10 = 15
            // Gap of 20 requires 21 points = impossible
            const players = [
                createPlayer('Alice', 'alice@test.com', 50),
                createPlayer('Bob', 'bob@test.com', 30),
            ];

            const hints = calculatePredictions('bob@test.com', players, 5, 2, false);

            expect(hints.catchUp).toBeDefined();
            expect(hints.catchUp!.impossible).toBe(true);
        });

        it('should handle catching up when tied - any bid breaks tie', () => {
            const players = [
                createPlayer('Alice', 'alice@test.com', 50),
                createPlayer('Bob', 'bob@test.com', 50),
            ];

            const hints = calculatePredictions('bob@test.com', players, 5, 2, false);

            // When tied, catchUp still shows but minBid is 0
            expect(hints.catchUp).toBeDefined();
            expect(hints.catchUp!.minBid).toBe(0);
            expect(hints.catchUp!.impossible).toBe(false);
        });

        it('should NOT have catchUp when in 1st place (alone)', () => {
            const players = [
                createPlayer('Alice', 'alice@test.com', 50),
                createPlayer('Bob', 'bob@test.com', 30),
            ];

            const hints = calculatePredictions('alice@test.com', players, 5, 2, false);

            expect(hints.catchUp).toBeUndefined();
        });
    });

    describe('stayAhead hints (defensive)', () => {
        it('should warn when player below can catch up', () => {
            // Alice (50), Bob (45) - Bob needs 6+ points to pass
            // Points = bid + totalCards, so bid = 6 - 10 = max(0, -4) = 0
            const players = [
                createPlayer('Alice', 'alice@test.com', 50),
                createPlayer('Bob', 'bob@test.com', 45),
            ];

            const hints = calculatePredictions('alice@test.com', players, 5, 2, false);

            expect(hints.stayAhead).toBeDefined();
            expect(hints.stayAhead!.threatName).toBe('Bob');
            expect(hints.stayAhead!.youAreSafe).toBe(false);
        });

        it('should mark as safe when gap is too large for anyone to catch', () => {
            // Alice (50), Bob (20) - Bob needs 31 points to pass
            // Max points = 5 + 10 = 15, so Bob can't catch up
            const players = [
                createPlayer('Alice', 'alice@test.com', 50),
                createPlayer('Bob', 'bob@test.com', 20),
            ];

            const hints = calculatePredictions('alice@test.com', players, 5, 2, false);

            expect(hints.stayAhead).toBeDefined();
            expect(hints.stayAhead!.youAreSafe).toBe(true);
        });

        it('should NOT have stayAhead when in last place', () => {
            const players = [
                createPlayer('Alice', 'alice@test.com', 50),
                createPlayer('Bob', 'bob@test.com', 30),
            ];

            const hints = calculatePredictions('bob@test.com', players, 5, 2, false);

            expect(hints.stayAhead).toBeUndefined();
        });
    });

    describe('winCondition hints', () => {
        it('should show "if everyone misses" hint when leading in final round', () => {
            const players = [
                createPlayer('Alice', 'alice@test.com', 50),
                createPlayer('Bob', 'bob@test.com', 49),
                createPlayer('Charlie', 'charlie@test.com', 45),
            ];

            const hints = calculatePredictions('alice@test.com', players, 5, 3, true); // isFinalRound = true

            expect(hints.winCondition).toBeDefined();
            expect(hints.winCondition!.type).toBe('if_others_lose');
            expect(hints.winCondition!.message).toContain('everyone misses');
        });

        it('should show guaranteed victory when gap is insurmountable', () => {
            // 3 cards/player, 3 players = 9 total cards
            // Max points = 3 + 9 = 12
            // Gap of 20 means Bob can't catch Alice even with max score
            const players = [
                createPlayer('Alice', 'alice@test.com', 50),
                createPlayer('Bob', 'bob@test.com', 30),
            ];

            const hints = calculatePredictions('alice@test.com', players, 3, 2, false);

            expect(hints.winCondition).toBeDefined();
            expect(hints.winCondition!.type).toBe('guaranteed');
        });

        it('should show tie-break hint when tied for 1st', () => {
            const players = [
                createPlayer('Alice', 'alice@test.com', 50),
                createPlayer('Bob', 'bob@test.com', 50),
            ];

            const hints = calculatePredictions('alice@test.com', players, 5, 2, false);

            expect(hints.winCondition).toBeDefined();
            expect(hints.winCondition!.message.toLowerCase()).toContain('tied');
        });

        it('should show lead maintained hint when not final round', () => {
            const players = [
                createPlayer('Alice', 'alice@test.com', 50),
                createPlayer('Bob', 'bob@test.com', 40),
            ];

            const hints = calculatePredictions('alice@test.com', players, 5, 2, false);

            expect(hints.winCondition).toBeDefined();
            expect(hints.winCondition!.type).toBe('lead_maintained');
            expect(hints.winCondition!.message).toContain('10'); // Leading by 10 pts
        });
    });

    describe('realistic game scenarios', () => {
        it('User scenario: final round with close competition', () => {
            // Player 1 = 50, Player 2 = 49, Player 3 = 45
            // Final round, 5 cards per player, 3 players
            const players = [
                createPlayer('Player1', 'p1@test.com', 50),
                createPlayer('Player2', 'p2@test.com', 49),
                createPlayer('Player3', 'p3@test.com', 45),
            ];

            // Player 1's perspective (leading)
            const p1Hints = calculatePredictions('p1@test.com', players, 5, 3, true);
            expect(p1Hints.show).toBe(true);
            expect(p1Hints.position).toBe(1);
            expect(p1Hints.stayAhead).toBeDefined();
            expect(p1Hints.stayAhead!.threatName).toBe('Player2');
            expect(p1Hints.winCondition).toBeDefined();

            // Player 2's perspective (chasing)
            const p2Hints = calculatePredictions('p2@test.com', players, 5, 3, true);
            expect(p2Hints.position).toBe(2);
            expect(p2Hints.catchUp).toBeDefined();
            expect(p2Hints.catchUp!.targetName).toBe('Player1');
            expect(p2Hints.catchUp!.impossible).toBe(false); // Gap is only 1

            // Player 3's perspective (far behind)
            const p3Hints = calculatePredictions('p3@test.com', players, 5, 3, true);
            expect(p3Hints.position).toBe(3);
            expect(p3Hints.catchUp).toBeDefined();
            expect(p3Hints.catchUp!.targetName).toBe('Player2');
        });

        it('handles 4-player game midway through', () => {
            const players = [
                createPlayer('Alice', 'alice@test.com', 85),
                createPlayer('Bob', 'bob@test.com', 72),
                createPlayer('Charlie', 'charlie@test.com', 68),
                createPlayer('Diana', 'diana@test.com', 55),
            ];

            // Middle player Charlie
            const hints = calculatePredictions('charlie@test.com', players, 7, 4, false);

            expect(hints.position).toBe(3);
            expect(hints.catchUp!.targetName).toBe('Bob');
            expect(hints.stayAhead!.threatName).toBe('Diana');
        });
    });
});

describe('formatBidHint', () => {
    it('should format zero bid as "Any bid made"', () => {
        expect(formatBidHint(0)).toBe('Any bid made');
    });

    it('should format non-zero bid with + suffix', () => {
        expect(formatBidHint(3)).toBe('Bid 3+');
        expect(formatBidHint(5)).toBe('Bid 5+');
    });
});
