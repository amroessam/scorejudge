import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ScoreEntryOverlay } from '@/components/game/ScoreEntryOverlay';
import type { GameState } from '@/lib/store';

// Mock fetch
global.fetch = jest.fn();

describe('ScoreEntryOverlay - Dealer Bid Hint', () => {
  const mockGameState: GameState = {
    id: 'game1',
    name: 'Test Game',
    players: [
      { id: '1', name: 'Player 1', email: 'p1@test.com', tricks: 0, bid: 0, score: 0 },
      { id: '2', name: 'Player 2', email: 'p2@test.com', tricks: 0, bid: 0, score: 0 },
      { id: '3', name: 'Player 3', email: 'p3@test.com', tricks: 0, bid: 0, score: 0 },
      { id: '4', name: 'Dealer', email: 'dealer@test.com', tricks: 0, bid: 0, score: 0 },
    ],
    rounds: [
      {
        index: 1,
        cards: 3,
        trump: 'S',
        state: 'BIDDING',
        bids: {},
        tricks: {},
      },
    ],
    currentRoundIndex: 1,
    ownerEmail: 'p1@test.com',
    firstDealerEmail: 'dealer@test.com',
    lastUpdated: Date.now(),
  };

  const mockOnGameUpdate = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should show valid dealer bids next to dealer input when entering bids', async () => {
    render(
      <ScoreEntryOverlay
        isOpen={true}
        onClose={mockOnClose}
        gameId="game1"
        gameState={mockGameState}
        onGameUpdate={mockOnGameUpdate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Enter Bids/i)).toBeInTheDocument();
    });

    // Should show valid bid numbers (0, 1, 2) as clickable buttons next to dealer
    // Invalid bid would be 3 (would make total = 3)
    expect(screen.getByText('Valid:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
  });

  it('should update valid dealer bids when other players enter bids', async () => {
    render(
      <ScoreEntryOverlay
        isOpen={true}
        onClose={mockOnClose}
        gameId="game1"
        gameState={mockGameState}
        onGameUpdate={mockOnGameUpdate}
      />
    );

    // Wait for overlay to be fully rendered
    await waitFor(() => {
      expect(screen.getByText(/Enter Bids/i)).toBeInTheDocument();
    });

    // Initially should show valid bids: 0, 1, 2 (not 3)
    expect(screen.getByRole('button', { name: '0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();

    // Find all number inputs (bids)
    const inputs = screen.getAllByRole('spinbutton');
    
    // Enter bids for non-dealer players (first 3 players)
    if (inputs[0]) fireEvent.change(inputs[0], { target: { value: '1' } });
    if (inputs[1]) fireEvent.change(inputs[1], { target: { value: '1' } });
    if (inputs[2]) fireEvent.change(inputs[2], { target: { value: '0' } });

    // Should update valid bids (cardsPerPlayer = 3, sum of others = 2, so dealer can bid 0, 2, or 3, but NOT 1 because 2+1=3)
    // Valid bids: 0, 2, 3 (anything except 1)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '0' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
      // Should not show bid 1
      const bid1Buttons = screen.queryAllByRole('button', { name: '1' });
      // Only the input field should have value 1, not a valid bid button
      expect(bid1Buttons.length).toBeLessThanOrEqual(1);
    });
  });

  it('should allow clicking valid bid numbers to set dealer bid', async () => {
    render(
      <ScoreEntryOverlay
        isOpen={true}
        onClose={mockOnClose}
        gameId="game1"
        gameState={mockGameState}
        onGameUpdate={mockOnGameUpdate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Enter Bids/i)).toBeInTheDocument();
    });

    // Find the valid bid button for 2
    const bid2Button = screen.getByRole('button', { name: '2' });
    fireEvent.click(bid2Button);

    // The dealer's input should now have value 2
    const inputs = screen.getAllByRole('spinbutton');
    const dealerInput = inputs[inputs.length - 1]; // Dealer is last
    expect(dealerInput).toHaveValue(2);
  });

  it('should not show valid bids when entering tricks', () => {
    const tricksGameState = {
      ...mockGameState,
      rounds: [
        {
          index: 1,
          cards: 3,
          trump: 'S',
          state: 'PLAYING',
          bids: {
            'p1@test.com': 1,
            'p2@test.com': 1,
            'p3@test.com': 0,
            'dealer@test.com': 1,
          },
          tricks: {},
        },
      ],
    };

    render(
      <ScoreEntryOverlay
        isOpen={true}
        onClose={mockOnClose}
        gameId="game1"
        gameState={tricksGameState}
        onGameUpdate={mockOnGameUpdate}
      />
    );

    expect(screen.getByText(/Enter Tricks/i)).toBeInTheDocument();
    // Should not show valid bids when entering tricks
    expect(screen.queryByText('Valid:')).not.toBeInTheDocument();
  });
});

describe('ScoreEntryOverlay - Game End', () => {
  // Mock window.alert to catch any alerts
  const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    alertMock.mockClear();
  });

  afterAll(() => {
    alertMock.mockRestore();
  });

    it('should NOT show alert when final round is completed - should update game state instead', async () => {
        // Create a game state where we're completing the final round (round 3 for 3 players with 6 card deck)
        // For 3 players with 6 card deck: floor(6/3) = 2, so 2*2-1 = 3
        const finalRoundNumber = 3;
        const cardsInFinalRound = 1; // Final round has 1 card per player
        const finalRoundGameState: GameState = {
            id: 'game1',
            name: 'Test Game',
            players: [
                { id: '1', name: 'Player 1', email: 'p1@test.com', tricks: 0, bid: 0, score: 10 },
                { id: '2', name: 'Player 2', email: 'p2@test.com', tricks: 0, bid: 0, score: 5 },
                { id: '3', name: 'Player 3', email: 'p3@test.com', tricks: 0, bid: 0, score: 8 },
            ],
            rounds: [
                {
                    index: 1,
                    cards: 2,
                    trump: 'S',
                    state: 'COMPLETED',
                    bids: { 'p1@test.com': 1, 'p2@test.com': 0, 'p3@test.com': 0 },
                    tricks: { 'p1@test.com': 1, 'p2@test.com': 0, 'p3@test.com': 0 },
                },
                {
                    index: 2,
                    cards: 1,
                    trump: 'D',
                    state: 'COMPLETED',
                    bids: { 'p1@test.com': 0, 'p2@test.com': 1, 'p3@test.com': 0 },
                    tricks: { 'p1@test.com': 0, 'p2@test.com': 1, 'p3@test.com': 0 },
                },
                {
                    index: finalRoundNumber,
                    cards: cardsInFinalRound,
                    trump: 'C',
                    state: 'PLAYING',
                    bids: { 'p1@test.com': 0, 'p2@test.com': 0, 'p3@test.com': 1 },
                    tricks: {},
                },
            ],
            currentRoundIndex: finalRoundNumber,
            ownerEmail: 'p1@test.com',
            lastUpdated: Date.now(),
        };

        const mockOnGameUpdate = jest.fn();
        const mockOnClose = jest.fn();

        // Mock successful API response with game ended state
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                game: {
                    ...finalRoundGameState,
                    rounds: finalRoundGameState.rounds.map((r, i) => 
                        i === finalRoundGameState.rounds.length - 1 
                            ? { ...r, state: 'COMPLETED' as const, tricks: { 'p1@test.com': 0, 'p2@test.com': 0, 'p3@test.com': 1 } }
                            : r
                    ),
                },
            }),
        });

        render(
            <ScoreEntryOverlay
                isOpen={true}
                onClose={mockOnClose}
                gameId="game1"
                gameState={finalRoundGameState}
                onGameUpdate={mockOnGameUpdate}
            />
        );

        // Wait for overlay to render
        await waitFor(() => {
            expect(screen.getByText(/Enter Tricks/i)).toBeInTheDocument();
        });

        // Mark players: p1 and p2 missed (X), p3 made (checkmark)
        const checkButtons = screen.getAllByTitle('Made bid');
        const missButtons = screen.getAllByTitle('Missed bid');
        
        // Click miss for p1 and p2, check for p3
        fireEvent.click(missButtons[0]); // p1
        fireEvent.click(missButtons[1]); // p2
        fireEvent.click(checkButtons[2]); // p3

        // Submit tricks
        const submitButton = screen.getByText(/Confirm Scores/i);
        fireEvent.click(submitButton);

        // Wait for API call and state update
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled();
        });

        // Wait for game state update (should happen immediately for game end)
        await waitFor(() => {
            expect(mockOnGameUpdate).toHaveBeenCalled();
        }, { timeout: 2000 });

        // Wait for overlay to close (happens after 100ms delay for game end)
        await waitFor(() => {
            expect(mockOnClose).toHaveBeenCalled();
        }, { timeout: 500 });

        // Verify NO alert was shown
        expect(alertMock).not.toHaveBeenCalled();

        // Verify game state was updated with completed final round
        const updatedGame = mockOnGameUpdate.mock.calls[0]?.[0];
        expect(updatedGame).toBeDefined();
        const finalRound = updatedGame.rounds.find((r: any) => r.index === finalRoundNumber);
        expect(finalRound?.state).toBe('COMPLETED');
    });
});

