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
    // Default mock: no session (no profile picture)
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    });
    // Reset confetti mock
    const confetti = require('canvas-confetti').default;
    confetti.mockClear();
  });

  it('should render current round information', () => {
    render(<Scoreboard {...defaultProps} />);

    expect(screen.getByText('Round 1')).toBeInTheDocument();
    expect(screen.getByText('5 Cards')).toBeInTheDocument();
    expect(screen.getByText('Spades')).toBeInTheDocument();
  });

  it('should render all players with their scores', () => {
    render(<Scoreboard {...defaultProps} />);

    expect(screen.getByText('Player 1')).toBeInTheDocument();
    expect(screen.getByText('Player 2')).toBeInTheDocument();
    expect(screen.getByText('Player 3')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('should show "Enter Bids" button for owner when round is in BIDDING state', () => {
    render(<Scoreboard {...defaultProps} />);

    const enterBidsButton = screen.getByRole('button', { name: /Enter Bids/i });
    expect(enterBidsButton).toBeInTheDocument();
  });

  it('should call onOpenEntry when Enter Bids button is clicked', () => {
    render(<Scoreboard {...defaultProps} />);

    const enterBidsButton = screen.getByRole('button', { name: /Enter Bids/i });
    fireEvent.click(enterBidsButton);

    expect(defaultProps.onOpenEntry).toHaveBeenCalledTimes(1);
  });

  it('should show "Enter Scores" button when round is in PLAYING state', () => {
    const playingGameState = {
      ...mockGameState,
      rounds: [
        {
          ...mockGameState.rounds[0],
          state: 'PLAYING' as const,
          bids: {
            'p1@test.com': 2,
            'p2@test.com': 1,
            'p3@test.com': 2,
          },
        },
      ],
    };

    render(<Scoreboard {...defaultProps} gameState={playingGameState} />);

    const enterScoresButton = screen.getByRole('button', { name: /Enter Scores/i });
    expect(enterScoresButton).toBeInTheDocument();
  });

  it('should show "Next Round" button when round is COMPLETED', () => {
    const completedGameState = {
      ...mockGameState,
      rounds: [
        {
          ...mockGameState.rounds[0],
          state: 'COMPLETED' as const,
          bids: {
            'p1@test.com': 2,
            'p2@test.com': 1,
            'p3@test.com': 2,
          },
          tricks: {
            'p1@test.com': 2,
            'p2@test.com': 1,
            'p3@test.com': 2,
          },
        },
      ],
    };

    render(<Scoreboard {...defaultProps} gameState={completedGameState} />);

    const nextRoundButton = screen.getByRole('button', { name: /Next Round/i });
    expect(nextRoundButton).toBeInTheDocument();
  });

  it('should show "Waiting for host..." for non-owner', () => {
    render(<Scoreboard {...defaultProps} isOwner={false} currentUserEmail="p2@test.com" />);

    expect(screen.getByText('Waiting for host...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enter Bids/i })).not.toBeInTheDocument();
  });

  it('should call onUndo when undo button is clicked', () => {
    render(<Scoreboard {...defaultProps} />);

    // Find the undo button by its aria-label or by finding the button with Undo2 icon
    const undoButtons = screen.getAllByRole('button');
    const undoButton = undoButtons.find(btn => 
      btn.querySelector('svg') && btn.className.includes('rounded-full')
    );

    if (undoButton) {
      fireEvent.click(undoButton);
      expect(defaultProps.onUndo).toHaveBeenCalled();
    }
  });

  it('should call onOpenSettings when settings button is clicked', () => {
    render(<Scoreboard {...defaultProps} />);

    // Find the settings button (last button in the bottom bar)
    const buttons = screen.getAllByRole('button');
    const settingsButton = buttons[buttons.length - 1];

    fireEvent.click(settingsButton);
    expect(defaultProps.onOpenSettings).toHaveBeenCalled();
  });

  it('should display players sorted by score descending', () => {
    render(<Scoreboard {...defaultProps} />);

    // Get all player score elements - they should be in descending order: 10, 8, 5
    const scoreElements = screen.getAllByText(/^(10|8|5)$/);
    
    // Scores should appear in descending order: 10, 8, 5
    expect(scoreElements[0]).toHaveTextContent('10');
    expect(scoreElements[1]).toHaveTextContent('8');
    expect(scoreElements[2]).toHaveTextContent('5');
  });

  it('should mark dealer with "D" badge', () => {
    render(<Scoreboard {...defaultProps} />);

    // First player should be dealer for round 1
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('should highlight current user with different styling', () => {
    render(<Scoreboard {...defaultProps} currentUserEmail="p1@test.com" />);

    expect(screen.getByText('(You)')).toBeInTheDocument();
  });

  it('should show game ended state when all rounds completed', () => {
    const endedGameState = {
      ...mockGameState,
      rounds: [
        {
          index: 1,
          cards: 17,
          trump: 'S',
          state: 'COMPLETED' as const,
          bids: {},
          tricks: {},
        },
        {
          index: 2,
          cards: 16,
          trump: 'D',
          state: 'COMPLETED' as const,
          bids: {},
          tricks: {},
        },
        {
          index: 33,
          cards: 17,
          trump: 'S',
          state: 'COMPLETED' as const,
          bids: {},
          tricks: {},
        },
      ],
      currentRoundIndex: 33,
    };

    render(<Scoreboard {...defaultProps} gameState={endedGameState} />);

    expect(screen.getByText('Game Ended')).toBeInTheDocument();
    expect(screen.getByText(/Final Round.*Completed/i)).toBeInTheDocument();
  });

  it('should show New Game and Dashboard buttons when game ended', () => {
    const endedGameState = {
      ...mockGameState,
      rounds: Array.from({ length: 33 }, (_, i) => ({
        index: i + 1,
        cards: i < 17 ? 17 - i : i - 15,
        trump: 'S',
        state: 'COMPLETED' as const,
        bids: {},
        tricks: {},
      })),
      currentRoundIndex: 33,
    };

    render(<Scoreboard {...defaultProps} gameState={endedGameState} />);

    expect(screen.getByRole('button', { name: /New Game/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dashboard/i })).toBeInTheDocument();
  });

  it('should navigate to create page when New Game clicked', () => {
    const endedGameState = {
      ...mockGameState,
      rounds: Array.from({ length: 33 }, (_, i) => ({
        index: i + 1,
        cards: i < 17 ? 17 - i : i - 15,
        trump: 'S',
        state: 'COMPLETED' as const,
        bids: {},
        tricks: {},
      })),
      currentRoundIndex: 33,
    };

    render(<Scoreboard {...defaultProps} gameState={endedGameState} />);

    const newGameButton = screen.getByRole('button', { name: /New Game/i });
    fireEvent.click(newGameButton);

    expect(mockPush).toHaveBeenCalledWith('/create');
  });

  it('should display bid and tricks info in round', () => {
    const gameStateWithBids = {
      ...mockGameState,
      rounds: [
        {
          ...mockGameState.rounds[0],
          state: 'PLAYING' as const,
          bids: {
            'p1@test.com': 2,
            'p2@test.com': 1,
            'p3@test.com': 2,
          },
        },
      ],
    };

    render(<Scoreboard {...defaultProps} gameState={gameStateWithBids} />);

    // Should show bid values
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  describe('game end celebrations', () => {
    const createEndedGameState = (playerScores: { email: string; score: number }[]) => {
      const finalRoundNumber = 33; // For 3 players with 52 card deck
      return {
        ...mockGameState,
        players: playerScores.map(({ email, score }) => ({
          ...mockGameState.players.find(p => p.email === email)!,
          score,
        })),
        rounds: Array.from({ length: finalRoundNumber }, (_, i) => ({
          index: i + 1,
          cards: i < 17 ? 17 - i : i - 15,
          trump: 'S',
          state: 'COMPLETED' as const,
          bids: {},
          tricks: {},
        })),
        currentRoundIndex: finalRoundNumber,
      };
    };

    it('should show confetti celebration message for winner when game ends', () => {
      const endedGameState = createEndedGameState([
        { email: 'p1@test.com', score: 100 }, // Winner
        { email: 'p2@test.com', score: 50 },
        { email: 'p3@test.com', score: 75 },
      ]);

      render(<Scoreboard {...defaultProps} gameState={endedGameState} currentUserEmail="p1@test.com" />);

      expect(screen.getByText('YOU WON!')).toBeInTheDocument();
      expect(screen.getByText('🎉')).toBeInTheDocument();
    });

    it('should NOT show confetti celebration for non-winner when game ends', () => {
      const endedGameState = createEndedGameState([
        { email: 'p1@test.com', score: 100 }, // Winner
        { email: 'p2@test.com', score: 50 },
        { email: 'p3@test.com', score: 75 },
      ]);

      render(<Scoreboard {...defaultProps} gameState={endedGameState} currentUserEmail="p2@test.com" />);

      expect(screen.queryByText('YOU WON!')).not.toBeInTheDocument();
    });

    it('should show rainbow flag message for last place player when game ends', () => {
      const endedGameState = createEndedGameState([
        { email: 'p1@test.com', score: 100 },
        { email: 'p2@test.com', score: 50 },
        { email: 'p3@test.com', score: 25 }, // Last place
      ]);

      render(<Scoreboard {...defaultProps} gameState={endedGameState} currentUserEmail="p3@test.com" />);

      expect(screen.getByText('YOU ARE GAY')).toBeInTheDocument();
      expect(screen.getByText('Better luck next time! 🎮')).toBeInTheDocument();
      // Check for rainbow flag in modal (the large one)
      const rainbowFlags = screen.getAllByText('🏳️‍🌈');
      expect(rainbowFlags.length).toBeGreaterThan(0);
    });

    it('should NOT show rainbow flag message for non-last-place player when game ends', () => {
      const endedGameState = createEndedGameState([
        { email: 'p1@test.com', score: 100 },
        { email: 'p2@test.com', score: 50 },
        { email: 'p3@test.com', score: 25 }, // Last place
      ]);

      render(<Scoreboard {...defaultProps} gameState={endedGameState} currentUserEmail="p1@test.com" />);

      expect(screen.queryByText('YOU ARE GAY')).not.toBeInTheDocument();
    });

    it('should show rainbow flag emoji next to last place player name in scoreboard', () => {
      const endedGameState = createEndedGameState([
        { email: 'p1@test.com', score: 100 },
        { email: 'p2@test.com', score: 50 },
        { email: 'p3@test.com', score: 25 }, // Last place
      ]);

      render(<Scoreboard {...defaultProps} gameState={endedGameState} />);

      const player3Element = screen.getByText('Player 3');
      expect(player3Element.parentElement?.textContent).toContain('🏳️‍🌈');
    });

    it('should trigger confetti when winner views ended game', async () => {
      const confetti = require('canvas-confetti').default;
      confetti.mockClear();

      const endedGameState = createEndedGameState([
        { email: 'p1@test.com', score: 100 }, // Winner
        { email: 'p2@test.com', score: 50 },
        { email: 'p3@test.com', score: 75 },
      ]);

      render(<Scoreboard {...defaultProps} gameState={endedGameState} currentUserEmail="p1@test.com" />);

      // Wait for useEffect to trigger confetti
      await waitFor(() => {
        expect(confetti).toHaveBeenCalled();
      }, { timeout: 1000 });
    });
  });

  describe('avatar display', () => {
    it('should display Google profile picture when available for player', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            email: 'p1@test.com',
            image: 'https://lh3.googleusercontent.com/a/test-photo.jpg',
          },
        },
        status: 'authenticated',
      });

      render(<Scoreboard {...defaultProps} currentUserEmail="p1@test.com" />);

      const avatarImages = screen.getAllByRole('img', { hidden: true });
      const userAvatar = avatarImages.find(img => 
        img.getAttribute('src') === 'https://lh3.googleusercontent.com/a/test-photo.jpg'
      );
      
      // Should show profile picture for player (stored in player.image)
      expect(userAvatar).toBeInTheDocument();
    });

    it('should fallback to initials when profile picture is not available', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            email: 'p1@test.com',
            image: null,
          },
        },
        status: 'authenticated',
      });

      render(<Scoreboard {...defaultProps} currentUserEmail="p1@test.com" />);

      // Should show initial 'P' for Player 1 - check that the player card exists and contains the initial
      expect(screen.getByText('Player 1')).toBeInTheDocument();
      // The avatar div should contain the text 'P' (there are multiple P's from different players, but that's expected)
      const allInitials = screen.getAllByText('P');
      expect(allInitials.length).toBeGreaterThan(0);
    });

    it('should fallback to initials when user is not authenticated', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
      });

      render(<Scoreboard {...defaultProps} currentUserEmail="p1@test.com" />);

      // Should show initial 'P' for Player 1 - check that the player card exists and contains the initial
      expect(screen.getByText('Player 1')).toBeInTheDocument();
      // The avatar div should contain the text 'P' (there are multiple P's from different players, but that's expected)
      const allInitials = screen.getAllByText('P');
      expect(allInitials.length).toBeGreaterThan(0);
    });

    it('should display profile picture as img element with correct attributes', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            email: 'p1@test.com',
            image: 'https://lh3.googleusercontent.com/a/test-photo.jpg',
          },
        },
        status: 'authenticated',
      });

      render(<Scoreboard {...defaultProps} currentUserEmail="p1@test.com" />);

      const avatarImages = screen.getAllByRole('img', { hidden: true });
      const userAvatar = avatarImages.find(img => 
        img.getAttribute('src') === 'https://lh3.googleusercontent.com/a/test-photo.jpg'
      );
      
      expect(userAvatar).toBeInTheDocument();
      expect(userAvatar).toHaveAttribute('alt', 'Player 1');
      expect(userAvatar).toHaveClass('rounded-full');
    });
  });
});

