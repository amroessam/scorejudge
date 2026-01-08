/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { DELETE } from '../route';
import { getAuthToken } from '@/lib/auth-utils';
import { getUserByEmail, getGame as getDbGame, deleteGame as deleteDbGame, hideGameForUser, removePlayerFromGame } from '@/lib/db';
import { getGame as getMemGame, removeGame as removeMemGame } from '@/lib/store';
import { validateCSRF } from '@/lib/csrf';

jest.mock('@/lib/auth-utils');
jest.mock('@/lib/db');
jest.mock('@/lib/store');
jest.mock('@/lib/csrf');

describe('DELETE /api/games/[gameId] Lifecycle', () => {
    const gameId = 'game-123';
    const mockHost = { id: 'host-1', email: 'host@test.com' };
    const mockPlayer = { id: 'player-2', email: 'player@test.com' };

    beforeEach(() => {
        jest.clearAllMocks();
        (validateCSRF as jest.Mock).mockReturnValue(true);
    });

    describe('Incomplete Game (Lobby/Ongoing)', () => {
        const incompleteGame = {
            id: gameId,
            ownerEmail: 'host@test.com',
            players: [{ id: 'host-1' }, { id: 'player-2' }],
            rounds: [{ state: 'BIDDING' }] // Not completed
        };

        it('Host deletes: should hard delete', async () => {
            (getAuthToken as jest.Mock).mockResolvedValue(mockHost);
            (getUserByEmail as jest.Mock).mockResolvedValue(mockHost);
            (getMemGame as jest.Mock).mockReturnValue(incompleteGame);

            const req = new NextRequest(`http://localhost/api/games/${gameId}`, { method: 'DELETE' });
            const res = await DELETE(req, { params: Promise.resolve({ gameId }) });

            expect(res.status).toBe(200);
            expect(deleteDbGame).toHaveBeenCalledWith(gameId);
            expect(removeMemGame).toHaveBeenCalledWith(gameId);
        });

        it('Player deletes: should remove player (leave)', async () => {
            (getAuthToken as jest.Mock).mockResolvedValue(mockPlayer);
            (getUserByEmail as jest.Mock).mockResolvedValue(mockPlayer);
            (getMemGame as jest.Mock).mockReturnValue(incompleteGame);

            const req = new NextRequest(`http://localhost/api/games/${gameId}`, { method: 'DELETE' });
            const res = await DELETE(req, { params: Promise.resolve({ gameId }) });

            expect(res.status).toBe(200);
            expect(removePlayerFromGame).toHaveBeenCalledWith(gameId, mockPlayer.id);
            expect(deleteDbGame).not.toHaveBeenCalled();
        });
    });

    describe('Completed Game', () => {
        const completedGame = {
            id: gameId,
            ownerEmail: 'host@test.com',
            players: [{ id: 'host-1' }, { id: 'player-2' }],
            rounds: [{ state: 'COMPLETED' }]
        };

        it('Host deletes: should soft delete (hide)', async () => {
            (getAuthToken as jest.Mock).mockResolvedValue(mockHost);
            (getUserByEmail as jest.Mock).mockResolvedValue(mockHost);
            (getMemGame as jest.Mock).mockReturnValue(completedGame);

            const req = new NextRequest(`http://localhost/api/games/${gameId}`, { method: 'DELETE' });
            const res = await DELETE(req, { params: Promise.resolve({ gameId }) });

            expect(res.status).toBe(200);
            expect(hideGameForUser).toHaveBeenCalledWith(gameId, mockHost.id);
            expect(deleteDbGame).not.toHaveBeenCalled();
        });

        it('Player deletes: should soft delete (hide)', async () => {
            (getAuthToken as jest.Mock).mockResolvedValue(mockPlayer);
            (getUserByEmail as jest.Mock).mockResolvedValue(mockPlayer);
            (getMemGame as jest.Mock).mockReturnValue(completedGame);

            const req = new NextRequest(`http://localhost/api/games/${gameId}`, { method: 'DELETE' });
            const res = await DELETE(req, { params: Promise.resolve({ gameId }) });

            expect(res.status).toBe(200);
            expect(hideGameForUser).toHaveBeenCalledWith(gameId, mockPlayer.id);
            expect(deleteDbGame).not.toHaveBeenCalled();
            expect(removePlayerFromGame).not.toHaveBeenCalled();
        });
    });
});
