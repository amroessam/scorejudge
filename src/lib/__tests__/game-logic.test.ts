jest.mock('@/lib/config', () => ({
    DEBUG_MODE: false,
    DECK_SIZE: 52,
}));

import { getFinalRoundNumber } from '@/lib/game-logic';

describe('game-logic', () => {
    describe('getFinalRoundNumber', () => {
        it('returns correct final round for 4 players', () => {
            expect(getFinalRoundNumber(4)).toBe(25);
        });
        it('returns correct final round for 6 players', () => {
            expect(getFinalRoundNumber(6)).toBe(15);
        });
        it('returns correct final round for 3 players', () => {
            expect(getFinalRoundNumber(3)).toBe(33);
        });
        it('returns 12 as fallback when numPlayers is 0', () => {
            expect(getFinalRoundNumber(0)).toBe(12);
        });
    });
});
