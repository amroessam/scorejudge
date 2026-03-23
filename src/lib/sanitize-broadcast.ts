import { GameState } from './store';

/**
 * Strip PII (emails) from game state before broadcasting over WebSocket.
 * Returns a new object -- does not mutate the original.
 *
 * Keeps ownerEmail/operatorEmail at the top level for client auth checks.
 * Only strips email from the players array to avoid bulk PII exposure.
 *
 * MAINTENANCE: When adding new fields to the Player interface,
 * explicitly include them below or they will be silently dropped
 * from WebSocket broadcasts.
 */
export function sanitizeGameForBroadcast(game: GameState): Omit<GameState, 'players'> & { players: Omit<GameState['players'][number], 'email'>[] } {
    return {
        ...game,
        players: game.players.map(({ email, ...rest }) => rest),
    };
}
