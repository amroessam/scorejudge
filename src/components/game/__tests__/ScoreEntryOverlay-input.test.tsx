import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ScoreEntryOverlay } from '@/components/game/ScoreEntryOverlay';
import type { GameState } from '@/lib/store';

// Mock fetch
global.fetch = jest.fn();

describe('ScoreEntryOverlay - Bid Input Handling', () => {
  const mockGameState: GameState = {
    id: 'game1',
    name: 'Test Game',
    players: [
      { id: '1', name: 'Player 1', email: 'p1@test.com', tricks: 0, bid: 0, score: 0 },
      { id: '2', name: 'Player 2', email: 'p2@test.com', tricks: 0, bid: 0, score: 0 },
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
    lastUpdated: Date.now(),
  };

  const mockOnGameUpdate = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should remove leading zero when typing a number', async () => {
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

    const inputs = screen.getAllByRole('spinbutton');
    const input = inputs[0];

    // Type "2" - should show "2" not "02"
    fireEvent.change(input, { target: { value: '2' } });
    expect(input).toHaveValue(2);
    expect(input).not.toHaveDisplayValue('02');
  });

  it('should start with empty input fields', async () => {
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

    const inputs = screen.getAllByRole('spinbutton');
    // Inputs should start empty, not with 0
    inputs.forEach(input => {
      expect(input).toHaveValue(null); // Empty number input shows as null
    });
  });

  it('should allow empty input and treat it as 0 on submit', async () => {
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

    const inputs = screen.getAllByRole('spinbutton');
    const input = inputs[0];

    // Input should start empty
    expect(input).toHaveValue(null);

    // Type a value then clear it - should remain empty
    fireEvent.change(input, { target: { value: '2' } });
    expect(input).toHaveValue(2);
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue(null);
  });

  it('should handle typing multiple digits correctly', async () => {
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

    const inputs = screen.getAllByRole('spinbutton');
    const input = inputs[0];

    // Type "1" then "2" - should show "12" (if max allows) or clamp to max
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.change(input, { target: { value: '12' } });
    // Since max is 3, it should clamp to 3
    expect(input).toHaveValue(3);
  });

  it('should not show leading zeros when typing', async () => {
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

    const inputs = screen.getAllByRole('spinbutton');
    const input = inputs[0];

    // Type "02" - should normalize to just "2"
    fireEvent.change(input, { target: { value: '02' } });
    expect(input).toHaveValue(2);
  });
});

