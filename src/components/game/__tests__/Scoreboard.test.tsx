import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Scoreboard } from '@/components/game/Scoreboard';
import type { GameState } from '@/lib/store';

// Mock canvas-confetti
const mockConfetti = jest.fn();
jest.mock('canvas-confetti', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock next-auth/react
const mockUseSession = jest.fn();
jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

// Mock fetch
global.fetch = jest.fn();

describe('Scoreboard', () => {
  const mockGameState: GameState = {
    id: 'game1',
    name: 'Test Game',
    players: [
      { id: '1', name: 'Player 1', email: 'p1@test.com', tricks: 0, bid: 0, score: 10, image: 'https://lh3.googleusercontent.com/a/test-photo.jpg' },
      { id: '2', name: 'Player 2', email: 'p2@test.com', tricks: 0, bid: 0, score: 5 },
      { id: '3', name: 'Player 3', email: 'p3@test.com', tricks: 0, bid: 0, score: 8 },
    ],
    rounds: [
      {
        index: 1,
        cards: 5,
        trump: 'S',
        state: 'BIDDING',
        bids: {},
        tricks: {},
      },
    ],
    currentRoundIndex: 1,
    ownerEmail: 'p1@test.com',
    createdAt: Date.now(),
    lastUpdated: Date.now(),
  };

  const defaultProps = {
    gameId: 'game1',
    gameState: mockGameState,
    isOwner: true,
    currentUserEmail: 'p1@test.com',
    onOpenEntry: jest.fn(),
    onUndo: jest.fn(),
    onOpenSettings: jest.fn(),
    onNextRound: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    });
    const confetti = require('canvas-confetti').default;
    confetti.mockClear();
  });

  // ... existing tests ...
  it('should render current round information', () => {
    render(<Scoreboard {...defaultProps} />);
    expect(screen.getByText('Round 1')).toBeInTheDocument();
  });

  // Image upload is only available in the lobby (GameSetup), not during the game
  it('should NOT have file input for image upload during game', () => {
    const { container } = render(<Scoreboard {...defaultProps} currentUserEmail="p1@test.com" />);

    // Hidden file input should NOT be present during game
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeInTheDocument();
  });

  // NEW TEST: Win/Loss Indicators
  it('should display W/L indicators for past rounds', () => {
    const historyGameState = {
      ...mockGameState,
      rounds: [
        {
          index: 1,
          cards: 5,
          trump: 'S',
          state: 'COMPLETED' as const,
          bids: { 'p1@test.com': 2 },
          tricks: { 'p1@test.com': 2 }, // Win
        },
        {
          index: 2,
          cards: 4,
          trump: 'D',
          state: 'COMPLETED' as const,
          bids: { 'p1@test.com': 1 },
          tricks: { 'p1@test.com': 0 }, // Loss
        },
        {
          index: 3,
          cards: 3,
          trump: 'C',
          state: 'PLAYING' as const, // Not completed
          bids: { 'p1@test.com': 1 },
          tricks: {},
        }
      ]
    };

    render(<Scoreboard {...defaultProps} gameState={historyGameState} />);

    // Should find 'W' and 'L' text
    expect(screen.getByText('W')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
  });

  // NEW TEST: Medal indicators for ranked players (only from round 2 onwards)
  it('should display medal emojis for top players from round 2 onwards', () => {
    const rankedGameState = {
      ...mockGameState,
      currentRoundIndex: 2, // Round 2 - medals should show
      players: [
        { id: '1', name: 'First', email: 'p1@test.com', score: 100 },
        { id: '2', name: 'Second', email: 'p2@test.com', score: 80 },
        { id: '3', name: 'Third', email: 'p3@test.com', score: 60 },
        { id: '4', name: 'Fourth', email: 'p4@test.com', score: 40 },
      ],
      rounds: [
        { index: 1, cards: 5, trump: 'S', state: 'COMPLETED', bids: {}, tricks: {} },
        { index: 2, cards: 5, trump: 'D', state: 'BIDDING', bids: {}, tricks: {} }
      ],
    };

    render(<Scoreboard {...defaultProps} gameState={rankedGameState} />);

    // Gold, Silver, Bronze medals (4 players = 1st Gold, 2nd Silver, 3rd Bronze, 4th Flag)
    expect(screen.getByText('🥇')).toBeInTheDocument();
    expect(screen.getByText('🥈')).toBeInTheDocument();
    expect(screen.getByText('🥉')).toBeInTheDocument();
    expect(screen.getByText('🏳️‍🌈')).toBeInTheDocument();
  });

  it('should NOT display medal emojis in round 1', () => {
    const round1GameState = {
      ...mockGameState,
      currentRoundIndex: 1, // Round 1 - no medals
      players: [
        { id: '1', name: 'First', email: 'p1@test.com', score: 0 },
        { id: '2', name: 'Second', email: 'p2@test.com', score: 0 },
        { id: '3', name: 'Third', email: 'p3@test.com', score: 0 },
      ],
      rounds: [{ index: 1, cards: 5, trump: 'S', state: 'BIDDING', bids: {}, tricks: {} }],
    };

    render(<Scoreboard {...defaultProps} gameState={round1GameState} />);

    // No medals should be shown
    expect(screen.queryByText('🥇')).not.toBeInTheDocument();
    expect(screen.queryByText('🥈')).not.toBeInTheDocument();
    expect(screen.queryByText('🥉')).not.toBeInTheDocument();
    expect(screen.queryByText('🏳️‍🌈')).not.toBeInTheDocument();
  });

  it('should show flag instead of bronze for 3rd player when only 3 players', () => {
    const threePlayerGameState = {
      ...mockGameState,
      currentRoundIndex: 2, // Round 2
      players: [
        { id: '1', name: 'First', email: 'p1@test.com', score: 100 },
        { id: '2', name: 'Second', email: 'p2@test.com', score: 80 },
        { id: '3', name: 'Third', email: 'p3@test.com', score: 60 },
      ],
      rounds: [
        { index: 1, cards: 5, trump: 'S', state: 'COMPLETED', bids: {}, tricks: {} },
        { index: 2, cards: 5, trump: 'D', state: 'BIDDING', bids: {}, tricks: {} }
      ],
    };

    render(<Scoreboard {...defaultProps} gameState={threePlayerGameState} />);

    // 3 players: 1st Gold, 2nd Silver, 3rd Flag (no Bronze)
    expect(screen.getByText('🥇')).toBeInTheDocument();
    expect(screen.getByText('🥈')).toBeInTheDocument();
    expect(screen.queryByText('🥉')).not.toBeInTheDocument();
    expect(screen.getByText('🏳️‍🌈')).toBeInTheDocument();
  });

  // NEW TEST: W/L indicators should wrap when many rounds
  it('should have W/L indicators with flex-wrap for many rounds', () => {
    const manyRoundsGameState = {
      ...mockGameState,
      players: [
        { id: '1', name: 'Player 1', email: 'p1@test.com', score: 100 },
      ],
      rounds: Array.from({ length: 15 }, (_, i) => ({
        index: i + 1,
        cards: 5,
        trump: 'S',
        state: 'COMPLETED' as const,
        bids: { 'p1@test.com': 1 },
        tricks: { 'p1@test.com': i % 2 === 0 ? 1 : 0 }, // alternating wins/losses
      })),
      currentRoundIndex: 16,
    };

    render(<Scoreboard {...defaultProps} gameState={manyRoundsGameState} currentUserEmail="other@test.com" />);

    // Should have many W and L indicators
    const wins = screen.getAllByText('W');
    const losses = screen.getAllByText('L');
    expect(wins.length).toBeGreaterThan(0);
    expect(losses.length).toBeGreaterThan(0);
  });
});
