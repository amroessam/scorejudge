import { render, screen, waitFor } from '@testing-library/react';
import Dashboard from '../page';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

// Mock next/navigation
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

describe('Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: mockReplace,
    });
  });

  it('should redirect to sign in when user is not authenticated', async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/api/auth/signin?callbackUrl=%2Fdashboard');
    });
  });

  it('should redirect to sign in when session is null and status is not loading', async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/api/auth/signin?callbackUrl=%2Fdashboard');
    });
  });

  it('should not redirect when user is authenticated', () => {
    (useSession as jest.Mock).mockReturnValue({
      data: {
        user: {
          email: 'test@example.com',
          name: 'Test User',
        },
      },
      status: 'authenticated',
    });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'test@example.com', name: 'Test User' }),
      });

    render(<Dashboard />);

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should show dashboard content when authenticated', async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: {
        user: {
          email: 'test@example.com',
          name: 'Test User',
        },
      },
      status: 'authenticated',
    });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'test@example.com', name: 'Test User' }),
      });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/SCOREJUDGE/i)).toBeInTheDocument();
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });
});

