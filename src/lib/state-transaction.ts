import { GameState } from './store';

// Use structuredClone when available (Node 17+), fall back to JSON round-trip
// for environments like jsdom that don't expose it.
const deepClone = <T>(obj: T): T =>
    typeof structuredClone === 'function'
        ? structuredClone(obj)
        : JSON.parse(JSON.stringify(obj));

/**
 * Execute an async operation that mutates game state.
 * If the operation throws or returns false, the game state is rolled back
 * to a deep-clone snapshot taken before the operation started.
 *
 * Uses structuredClone() for a complete deep copy — future-proof against
 * nested object additions to Player or Round schemas.
 */
export async function withStateRollback<T>(
    game: GameState,
    operation: (game: GameState) => Promise<T>,
): Promise<T> {
    const snapshot = {
        players: deepClone(game.players),
        rounds: deepClone(game.rounds),
        currentRoundIndex: game.currentRoundIndex,
        lastUpdated: game.lastUpdated,
    };

    try {
        const result = await operation(game);

        if (result === false) {
            game.players = snapshot.players;
            game.rounds = snapshot.rounds;
            game.currentRoundIndex = snapshot.currentRoundIndex;
            game.lastUpdated = snapshot.lastUpdated;
        }

        return result;
    } catch (error) {
        game.players = snapshot.players;
        game.rounds = snapshot.rounds;
        game.currentRoundIndex = snapshot.currentRoundIndex;
        game.lastUpdated = snapshot.lastUpdated;
        throw error;
    }
}
