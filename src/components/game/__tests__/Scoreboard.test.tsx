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

// Mock react-easy-crop
jest.mock('react-easy-crop', () => {
    const React = require('react');
    return function MockCropper({ onCropComplete }: { onCropComplete: (croppedArea: any, croppedAreaPixels: any) => void }) {
        React.useEffect(() => {
            onCropComplete({ x: 0, y: 0, width: 100, height: 100 }, { x: 0, y: 0, width: 200, height: 200 });
        }, [onCropComplete]);
        return <div data-testid="mock-cropper">Mock Cropper</div>;
    };
});

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
  
  // NEW TEST: Image Upload opens cropper
  it('should open cropper when image is selected for upload', async () => {
      const { container } = render(<Scoreboard {...defaultProps} currentUserEmail="p1@test.com" />);
      
      // Hidden file input should be present
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();
      
      // Simulate file selection with FileReader mock
      const file = new File(['(⌐□_□)'], 'cool_avatar.png', { type: 'image/png' });
      
      // Mock FileReader that triggers callback synchronously
      const mockFileReaderInstance = {
        readAsDataURL: jest.fn(function(this: any) {
            // Synchronously call onloadend
            if (this.onloadend) {
                this.onloadend();
            }
        }),
        onloadend: null as any,
        result: 'data:image/png;base64,testimage'
      };
      jest.spyOn(window, 'FileReader').mockImplementation(() => mockFileReaderInstance as any);
      
      Object.defineProperty(fileInput, 'files', {
        value: [file]
      });
      
      await waitFor(async () => {
          fireEvent.change(fileInput);
      });
      
      await waitFor(() => {
          // Image cropper should open
          expect(screen.getByText('Crop Photo')).toBeInTheDocument();
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

  // NEW TEST: Medal indicators for ranked players
  it('should display medal emojis for top 3 players', () => {
      const rankedGameState = {
          ...mockGameState,
          players: [
              { id: '1', name: 'First', email: 'p1@test.com', score: 100 },
              { id: '2', name: 'Second', email: 'p2@test.com', score: 80 },
              { id: '3', name: 'Third', email: 'p3@test.com', score: 60 },
              { id: '4', name: 'Fourth', email: 'p4@test.com', score: 40 },
          ],
          rounds: [{ index: 1, cards: 5, trump: 'S', state: 'BIDDING', bids: {}, tricks: {} }],
      };
      
      render(<Scoreboard {...defaultProps} gameState={rankedGameState} />);
      
      // Gold, Silver, Bronze medals
      expect(screen.getByText('🥇')).toBeInTheDocument();
      expect(screen.getByText('🥈')).toBeInTheDocument();
      expect(screen.getByText('🥉')).toBeInTheDocument();
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
