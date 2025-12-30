import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('renders correctly when open', () => {
    render(
      <ScoreShareOverlay 
        isOpen={true} 
        onClose={() => {}} 
        players={mockPlayers} 
        gameName="Test Game" 
      />
    );
    
    // Should appear in header and on button
    expect(screen.getAllByText('Share Results')).toHaveLength(2);
    expect(screen.getByText('Test Game')).toBeInTheDocument();
    expect(screen.getByText('Player One')).toBeInTheDocument();
    expect(screen.getByText('Player Two')).toBeInTheDocument();
    expect(screen.getByText('Player Three')).toBeInTheDocument();
    expect(screen.getByText('Player Four')).toBeInTheDocument();
    
    // Check for medals/emojis
    expect(screen.getByText('🥇')).toBeInTheDocument();
    expect(screen.getByText('🥈')).toBeInTheDocument();
    expect(screen.getByText('🥉')).toBeInTheDocument();
    // Last player gets rainbow flag
    expect(screen.getByText('🏳️‍🌈')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <ScoreShareOverlay 
        isOpen={false} 
        onClose={() => {}} 
        players={mockPlayers} 
        gameName="Test Game" 
      />
    );
    
    expect(screen.queryByText('Share Results')).not.toBeInTheDocument();
  });
});

