import { GameState } from './store';

/**
 * Prepare game state for broadcasting over WebSocket.
 * Returns a shallow copy -- does not mutate the original.
 *
 * NOTE: email MUST remain on players because the entire game logic
 * (bids, tricks, scores, dealer selection) uses player.email as the
 * primary key. Stripping it breaks all client-side game functionality.
 */
export function sanitizeGameForBroadcast(game: GameState): GameState {
    return {
        ...game,
    };
}
