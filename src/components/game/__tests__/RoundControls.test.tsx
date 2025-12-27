import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RoundControls } from '@/components/game/RoundControls';
import type { GameState } from '@/lib/store';

// Mock fetch
global.fetch = jest.fn();

describe('RoundControls', () => {
  const mockGameState: GameState = {
    id: 'game1',
    name: 'Test Game',
    players: [
      { id: '1', name: 'Player 1', email: 'p1@test.com', tricks: 0, bid: 0, score: 0 },
      { id: '2', name: 'Player 2', email: 'p2@test.com', tricks: 0, bid: 0, score: 0 },
      { id: '3', name: 'Player 3', email: 'p3@test.com', tricks: 0, bid: 0, score: 0 },
    ],
    rounds: [],
    currentRoundIndex: 0,
    ownerEmail: 'p1@test.com',
    operatorEmail: 'p1@test.com',
    lastUpdated: Date.now(),
  };

  const mockOnGameUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should show "Start Game" button when no rounds', () => {
    render(
      <RoundControls
        gameId="game1"
        gameState={mockGameState}
        isOperator={true}
        onGameUpdate={mockOnGameUpdate}
      />
    );

    expect(screen.getByText('Start Game')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Round 1/i })).toBeInTheDocument();
  });

  it('should disable start button if less than 3 players', () => {
    const gameStateWith2Players = {
      ...mockGameState,
      players: mockGameState.players.slice(0, 2),
    };

    render(
      <RoundControls
        gameId="game1"
        gameState={gameStateWith2Players}
        isOperator={true}
        onGameUpdate={mockOnGameUpdate}
      />
    );

    const startButton = screen.getByRole('button', { name: /Start Round 1/i });
    expect(startButton).toBeDisabled();
    expect(screen.getByText(/Need 1 more player/i)).toBeInTheDocument();
  });

  it('should show "Waiting for operator..." message for non-operators', () => {
    render(
      <RoundControls
        gameId="game1"
        gameState={mockGameState}
        isOperator={false}
        onGameUpdate={mockOnGameUpdate}
      />
    );

    expect(screen.getByText('Waiting for operator...')).toBeInTheDocument();
  });

  it('should show bid inputs when round is in BIDDING state', () => {
    const gameStateWithRounds = {
      ...mockGameState,
      rounds: [
        {
          index: 1,
          cards: 5,
          trump: 'S',
          state: 'BIDDING' as const,
          bids: {},
          tricks: {},
        },
      ],
      currentRoundIndex: 1,
    };

    render(
      <RoundControls
        gameId="game1"
        gameState={gameStateWithRounds}
        isOperator={true}
        onGameUpdate={mockOnGameUpdate}
      />
    );

    expect(screen.getByText('Round 1 • Bids')).toBeInTheDocument();
    expect(screen.getByText('Cards: 5')).toBeInTheDocument();
    expect(screen.getByText(/Trump:.*Spades/i)).toBeInTheDocument();
    
    // Should have input fields for each player
    const inputs = screen.getAllByPlaceholderText('Bid');
    expect(inputs).toHaveLength(3);
  });

  it('should show check/X buttons when round is in PLAYING state', () => {
    const gameStateWithPlaying = {
      ...mockGameState,
      rounds: [
        {
          index: 1,
          cards: 5,
          trump: 'S',
          state: 'PLAYING' as const,
          bids: {
            'p1@test.com': 2,
            'p2@test.com': 1,
            'p3@test.com': 2,
          },
          tricks: {},
        },
      ],
      currentRoundIndex: 1,
    };

    render(
      <RoundControls
        gameId="game1"
        gameState={gameStateWithPlaying}
        isOperator={true}
        onGameUpdate={mockOnGameUpdate}
      />
    );

    expect(screen.getByText('Round 1 • Tricks')).toBeInTheDocument();
    
    // Each player should have check and X buttons
    const buttons = screen.getAllByRole('button');
    const checkButtons = buttons.filter(btn => btn.title === 'Made bid (tricks = bid)');
    const xButtons = buttons.filter(btn => btn.title === 'Missed bid');
    
    expect(checkButtons.length).toBe(3);
    expect(xButtons.length).toBe(3);
  });

  it('should send START action when start button clicked', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(
      <RoundControls
        gameId="game1"
        gameState={mockGameState}
        isOperator={true}
        onGameUpdate={mockOnGameUpdate}
      />
    );

    const startButton = screen.getByRole('button', { name: /Start Round 1/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/games/game1/rounds',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ action: 'START' }),
        })
      );
    });
  });

  it('should validate dealer constraint when saving bids', async () => {
    const gameStateWithBidding = {
      ...mockGameState,
      rounds: [
        {
          index: 1,
          cards: 5,
          trump: 'S',
          state: 'BIDDING' as const,
          bids: {},
          tricks: {},
        },
      ],
      currentRoundIndex: 1,
    };

    // Mock window.alert
    const alertMock = jest.spyOn(window, 'alert').mockImplementation();

    render(
      <RoundControls
        gameId="game1"
        gameState={gameStateWithBidding}
        isOperator={true}
        onGameUpdate={mockOnGameUpdate}
      />
    );

    // Fill in bids that sum to 5 (dealer constraint violation)
    const inputs = screen.getAllByPlaceholderText('Bid');
    fireEvent.change(inputs[0], { target: { value: '2' } });
    fireEvent.change(inputs[1], { target: { value: '1' } });
    fireEvent.change(inputs[2], { target: { value: '2' } }); // Dealer

    const saveButton = screen.getByRole('button', { name: /Save Bids/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(
        expect.stringContaining('Dealer')
      );
    });

    alertMock.mockRestore();
  });

  it('should allow valid bids submission', async () => {
    const gameStateWithBidding = {
      ...mockGameState,
      rounds: [
        {
          index: 1,
          cards: 5,
          trump: 'S',
          state: 'BIDDING' as const,
          bids: {},
          tricks: {},
        },
      ],
      currentRoundIndex: 1,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, game: gameStateWithBidding }),
    });

    render(
      <RoundControls
        gameId="game1"
        gameState={gameStateWithBidding}
        isOperator={true}
        onGameUpdate={mockOnGameUpdate}
      />
    );

    // Fill in valid bids (sum ≠ 5)
    const inputs = screen.getAllByPlaceholderText('Bid');
    fireEvent.change(inputs[0], { target: { value: '2' } });
    fireEvent.change(inputs[1], { target: { value: '1' } });
    fireEvent.change(inputs[2], { target: { value: '1' } }); // Dealer, sum = 4

    const saveButton = screen.getByRole('button', { name: /Save Bids/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/games/game1/rounds',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('BIDS'),
        })
      );
    });
  });

  it('should show game ended message when final round completed', () => {
    const gameStateEnded = {
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

    render(
      <RoundControls
        gameId="game1"
        gameState={gameStateEnded}
        isOperator={true}
        onGameUpdate={mockOnGameUpdate}
      />
    );

    expect(screen.getByText('Game Ended')).toBeInTheDocument();
    expect(screen.getByText(/Final round.*has been completed/i)).toBeInTheDocument();
  });

  it('should display dealer indicator', () => {
    const gameStateWithBidding = {
      ...mockGameState,
      rounds: [
        {
          index: 1,
          cards: 5,
          trump: 'S',
          state: 'BIDDING' as const,
          bids: {},
          tricks: {},
        },
      ],
      currentRoundIndex: 1,
    };

    render(
      <RoundControls
        gameId="game1"
        gameState={gameStateWithBidding}
        isOperator={true}
        onGameUpdate={mockOnGameUpdate}
      />
    );

    expect(screen.getByText(/Dealer:.*Player 1/i)).toBeInTheDocument();
  });

  it('should display final scores when game ended', () => {
    const gameStateEnded = {
      ...mockGameState,
      players: [
        { id: '1', name: 'Winner', email: 'p1@test.com', tricks: 0, bid: 0, score: 100 },
        { id: '2', name: 'Second', email: 'p2@test.com', tricks: 0, bid: 0, score: 80 },
        { id: '3', name: 'Third', email: 'p3@test.com', tricks: 0, bid: 0, score: 60 },
      ],
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

    render(
      <RoundControls
        gameId="game1"
        gameState={gameStateEnded}
        isOperator={true}
        onGameUpdate={mockOnGameUpdate}
      />
    );

    expect(screen.getByText('Final Scores:')).toBeInTheDocument();
    // Winner text is part of the trophy emoji text node
    expect(screen.getByText((content, element) => {
      return element?.textContent === '🏆 Winner' || false;
    })).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });
});

