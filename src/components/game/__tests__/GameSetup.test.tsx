import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GameSetup } from '@/components/game/GameSetup';
import type { GameState } from '@/lib/store';

// Mock dnd-kit
jest.mock('@dnd-kit/core', () => ({
  ...jest.requireActual('@dnd-kit/core'),
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useSensor: jest.fn(),
  useSensors: jest.fn(),
  PointerSensor: jest.fn(),
  KeyboardSensor: jest.fn(),
}));

jest.mock('@dnd-kit/sortable', () => ({
  ...jest.requireActual('@dnd-kit/sortable'),
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

// Mock fetch
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

describe('GameSetup', () => {
  const mockGameState: GameState = {
    id: 'game1',
    name: 'Test Game',
    players: [
      { id: '1', name: 'Player 1', email: 'p1@test.com', tricks: 0, bid: 0, score: 0, image: 'old-image.jpg' },
      { id: '2', name: 'Player 2', email: 'p2@test.com', tricks: 0, bid: 0, score: 0 },
      { id: '3', name: 'Player 3', email: 'p3@test.com', tricks: 0, bid: 0, score: 0 },
    ],
    rounds: [],
    currentRoundIndex: 0,
    ownerEmail: 'p1@test.com',
    createdAt: Date.now(),
    lastUpdated: Date.now(),
  };

  const defaultProps = {
    gameId: 'game1',
    gameState: mockGameState,
    isOwner: true,
    isJoined: true,
    currentUserEmail: 'p1@test.com',
    onGameUpdate: jest.fn(),
    onJoin: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });


  it('should change dealer when owner clicks OTHER player avatar', () => {
    render(<GameSetup {...defaultProps} currentUserEmail="p1@test.com" />);

    // Find avatar for Player 2 (Not current user)
    const player2Container = screen.getByText('Player 2').closest('.bg-\\[var\\(--card\\)\\]');
    const avatarContainer = player2Container?.querySelector('.relative.group.cursor-pointer');

    expect(avatarContainer).toBeInTheDocument();

    if (avatarContainer) {
      fireEvent.click(avatarContainer);

      // Should trigger API call to set dealer to Player 2
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/games/game1'),
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('"firstDealerEmail":"p2@test.com"'),
        })
      );
    }
  });

  it('should NOT change dealer when owner clicks OWN avatar', () => {
    render(<GameSetup {...defaultProps} currentUserEmail="p1@test.com" />);

    const avatar = screen.getByAltText('Player 1');
    const avatarContainer = avatar.closest('.group');

    if (avatarContainer) {
      fireEvent.click(avatarContainer);

      // Should NOT trigger API call to set dealer
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/games/game1'),
        expect.objectContaining({
          body: expect.stringContaining('firstDealerEmail'),
        })
      );
    }
  });

  it('should not show upload icon on current user avatar', () => {
    const { container } = render(<GameSetup {...defaultProps} currentUserEmail="p1@test.com" />);
    // The Upload icon (from lucide-react) would render an svg with specific classes or a data-testid if we had one.
    // Since we're just checking for the absence of the UI, we can check for the lack of the hover overlay.
    const uploadOverlay = container.querySelector('.bg-black\\/40');
    expect(uploadOverlay).not.toBeInTheDocument();
  });

  it('should auto-select first player as dealer (no explicit button needed)', () => {
    // No explicit firstDealerEmail set - first player should be the default dealer
    const gameStateNoDealer = { ...mockGameState, firstDealerEmail: undefined };
    render(<GameSetup {...defaultProps} gameState={gameStateNoDealer} currentUserEmail="p1@test.com" />);

    // First player should show "First Dealer" label
    expect(screen.getByText('First Dealer')).toBeInTheDocument();

    // There should be NO "Make First Dealer" buttons
    expect(screen.queryByText('Make First Dealer')).not.toBeInTheDocument();
  });

  it('should show "First Dealer" label on explicitly set dealer', () => {
    const gameStateWithDealer = { ...mockGameState, firstDealerEmail: 'p2@test.com' };
    render(<GameSetup {...defaultProps} gameState={gameStateWithDealer} currentUserEmail="p1@test.com" />);

    // Player 2 should show "First Dealer" label
    expect(screen.getByText('First Dealer')).toBeInTheDocument();
  });
});

