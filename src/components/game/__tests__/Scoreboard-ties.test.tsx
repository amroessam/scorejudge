import { render, screen } from '@testing-library/react';
import { Scoreboard } from '@/components/game/Scoreboard';
import type { GameState } from '@/lib/store';
import { useRouter } from 'next/navigation';

// Mock next/navigation
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}));

describe('Scoreboard - Tie Handling', () => {
    const mockRouter = {
        push: jest.fn(),
    };

    beforeEach(() => {
        (useRouter as jest.Mock).mockReturnValue(mockRouter);
    });

    it('should show golden cups for multiple top players in tied 1st place', () => {
        const gameState: GameState = {
            id: 'game1',
            name: 'Test Game',
            players: [
                { id: '1', name: 'Winner 1', email: 'w1@test.com', tricks: 0, bid: 0, score: 100 },
                { id: '2', name: 'Winner 2', email: 'w2@test.com', tricks: 0, bid: 0, score: 100 },
                { id: '3', name: 'Loser', email: 'l@test.com', tricks: 0, bid: 0, score: 50 },
            ],
            rounds: [
                { index: 1, cards: 1, trump: 'S', state: 'COMPLETED', bids: {}, tricks: {} },
                { index: 2, cards: 1, trump: 'H', state: 'PLAYING', bids: {}, tricks: {} },
            ],
            currentRoundIndex: 2,
            ownerEmail: 'w1@test.com',
            createdAt: Date.now(),
            lastUpdated: Date.now(),
        };

        render(
            <Scoreboard
                gameId="game1"
                gameState={gameState}
                isOwner={true}
                onOpenEntry={jest.fn()}
                onUndo={jest.fn()}
                onOpenSettings={jest.fn()}
            />
        );

        // Both Winner 1 and Winner 2 should have 🥇
        const firstMedals = screen.getAllByText('🥇');
        expect(firstMedals).toHaveLength(2);

        // Loser should have 🏳️‍🌈
        expect(screen.getByText('🏳️‍🌈')).toBeInTheDocument();
    });

    it('should show rainbow flags for multiple players tied for last place', () => {
        const gameState: GameState = {
            id: 'game1',
            name: 'Test Game',
            players: [
                { id: '1', name: 'Winner', email: 'w@test.com', tricks: 0, bid: 0, score: 100 },
                { id: '2', name: 'Loser 1', email: 'l1@test.com', tricks: 0, bid: 0, score: 50 },
                { id: '3', name: 'Loser 2', email: 'l2@test.com', tricks: 0, bid: 0, score: 50 },
            ],
            rounds: [
                { index: 1, cards: 1, trump: 'S', state: 'COMPLETED', bids: {}, tricks: {} },
                { index: 2, cards: 1, trump: 'H', state: 'PLAYING', bids: {}, tricks: {} },
            ],
            currentRoundIndex: 2,
            ownerEmail: 'w@test.com',
            createdAt: Date.now(),
            lastUpdated: Date.now(),
        };

        render(
            <Scoreboard
                gameId="game1"
                gameState={gameState}
                isOwner={true}
                onOpenEntry={jest.fn()}
                onUndo={jest.fn()}
                onOpenSettings={jest.fn()}
            />
        );

        // Winner should have 🥇
        expect(screen.getByText('🥇')).toBeInTheDocument();

        // Both Loser 1 and Loser 2 should have 🏳️‍🌈
        const lastFlags = screen.getAllByText('🏳️‍🌈');
        expect(lastFlags).toHaveLength(2);
    });

    it('should show 🥇, 🥈, and 🏳️‍🌈 correctly in a 3-tier tie scenario', () => {
        const gameState: GameState = {
            id: 'game1',
            name: 'Test Game',
            players: [
                { id: '1', name: 'P1', email: 'p1@test.com', tricks: 0, bid: 0, score: 100 },
                { id: '2', name: 'P2', email: 'p2@test.com', tricks: 0, bid: 0, score: 100 },
                { id: '3', name: 'P3', email: 'p3@test.com', tricks: 0, bid: 0, score: 99 },
                { id: '4', name: 'P4', email: 'p4@test.com', tricks: 0, bid: 0, score: 98 },
            ],
            rounds: [
                { index: 1, cards: 1, trump: 'S', state: 'COMPLETED', bids: {}, tricks: {} },
                { index: 2, cards: 1, trump: 'H', state: 'PLAYING', bids: {}, tricks: {} },
            ],
            currentRoundIndex: 2,
            ownerEmail: 'p1@test.com',
            createdAt: Date.now(),
            lastUpdated: Date.now(),
        };

        render(
            <Scoreboard
                gameId="game1"
                gameState={gameState}
                isOwner={true}
                onOpenEntry={jest.fn()}
                onUndo={jest.fn()}
                onOpenSettings={jest.fn()}
            />
        );

        // P1 & P2: 100 -> 🥇
        expect(screen.getAllByText('🥇')).toHaveLength(2);
        // P3: 99 -> 🥈
        expect(screen.getByText('🥈')).toBeInTheDocument();
        // P4: 98 -> 🏳️‍🌈 (last distinct score)
        expect(screen.getByText('🏳️‍🌈')).toBeInTheDocument();
    });
});
