import { supabaseAdmin } from '../supabase';
import {
    upsertUser,
    createGame,
    getGame,
    addPlayer,
    getUserByEmail
} from '../db';

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
                                    { user_id: 'user-1', user: { id: 'user-1', email: 'test@example.com', name: 'Test' }, score: 0 }
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
