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

// Mock fetch for image upload
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
  
  // NEW TEST: Image Upload
  it('should allow image upload for current user', async () => {
      render(<Scoreboard {...defaultProps} currentUserEmail="p1@test.com" />);
      
      // Hidden file input should be present
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();
      
      // Simulate file selection
      const file = new File(['(⌐□_□)'], 'cool_avatar.png', { type: 'image/png' });
      Object.defineProperty(fileInput, 'files', {
        value: [file]
      });
      
      fireEvent.change(fileInput);
      
      await waitFor(() => {
          // It should call the API to upload
          expect(global.fetch).toHaveBeenCalledWith(
              expect.stringContaining('/api/games/game1/players'),
              expect.objectContaining({
                  method: 'PATCH',
                  body: expect.stringContaining('"image":'),
              })
          );
      });
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
});
