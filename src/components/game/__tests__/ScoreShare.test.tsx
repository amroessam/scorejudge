import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ScoreShareOverlay } from '../ScoreShareOverlay';

// Mock html2canvas since it doesn't work in JSDOM
jest.mock('html2canvas', () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve({ toDataURL: () => 'data:image/png;base64,fake' }))
}));

describe('ScoreShareOverlay', () => {
  const mockPlayers = [
    { id: '1', name: 'Player One', email: 'p1@test.com', score: 100, tricks: 0, bid: 0 },
    { id: '2', name: 'Player Two', email: 'p2@test.com', score: 80, tricks: 0, bid: 0 },
    { id: '3', name: 'Player Three', email: 'p3@test.com', score: 60, tricks: 0, bid: 0 },
    { id: '4', name: 'Player Four', email: 'p4@test.com', score: 40, tricks: 0, bid: 0 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly when open', () => {
    render(
      <ScoreShareOverlay
        isOpen={true}
        onClose={() => { }}
        players={mockPlayers}
        gameName="Test Game"
      />
    );

    // Should appear in header
    expect(screen.getByText('Share Results', { selector: 'h3' })).toBeInTheDocument();
    // Share button should say "Share Image"
    expect(screen.getByText('Share Image', { selector: 'button' })).toBeInTheDocument();

    // Game name and players should be in the image URL
    const previewImg = screen.getByAltText('Result Preview') as HTMLImageElement;
    expect(previewImg).toBeInTheDocument();
    expect(previewImg.src).toContain('name=Test+Game');
    expect(previewImg.src).toContain('Player+One');
  });

  it('does not render when closed', () => {
    render(
      <ScoreShareOverlay
        isOpen={false}
        onClose={() => { }}
        players={mockPlayers}
        gameName="Test Game"
      />
    );

    expect(screen.queryByText('Share Results')).not.toBeInTheDocument();
  });

  it('triggers capture and share when button is clicked', async () => {
    const mockShare = jest.fn(() => Promise.resolve());
    const mockCanShare = jest.fn(() => true);

    // Polyfill navigator APIs for testing
    Object.defineProperty(global.navigator, 'share', {
      value: mockShare,
      configurable: true,
      writable: true
    });
    Object.defineProperty(global.navigator, 'canShare', {
      value: mockCanShare,
      configurable: true,
      writable: true
    });

    // Mock fetch for image blob conversion
    global.fetch = jest.fn(() =>
      Promise.resolve({
        blob: () => Promise.resolve(new Blob(['fake'], { type: 'image/png' }))
      })
    ) as jest.Mock;

    render(
      <ScoreShareOverlay
        isOpen={true}
        onClose={() => { }}
        players={mockPlayers}
        gameName="Test Game"
      />
    );

    const shareButton = screen.getByText('Share Image', { selector: 'button' });

    await act(async () => {
      fireEvent.click(shareButton);
      // Wait for the internal promises (timeouts and capture)
      await new Promise(resolve => setTimeout(resolve, 1200));
    });

    expect(mockShare).toHaveBeenCalled();

    // Cleanup fetch
    delete (global as any).fetch;
  });
});
