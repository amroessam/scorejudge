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

  it('should open cropper when image is selected for upload', async () => {
    const { container } = render(<GameSetup {...defaultProps} currentUserEmail="p1@test.com" />);

    // Hidden file input should be present
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    // Simulate file selection with FileReader mock
    const file = new File(['(⌐□_□)'], 'new_avatar.png', { type: 'image/png' });

    // Mock FileReader that triggers callback synchronously
    const mockFileReaderInstance = {
      readAsDataURL: jest.fn(function(this: any) {
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

  it('should toggle dealer when owner clicks OTHER player avatar', () => {
    render(<GameSetup {...defaultProps} currentUserEmail="p1@test.com" />);

    // Find avatar for Player 2 (Not current user)
    // Player 2 has no image, so it renders a div with 'P' (from initials)
    // We need to find the specific container
    const player2Container = screen.getByText('Player 2').closest('.bg-\\[var\\(--card\\)\\]');
    // Find the avatar inside this container. It's the div with class 'relative group cursor-pointer'
    const avatarContainer = player2Container?.querySelector('.relative.group.cursor-pointer');
    
    expect(avatarContainer).toBeInTheDocument();
    
    if (avatarContainer) {
        fireEvent.click(avatarContainer);
        
        // Should trigger API call to set dealer
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/games/game1'),
            expect.objectContaining({
                method: 'PATCH',
                body: expect.stringContaining('firstDealerEmail'),
            })
        );
    }
  });

  it('should NOT toggle dealer when owner clicks OWN avatar', () => {
      // This is because clicking own avatar should trigger image upload
      render(<GameSetup {...defaultProps} currentUserEmail="p1@test.com" />);
      
      const avatar = screen.getByAltText('Player 1');
      const avatarContainer = avatar.closest('.group');
      
      if (avatarContainer) {
          fireEvent.click(avatarContainer);
          
          // Should NOT trigger API call to set dealer (which targets /api/games/game1 PATCH)
          // It MIGHT trigger image upload if we continued, but we're checking it DOESN'T set dealer
          expect(global.fetch).not.toHaveBeenCalledWith(
              expect.stringContaining('/api/games/game1'),
              expect.objectContaining({
                  body: expect.stringContaining('firstDealerEmail'),
              })
          );
      }
  });
  
  it('should show explicit "Make First Dealer" button for owner on own card', () => {
      render(<GameSetup {...defaultProps} currentUserEmail="p1@test.com" />);
      
      const makeDealerButtons = screen.getAllByText('Make First Dealer');
      // Should exist for multiple players, let's click the first one (Player 1's)
      expect(makeDealerButtons.length).toBeGreaterThan(0);
      
      fireEvent.click(makeDealerButtons[0]);
      
      // Should trigger API call to set dealer
      expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/games/game1'),
          expect.objectContaining({
              method: 'PATCH',
              body: expect.stringContaining('"firstDealerEmail":"p1@test.com"'),
          })
      );
  });
});

