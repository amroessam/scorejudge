// Basic In-Memory Store
// In a real production app (if not serverless), this works for a single instance.
// If scaling, we'd use Redis. But user said "No DB", so in-memory single-instance is the constraint.

export interface Player {
    id: string;
    name: string;
    email: string;
    tricks: number;
    bid: number;
    score: number;
    image?: string; // Profile picture URL
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
    id: string; // Sheet ID
    name: string;
    players: Player[];
    rounds: Round[];
    currentRoundIndex: number;
    ownerEmail: string;
    operatorEmail?: string; // Defaults to ownerEmail if not set
    firstDealerEmail?: string; // Optional: specific starting dealer

    // Timestamps
    createdAt: number; // When the game was created
    lastUpdated: number; // When the game was last updated
}

const globalForStore = globalThis as unknown as { gameStore: Map<string, GameState> };

// Always use the same store instance across the application
// This ensures API routes and WebSocket server share the same memory
if (!globalForStore.gameStore) {
    globalForStore.gameStore = new Map<string, GameState>();
}

const games = globalForStore.gameStore;

export function getGame(id: string) {
    return games.get(id);
}

export function setGame(id: string, state: GameState) {
    games.set(id, state);
    // Set createdAt if not already set (for new games)
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
    return updated; // Return updated state
}

export function removeGame(id: string) {
    games.delete(id);
}

// Map temporary IDs to real sheet IDs
const globalForIdMap = globalThis as unknown as { tempIdMap: Map<string, string> };

// Always use the same tempIdMap instance across the application
if (!globalForIdMap.tempIdMap) {
    globalForIdMap.tempIdMap = new Map<string, string>();
}

const tempIdMap = globalForIdMap.tempIdMap;

export function mapTempIdToSheetId(tempId: string, sheetId: string) {
    tempIdMap.set(tempId, sheetId);
}

export function getSheetIdFromTempId(tempId: string): string | undefined {
    return tempIdMap.get(tempId);
}

export function getAllGames(): GameState[] {
    return Array.from(games.values());
}
