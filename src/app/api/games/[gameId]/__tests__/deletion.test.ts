/**
 * @jest-environment node
 * 
 * Integration tests for Game Deletion Matrix
 * 
 * Tests the complete deletion flow:
 * - NOT STARTED games (no rounds): Creator hard-deletes
 * - ONGOING games (rounds started but not finished): Creator hard-deletes, players can leave
 * - COMPLETED games (final round completed): Everyone soft-deletes (hides)
 */

import { DELETE } from '../route';
import { getGame as getMemGame } from '@/lib/store';
import { getGame as getDbGame, hideGameForUser, deleteGame as deleteDbGame, removePlayerFromGame, getUserByEmail } from '@/lib/db';
import { getAuthToken } from '@/lib/auth-utils';
import { NextRequest } from 'next/server';

// Mock global Request for Next.js
global.Request = class Request { } as any;

// Mock dependencies
jest.mock('@/lib/store');
jest.mock('@/lib/db');
jest.mock('@/lib/auth-utils');
jest.mock('@/lib/csrf', () => ({
    validateCSRF: jest.fn(() => true),
}));

const mockGetMemGame = getMemGame as jest.MockedFunction<typeof getMemGame>;
const mockGetDbGame = getDbGame as jest.MockedFunction<typeof getDbGame>;
const mockHideGameForUser = hideGameForUser as jest.MockedFunction<typeof hideGameForUser>;
const mockDeleteDbGame = deleteDbGame as jest.MockedFunction<typeof deleteDbGame>;
const mockRemovePlayerFromGame = removePlayerFromGame as jest.MockedFunction<typeof removePlayerFromGame>;
const mockGetUserByEmail = getUserByEmail as jest.MockedFunction<typeof getUserByEmail>;
const mockGetAuthToken = getAuthToken as jest.MockedFunction<typeof getAuthToken>;

describe('DELETE /api/games/[gameId] - Deletion Matrix', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetAuthToken.mockResolvedValue({
            email: 'owner@example.com',
            id: 'owner-id',
            name: 'Owner',
        } as any);

        mockGetUserByEmail.mockResolvedValue({
            id: 'owner-db-id',
            email: 'owner@example.com',
            name: 'Owner',
        } as any);
    });

    describe('NOT STARTED games (currentRoundIndex = 0, no rounds)', () => {
        it('should hard-delete when creator deletes a not-started game', async () => {
            const notStartedGame = {
                id: 'game-123',
                name: 'Test Game',
                ownerEmail: 'owner@example.com',
                players: [
                    { id: 'owner-db-id', email: 'owner@example.com', name: 'Owner', score: 0, bid: 0, tricks: 0 },
                ],
                rounds: [],
                currentRoundIndex: 0,
            };

            mockGetMemGame.mockReturnValue(undefined);
            mockGetDbGame.mockResolvedValue(notStartedGame as any);

            const req = new NextRequest('http://localhost:3000/api/games/game-123', {
                method: 'DELETE',
            });

            const response = await DELETE(req, { params: Promise.resolve({ gameId: 'game-123' }) });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.message).toBe('Game deleted for all players');
            expect(mockDeleteDbGame).toHaveBeenCalledWith('game-123');
            expect(mockHideGameForUser).not.toHaveBeenCalled();
        });
    });

    describe('ONGOING games (rounds started but not completed)', () => {
        it('should hard-delete when creator deletes an ongoing game', async () => {
            const ongoingGame = {
                id: 'game-123',
                name: 'Test Game',
                ownerEmail: 'owner@example.com',
                players: [
                    { id: 'owner-db-id', email: 'owner@example.com', name: 'Owner', score: 0, bid: 0, tricks: 0 },
                    { id: 'player2-id', email: 'player2@example.com', name: 'Player 2', score: 0, bid: 0, tricks: 0 },
                ],
                rounds: [
                    { index: 0, cards: 1, trump: 'Hearts', state: 'BIDDING', bids: {}, tricks: {} },
                ],
                currentRoundIndex: 1,
            };

            mockGetMemGame.mockReturnValue(undefined);
            mockGetDbGame.mockResolvedValue(ongoingGame as any);

            const req = new NextRequest('http://localhost:3000/api/games/game-123', {
                method: 'DELETE',
            });

            const response = await DELETE(req, { params: Promise.resolve({ gameId: 'game-123' }) });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.message).toBe('Game deleted for all players');
            expect(mockDeleteDbGame).toHaveBeenCalledWith('game-123');
            expect(mockHideGameForUser).not.toHaveBeenCalled();
        });

        it('should allow player to leave an ongoing game', async () => {
            const ongoingGame = {
                id: 'game-123',
                name: 'Test Game',
                ownerEmail: 'owner@example.com',
                players: [
                    { id: 'owner-db-id', email: 'owner@example.com', name: 'Owner', score: 0, bid: 0, tricks: 0 },
                    { id: 'player2-id', email: 'player2@example.com', name: 'Player 2', score: 0, bid: 0, tricks: 0 },
                ],
                rounds: [
                    { index: 0, cards: 1, trump: 'Hearts', state: 'BIDDING', bids: {}, tricks: {} },
                ],
                currentRoundIndex: 1,
            };

            mockGetMemGame.mockReturnValue(undefined);
            mockGetDbGame.mockResolvedValue(ongoingGame as any);
            mockGetAuthToken.mockResolvedValue({
                email: 'player2@example.com',
                id: 'player2-id',
                name: 'Player 2',
            } as any);
            mockGetUserByEmail.mockResolvedValue({
                id: 'player2-id',
                email: 'player2@example.com',
                name: 'Player 2',
            } as any);

            const req = new NextRequest('http://localhost:3000/api/games/game-123', {
                method: 'DELETE',
            });

            const response = await DELETE(req, { params: Promise.resolve({ gameId: 'game-123' }) });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.message).toBe('You have left the game');
            expect(mockRemovePlayerFromGame).toHaveBeenCalledWith('game-123', 'player2-id');
            expect(mockDeleteDbGame).not.toHaveBeenCalled();
            expect(mockHideGameForUser).not.toHaveBeenCalled();
        });
    });

    describe('COMPLETED games (final round completed)', () => {
        it('should soft-delete when creator deletes a completed game', async () => {
            const completedGame = {
                id: 'game-123',
                name: 'Test Game',
                ownerEmail: 'owner@example.com',
                players: [
                    { id: 'owner-db-id', email: 'owner@example.com', name: 'Owner', score: 100, bid: 0, tricks: 0 },
                    { id: 'player2-id', email: 'player2@example.com', name: 'Player 2', score: 80, bid: 0, tricks: 0 },
                ],
                rounds: [
                    { index: 0, cards: 1, trump: 'Hearts', state: 'COMPLETED', bids: {}, tricks: {} },
                    { index: 1, cards: 2, trump: 'Spades', state: 'COMPLETED', bids: {}, tricks: {} },
                    // For 2 players, final round is at index 11 (12 rounds total, 0-indexed)
                    { index: 11, cards: 12, trump: 'Diamonds', state: 'COMPLETED', bids: {}, tricks: {} },
                ],
                currentRoundIndex: 12,
            };

            mockGetMemGame.mockReturnValue(undefined);
            mockGetDbGame.mockResolvedValue(completedGame as any);

            const req = new NextRequest('http://localhost:3000/api/games/game-123', {
                method: 'DELETE',
            });

            const response = await DELETE(req, { params: Promise.resolve({ gameId: 'game-123' }) });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.message).toBe('Game hidden from your view');
            expect(mockHideGameForUser).toHaveBeenCalledWith('game-123', 'owner-db-id');
            expect(mockDeleteDbGame).not.toHaveBeenCalled();
        });

        it('should soft-delete when player deletes a completed game', async () => {
            const completedGame = {
                id: 'game-123',
                name: 'Test Game',
                ownerEmail: 'owner@example.com',
                players: [
                    { id: 'owner-db-id', email: 'owner@example.com', name: 'Owner', score: 100, bid: 0, tricks: 0 },
                    { id: 'player2-id', email: 'player2@example.com', name: 'Player 2', score: 80, bid: 0, tricks: 0 },
                ],
                rounds: [
                    { index: 0, cards: 1, trump: 'Hearts', state: 'COMPLETED', bids: {}, tricks: {} },
                    { index: 11, cards: 12, trump: 'Diamonds', state: 'COMPLETED', bids: {}, tricks: {} },
                ],
                currentRoundIndex: 12,
            };

            mockGetMemGame.mockReturnValue(undefined);
            mockGetDbGame.mockResolvedValue(completedGame as any);
            mockGetAuthToken.mockResolvedValue({
                email: 'player2@example.com',
                id: 'player2-id',
                name: 'Player 2',
            } as any);
            mockGetUserByEmail.mockResolvedValue({
                id: 'player2-id',
                email: 'player2@example.com',
                name: 'Player 2',
            } as any);

            const req = new NextRequest('http://localhost:3000/api/games/game-123', {
                method: 'DELETE',
            });

            const response = await DELETE(req, { params: Promise.resolve({ gameId: 'game-123' }) });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.message).toBe('Game hidden from your view');
            expect(mockHideGameForUser).toHaveBeenCalledWith('game-123', 'player2-id');
            expect(mockDeleteDbGame).not.toHaveBeenCalled();
        });
    });

    describe('Edge cases', () => {
        it('should return 404 if game not found', async () => {
            mockGetMemGame.mockReturnValue(undefined);
            mockGetDbGame.mockResolvedValue(null);

            const req = new NextRequest('http://localhost:3000/api/games/nonexistent', {
                method: 'DELETE',
            });

            const response = await DELETE(req, { params: Promise.resolve({ gameId: 'nonexistent' }) });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error).toBe('Game not found');
        });

        it('should return 401 if not authenticated', async () => {
            mockGetAuthToken.mockResolvedValue(null);

            const req = new NextRequest('http://localhost:3000/api/games/game-123', {
                method: 'DELETE',
            });

            const response = await DELETE(req, { params: Promise.resolve({ gameId: 'game-123' }) });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('Unauthorized');
        });
    });
});
