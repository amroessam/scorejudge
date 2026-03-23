import React from 'react';
import { render, waitFor } from '@testing-library/react';
import LeaderboardPage from '../page';

// Mock next/image
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => <img {...props} />,
}));

// Mock html-to-image
jest.mock('html-to-image', () => ({
    toBlob: jest.fn(),
}));

// Mock ShareableLeaderboard
jest.mock('@/components/sharing/ShareableLeaderboard', () => ({
    ShareableLeaderboard: React.forwardRef((_props: any, ref: any) => (
        <div ref={ref} data-testid="shareable-leaderboard" />
    )),
}));

// Mock getAvatarUrl
jest.mock('@/lib/utils', () => ({
    getAvatarUrl: (url: string | null) => url || '/default-avatar.png',
}));

// Generate many players to test scroll behavior
function generatePlayers(count: number) {
    return Array.from({ length: count }, (_, i) => ({
        email: `player${i + 1}@test.com`,
        name: `Player ${i + 1}`,
        image: null,
        gamesPlayed: 10 - i,
        wins: 5 - Math.min(i, 4),
        secondPlace: 2,
        thirdPlace: 1,
        averagePercentile: 90 - i * 5,
        podiumRate: 80,
        winRate: 50 - i * 3,
        totalScore: 1000 - i * 50,
        lastPlaceCount: i,
    }));
}

describe('LeaderboardPage', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('renders all players without truncation (no .slice)', async () => {
        const players = generatePlayers(15);
        global.fetch = jest.fn(() =>
            Promise.resolve({
                json: () => Promise.resolve({ leaderboard: players }),
            })
        ) as any;

        const { getAllByText } = render(<LeaderboardPage />);

        await waitFor(() => {
            // All 15 players should render — not just top 10
            expect(getAllByText(/Player \d+/)).toHaveLength(15);
        });
    });

    it('renders region filter tabs', async () => {
        const players = generatePlayers(15);
        global.fetch = jest.fn(() =>
            Promise.resolve({
                json: () => Promise.resolve({ leaderboard: players }),
            })
        ) as any;

        const { getByText } = render(<LeaderboardPage />);

        await waitFor(() => {
            expect(getByText('All')).toBeInTheDocument();
            expect(getByText(/UAE/)).toBeInTheDocument();
            expect(getByText(/Pakistan/)).toBeInTheDocument();
        });
    });

    it('has a scrollable container for the leaderboard rows', async () => {
        const players = generatePlayers(20);
        global.fetch = jest.fn(() =>
            Promise.resolve({
                json: () => Promise.resolve({ leaderboard: players }),
            })
        ) as any;

        const { container } = render(<LeaderboardPage />);

        await waitFor(() => {
            // Find the scrollable div wrapping the player rows
            const scrollContainer = container.querySelector('[data-testid="leaderboard-scroll"]');
            expect(scrollContainer).toBeInTheDocument();

            // Check overflow-y is set for scrolling
            expect(scrollContainer).toHaveClass('overflow-y-auto');
        });
    });
});
