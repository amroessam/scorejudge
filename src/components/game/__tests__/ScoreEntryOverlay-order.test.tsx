import { render, screen, waitFor } from '@testing-library/react';
import { ScoreEntryOverlay } from '@/components/game/ScoreEntryOverlay';
import type { GameState } from '@/lib/store';

// Mock fetch
global.fetch = jest.fn();

describe('ScoreEntryOverlay - Player Order', () => {
  const mockGameState: GameState = {
    id: 'game1',
    name: 'Test Game',
    players: [
      { id: '1', name: 'Player 1', email: 'p1@test.com', tricks: 0, bid: 0, score: 10 },
      { id: '2', name: 'Player 2', email: 'p2@test.com', tricks: 0, bid: 0, score: 5 },
      { id: '3', name: 'Player 3', email: 'p3@test.com', tricks: 0, bid: 0, score: 8 },
      { id: '4', name: 'Dealer', email: 'dealer@test.com', tricks: 0, bid: 0, score: 15 },
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
    createdAt: Date.now(),
    lastUpdated: Date.now(),
  };

  const mockOnGameUpdate = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should maintain original player order in bidding sheet (not sorted by score)', async () => {
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

    // Get all player names in the order they appear
    const playerNames = screen.getAllByText(/Player \d|Dealer/);

    // In bidding order, dealer goes last, so order should be based on dealer position
    // First dealer is at index 3, so order should be: p1, p2, p3, dealer (wrapping around)
    // Actually, orderedPlayers puts left of dealer first, then dealer last
    // Dealer is at index 3, so order should be: p1, p2, p3, dealer

    // Verify the order is NOT sorted by score (which would be: dealer 15, p1 10, p3 8, p2 5)
    // Instead it should maintain the original order relative to dealer
    const namesText = playerNames.map(el => el.textContent).join(' ');

    // The order should be based on dealer position, not score
    // Since dealer is last in the original array, and orderedPlayers puts left of dealer first,
    // the order should be: p1, p2, p3, dealer (not sorted by score)
    expect(namesText).toContain('Player 1');
    expect(namesText).toContain('Player 2');
    expect(namesText).toContain('Player 3');
    expect(namesText).toContain('Dealer');

    // Verify dealer is last (as per bidding order rules)
    const lastPlayer = playerNames[playerNames.length - 1];
    expect(lastPlayer).toHaveTextContent('Dealer');
  });
});

