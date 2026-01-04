import { render, screen } from '@testing-library/react';
import { Scoreboard } from '@/components/game/Scoreboard';
import type { GameState, Player } from '@/lib/store';
import { useRouter } from 'next/navigation';

// Mock next/navigation
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}));

// Mock canvas-confetti
jest.mock('canvas-confetti', () => ({
    __esModule: true,
    default: jest.fn(),
}));

describe('Scoreboard - UX Enhancements', () => {
    const mockRouter = {
        push: jest.fn(),
    };

    beforeEach(() => {
        (useRouter as jest.Mock).mockReturnValue(mockRouter);
    });

    const createPlayer = (id: string, name: string, email: string, score: number): Player => ({
        id, name, email, score, tricks: 0, bid: 0
    });

    it('should show Momentum Glow (Fire) for 3+ win streak', () => {
        const p1 = createPlayer('1', 'Streak Master', 'p1@test.com', 30);
        // Mock rounds where p1 won 3 times in a row
        const rounds = [
            { index: 1, state: 'COMPLETED' as any, cards: 1, trump: 'S', bids: { 'p1@test.com': 1 }, tricks: { 'p1@test.com': 1 } },
            { index: 2, state: 'COMPLETED' as any, cards: 2, trump: 'D', bids: { 'p1@test.com': 2 }, tricks: { 'p1@test.com': 2 } },
            { index: 3, state: 'COMPLETED' as any, cards: 3, trump: 'H', bids: { 'p1@test.com': 0 }, tricks: { 'p1@test.com': 0 } },
        ];

        const gameState: GameState = {
            id: 'game1',
            name: 'Test Game',
            players: [p1],
            rounds,
            currentRoundIndex: 4,
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

        // Should find fire icon
        expect(screen.getByText('🔥')).toBeInTheDocument();
    });

    it('should show Blue Glow for 5+ win streak', () => {
        const p1 = createPlayer('1', 'Godlike', 'p1@test.com', 50);
        // Mock rounds where p1 won 5 times in a row
        const rounds = Array(5).fill(null).map((_, i) => ({
            index: i + 1,
            state: 'COMPLETED' as any,
            cards: 1,
            trump: 'S',
            bids: { 'p1@test.com': 1 },
            tricks: { 'p1@test.com': 1 }
        }));

        const gameState: GameState = {
            id: 'game1',
            name: 'Test Game',
            players: [p1],
            rounds,
            currentRoundIndex: 6,
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

        // Should find blue flame or specific indicator (we'll look for the icon)
        expect(screen.getByText('🔵')).toBeInTheDocument();
    });

    it('should highlight Nemesis (player directly above)', () => {
        // P1: 100, P2: 90 (Me), P3: 80
        // Nemesis for P2 is P1
        const p1 = createPlayer('1', 'Top Dog', 'p1@test.com', 100);
        const p2 = createPlayer('2', 'Challenger', 'p2@test.com', 90);
        const p3 = createPlayer('3', 'Bottom', 'p3@test.com', 80);

        const gameState: GameState = {
            id: 'game1',
            name: 'Test Game',
            players: [p1, p2, p3],
            rounds: [],
            currentRoundIndex: 1,
            ownerEmail: 'p1@test.com',
            createdAt: Date.now(),
            lastUpdated: Date.now(),
        };

        render(
            <Scoreboard
                gameId="game1"
                gameState={gameState}
                isOwner={true}
                currentUserEmail="p2@test.com" // Me
                onOpenEntry={jest.fn()}
                onUndo={jest.fn()}
                onOpenSettings={jest.fn()}
            />
        );

        // P1 should be marked as Nemesis
        // We'll look for the target icon only on P1's row
        const nemesisIcon = screen.getByLabelText('Nemesis Target');
        expect(nemesisIcon).toBeInTheDocument();
        // Ideally verify it's associated with P1, but presence is good first step
    });

    it('should show Table Mood: Aggressive (Overbid)', () => {
        // Round has 3 cards. Bids: 2 + 2 = 4 (> 3)
        const round = {
            index: 1,
            cards: 3,
            trump: 'S',
            state: 'PLAYING' as any,
            bids: { 'p1@test.com': 2, 'p2@test.com': 2 },
            tricks: {}
        };

        const gameState: GameState = {
            id: 'game1',
            name: 'Test Game',
            players: [
                createPlayer('1', 'P1', 'p1@test.com', 0),
                createPlayer('2', 'P2', 'p2@test.com', 0)
            ],
            rounds: [round],
            currentRoundIndex: 1,
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

        expect(screen.getByText(/Aggressive/i)).toBeInTheDocument();
        expect(screen.getByText('🔥')).toBeInTheDocument();
    });

    it('should show Table Mood: Tentative (Underbid)', () => {
        // Round has 3 cards. Bids: 0 + 1 = 1 (< 3)
        const round = {
            index: 1,
            cards: 3,
            trump: 'S',
            state: 'PLAYING' as any,
            bids: { 'p1@test.com': 0, 'p2@test.com': 1 },
            tricks: {}
        };

        const gameState: GameState = {
            id: 'game1',
            name: 'Test Game',
            players: [
                createPlayer('1', 'P1', 'p1@test.com', 0),
                createPlayer('2', 'P2', 'p2@test.com', 0)
            ],
            rounds: [round],
            currentRoundIndex: 1,
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

        expect(screen.getByText(/Tentative/i)).toBeInTheDocument();
        expect(screen.getByText('❄️')).toBeInTheDocument();
    });
});
