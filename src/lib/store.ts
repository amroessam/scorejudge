// Basic In-Memory Store
// Provides fast access and real-time state sharing across API routes and WebSockets.

export interface Player {
    id: string;
    name: string;
    email: string;
    tricks: number;
    bid: number;
    score: number;
    image?: string;
}

export interface Round {
    index: number;
    cards: number;
    trump: string;
    state: 'BIDDING' | 'PLAYING' | 'COMPLETED';
    bids: Record<string, number>; // playerId -> bid
    tricks: Record<string, number>; // playerId -> tricks
}

export interface GameState {
    id: string; // Supabase UUID
    name: string;
    players: Player[];
    rounds: Round[];
    currentRoundIndex: number;
    ownerEmail: string;
    operatorEmail?: string;
    firstDealerEmail?: string;
    createdAt: number;
    lastUpdated: number;
}

// Global store to persist across HMR during development
const globalForStore = globalThis as unknown as { gameStore: Map<string, GameState> };

if (!globalForStore.gameStore) {
    globalForStore.gameStore = new Map<string, GameState>();
}

const games = globalForStore.gameStore;

export function getGame(id: string) {
    return games.get(id);
}

export function setGame(id: string, state: GameState) {
    games.set(id, state);
    if (!state.createdAt) {
        state.createdAt = Date.now();
    }
    state.lastUpdated = Date.now();
    return state;
}

export function updateGame(id: string, partial: Partial<GameState>) {
    const current = games.get(id);
    if (!current) return null;
    const updated = { ...current, ...partial, lastUpdated: Date.now() };
    games.set(id, updated);
    return updated;
}

export function removeGame(id: string) {
    games.delete(id);
}

export function getAllGames(): GameState[] {
    return Array.from(games.values());
}
