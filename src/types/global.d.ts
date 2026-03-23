import { GameState } from '@/lib/store';

type DiscoveryUpdateType = 'GAME_CREATED' | 'GAME_UPDATED' | 'GAME_DELETED';

declare global {
    // eslint-disable-next-line no-var
    var broadcastGameUpdate: ((gameId: string, state: GameState) => void) | undefined;
    // eslint-disable-next-line no-var
    var broadcastDiscoveryUpdate: ((updateType: DiscoveryUpdateType, game: GameState) => void) | undefined;
}

export {};
