import React from 'react';
import { render } from '@testing-library/react';
import { ShareableLeaderboard } from '../ShareableLeaderboard';
import { ShareableScorecard } from '../ShareableScorecard';

describe('Sharing Components', () => {
    describe('ShareableLeaderboard', () => {
        const mockLeaderboard = [
            {
                email: 'player1@example.com',
                name: 'Player 1',
                image: null,
                gamesPlayed: 10,
                wins: 5,
                winRate: 50,
                lastPlaceCount: 1,
                secondPlace: 2,
                thirdPlace: 1,
                averagePercentile: 75,
                podiumRate: 80,
                totalScore: 1000
            },
            {
                email: 'player2@example.com',
                name: 'Player 2',
                image: 'https://example.com/image.png',
                gamesPlayed: 8,
                wins: 2,
                winRate: 25,
                lastPlaceCount: 0,
                secondPlace: 3,
                thirdPlace: 2,
                averagePercentile: 60,
                podiumRate: 87,
                totalScore: 800
            }
        ];

        it('renders leaderboard entries correctly', () => {
            const { getByText } = render(
                <ShareableLeaderboard leaderboard={mockLeaderboard} />
            );

            expect(getByText('SCOREJUDGE')).toBeInTheDocument();
            expect(getByText('GLOBAL LEADERBOARD')).toBeInTheDocument();
            expect(getByText('Player 1')).toBeInTheDocument();
            expect(getByText('Player 2')).toBeInTheDocument();
            expect(getByText('50%')).toBeInTheDocument();
            expect(getByText('25%')).toBeInTheDocument();
        });

        it('attaches ref correctly', () => {
            const ref = React.createRef<HTMLDivElement>();
            render(<ShareableLeaderboard ref={ref} leaderboard={mockLeaderboard} />);
            expect(ref.current).not.toBeNull();
        });
    });

    describe('ShareableScorecard', () => {
        const mockPlayers = [
            {
                id: '1',
                name: 'Winner',
                email: 'w@example.com',
                score: 150,
                bid: 0,
                tricks: 0,
            },
            {
                id: '2',
                name: 'Loser',
                email: 'l@example.com',
                score: 50,
                bid: 0,
                tricks: 0,
            }
        ];

        it('renders scorecard correctly', () => {
            const { getByText } = render(
                <ShareableScorecard gameName="Friday Night Game" players={mockPlayers} />
            );

            expect(getByText('SCOREJUDGE')).toBeInTheDocument();
            expect(getByText('Friday Night Game')).toBeInTheDocument();
            expect(getByText('Winner')).toBeInTheDocument();
            expect(getByText('Loser')).toBeInTheDocument();
            expect(getByText('150')).toBeInTheDocument();
            expect(getByText('50')).toBeInTheDocument();
        });

        it('attaches ref correctly', () => {
            const ref = React.createRef<HTMLDivElement>();
            render(<ShareableScorecard ref={ref} gameName="Test" players={mockPlayers} />);
            expect(ref.current).not.toBeNull();
        });
    });
});
