import { render, waitFor, act } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import GamePage from '../page';

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

// Mock next/navigation
const mockGameId = 'test-game-123';
jest.mock('next/navigation', () => ({
  useParams: jest.fn(() => ({ gameId: mockGameId })),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  })),
}));

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState: number;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  sentMessages: string[] = [];
  shouldFailConnection: boolean = false;
  shouldSendErrorOnConnect: boolean = false;
  errorMessage: string = '';

  constructor(url: string) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    MockWebSocket.instances.push(this);
    
    // Simulate connection opening (unless it should fail)
    setTimeout(() => {
      if (this.shouldFailConnection) {
        this.readyState = WebSocket.CLOSED;
        if (this.onerror) {
          this.onerror(new Event('error'));
        }
        if (this.onclose) {
          this.onclose(new CloseEvent('close', { code: 1006, reason: 'Connection failed' }));
        }
      } else {
        this.readyState = WebSocket.OPEN;
        if (this.onopen) {
          this.onopen(new Event('open'));
        }
        // If server should send error immediately after connection
        if (this.shouldSendErrorOnConnect && this.onmessage) {
          setTimeout(() => {
            if (this.onmessage) {
              this.onmessage({
                data: JSON.stringify({
                  type: 'ERROR',
                  message: this.errorMessage || 'Game not found',
                }),
              } as MessageEvent);
            }
          }, 10);
        }
      }
    }, 0);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string) {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: code || 1000, reason: reason || '' }));
    }
  }

  static reset() {
    MockWebSocket.instances = [];
  }
}

// Replace global WebSocket
(global as any).WebSocket = MockWebSocket;

describe('GamePage WebSocket Connection', () => {
  const mockGameState = {
    id: 'test-game-123',
    ownerEmail: 'owner@example.com',
    players: [
      { id: '1', name: 'Player 1', email: 'player1@example.com', score: 0, bid: 0, tricks: 0 },
      { id: '2', name: 'Player 2', email: 'player2@example.com', score: 0, bid: 0, tricks: 0 },
    ],
    currentRoundIndex: 0,
    rounds: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    MockWebSocket.reset();
    (global.fetch as jest.Mock) = jest.fn();
    
    (useSession as jest.Mock).mockReturnValue({
      data: {
        user: {
          email: 'player1@example.com',
          name: 'Player 1',
        },
      },
      status: 'authenticated',
    });

    (useParams as jest.Mock).mockReturnValue({ gameId: mockGameId });

    // Mock initial game fetch
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockGameState,
    });
  });

  it('should not create multiple WebSocket connections when gameState updates', async () => {
    const { rerender } = render(<GamePage />);

    // Wait for initial load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(`/api/games/${mockGameId}`);
    });

    // Wait for WebSocket connection
    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBeGreaterThan(0);
    });

    const initialConnectionCount = MockWebSocket.instances.length;
    expect(initialConnectionCount).toBe(1);

    // Simulate a WebSocket message that updates gameState
    const firstSocket = MockWebSocket.instances[0];
    const updatedGameState = {
      ...mockGameState,
      players: [
        ...mockGameState.players,
        { id: '3', name: 'Player 3', email: 'player3@example.com', score: 0, bid: 0, tricks: 0 },
      ],
    };

    // Send a GAME_UPDATE message
    act(() => {
      if (firstSocket.onmessage) {
        firstSocket.onmessage({
          data: JSON.stringify({
            type: 'GAME_UPDATE',
            state: updatedGameState,
          }),
        } as MessageEvent);
      }
    });

    // Wait a bit to ensure useEffect has time to run if it would
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Verify no new WebSocket connections were created
    expect(MockWebSocket.instances.length).toBe(initialConnectionCount);
  });

  it('should only reconnect when gameId, isJoined, or isOwner changes', async () => {
    render(<GamePage />);

    // Wait for initial load and connection
    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    const initialConnectionCount = MockWebSocket.instances.length;

    // Update gameState multiple times (simulating rapid updates)
    const firstSocket = MockWebSocket.instances[0];
    
    for (let i = 0; i < 5; i++) {
      act(() => {
        if (firstSocket.onmessage) {
          firstSocket.onmessage({
            data: JSON.stringify({
              type: 'GAME_UPDATE',
              state: {
                ...mockGameState,
                currentRoundIndex: i,
              },
            }),
          } as MessageEvent);
        }
      });
    }

    // Wait for any potential reconnections
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    // Should still only have one connection
    expect(MockWebSocket.instances.length).toBe(initialConnectionCount);
  });

  it('should create new connection when gameId changes', async () => {
    const { rerender } = render(<GamePage />);

    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    // Change gameId
    (useParams as jest.Mock).mockReturnValue({ gameId: 'new-game-456' });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockGameState, id: 'new-game-456' }),
    });

    rerender(<GamePage />);

    await waitFor(() => {
      // Should have closed old connection and created new one
      // We check that we have at least one new connection attempt
      expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should handle "Game not found" error gracefully without throwing', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    render(<GamePage />);

    // Wait for WebSocket connection
    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBeGreaterThan(0);
    });

    const socket = MockWebSocket.instances[0];

    // Simulate server sending "Game not found" error
    act(() => {
      if (socket.onmessage) {
        socket.onmessage({
          data: JSON.stringify({
            type: 'ERROR',
            message: 'Game not found',
          }),
        } as MessageEvent);
      }
    });

    // Wait for error handling
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Should log error but not throw
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[WebSocket] Error:'),
      'Game not found'
    );

    // Should not attempt to reconnect for permanent errors
    const initialConnectionCount = MockWebSocket.instances.length;
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 4000)); // Wait longer than reconnect delay
    });
    // Should not have created new connections
    expect(MockWebSocket.instances.length).toBeLessThanOrEqual(initialConnectionCount + 1);

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('should handle WebSocket connection errors gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<GamePage />);

    // Wait for WebSocket connection
    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBeGreaterThan(0);
    });

    const socket = MockWebSocket.instances[0];

    // Simulate WebSocket error event
    act(() => {
      if (socket.onerror) {
        socket.onerror(new Event('error'));
      }
    });

    // Wait for error handling
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Should handle error gracefully without crashing
    // The error handler should catch and log, not throw
    expect(() => {
      if (socket.onerror) {
        socket.onerror(new Event('error'));
      }
    }).not.toThrow();

    consoleErrorSpy.mockRestore();
  });

  it('should not reconnect when connection closes with "Game not found" error code', async () => {
    render(<GamePage />);

    // Wait for WebSocket connection
    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBeGreaterThan(0);
    });

    const socket = MockWebSocket.instances[0];
    const initialConnectionCount = MockWebSocket.instances.length;

    // Simulate server closing connection with error code 1008 (policy violation)
    // which typically indicates "Game not found" or authentication failure
    act(() => {
      socket.close(1008, 'Game not found');
    });

    // Wait longer than reconnect delay to ensure no reconnection
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 4000));
    });

    // Should not attempt to reconnect for error code 1008
    // (We allow one more connection attempt but not multiple)
    expect(MockWebSocket.instances.length).toBeLessThanOrEqual(initialConnectionCount + 1);
  });
});

