import { supabaseAdmin } from '@/lib/supabase';
import {
    upsertUser,
    createGame,
    getGame,
    addPlayer,
    getUserByEmail
} from '@/lib/db';

// Mock Supabase client
jest.mock('../supabase', () => ({
    supabaseAdmin: {
        from: jest.fn(() => ({
            upsert: jest.fn(() => ({
                select: jest.fn(() => ({
                    single: jest.fn(() => Promise.resolve({ data: { id: 'user-1' }, error: null }))
                }))
            })),
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    single: jest.fn(() => Promise.resolve({ data: { id: 'user-1' }, error: null }))
                }))
            })),
            insert: jest.fn(() => ({
                select: jest.fn(() => ({
                    single: jest.fn(() => Promise.resolve({ data: { id: 'game-1' }, error: null }))
                }))
            }))
        }))
    }
}));

describe('db.ts (Supabase Data Access Layer)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('upsertUser', () => {
        it('should upsert a user and return the data', async () => {
            const userData = { email: 'test@example.com', name: 'Test User' };
            const user = await upsertUser(userData);

            expect(supabaseAdmin.from).toHaveBeenCalledWith('users');
            expect(user?.id).toBe('user-1');
        });

        it('should upsert a user with a custom string ID (for debug users)', async () => {
            const customId = 'anon_123456';
            const userData = { id: customId, email: 'anon@debug.local', name: 'Anon User' };

            // Update mock for this specific call
            (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
                upsert: jest.fn(() => ({
                    select: jest.fn(() => ({
                        single: jest.fn(() => Promise.resolve({ data: { id: customId }, error: null }))
                    }))
                }))
            });

            const user = await upsertUser(userData);

            expect(user?.id).toBe(customId);
        });
    });

    describe('getUserByEmail', () => {
        it('should fetch a user by email', async () => {
            const user = await getUserByEmail('test@example.com');
            expect(supabaseAdmin.from).toHaveBeenCalledWith('users');
            expect(user?.id).toBe('user-1');
        });
    });

    describe('createGame', () => {
        it('should create a game and return the ID', async () => {
            const game = await createGame('My Game', 'user-1');
            expect(supabaseAdmin.from).toHaveBeenCalledWith('games');
            expect(game?.id).toBe('game-1');
        });
    });

    describe('addPlayer', () => {
        it('should add a player to a game', async () => {
            (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
                insert: jest.fn(() => Promise.resolve({ error: null }))
            });

            const success = await addPlayer('game-1', 'user-1', 0);
            expect(supabaseAdmin.from).toHaveBeenCalledWith('game_players');
            expect(success).toBe(true);
        });
    });

    describe('getGame', () => {
        it('should fetch a full game state', async () => {
            // Complex mock for nested queries
            (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        single: jest.fn(() => Promise.resolve({
                            data: {
                                id: 'game-1',
                                name: 'My Game',
                                game_players: [
                                    { user_id: 'user-1', user: { id: 'user-1', email: 'test@example.com', name: 'Test' }, score: 0, player_order: 0 }
                                ],
                                rounds: [],
                                owner: { email: 'test@example.com' },
                                operator: { email: 'test@example.com' },
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            },
                            error: null
                        }))
                    }))
                }))
            });

            const game = await getGame('game-1');
            expect(game?.name).toBe('My Game');
            expect(game?.players).toHaveLength(1);
        });
    });
});
