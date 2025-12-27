import { parseGameStateFromSheet, fetchGameFromSheet } from '@/lib/game-logic';
import { google } from 'googleapis';

// Mock googleapis
jest.mock('googleapis', () => ({
  google: {
    sheets: jest.fn(),
  },
}));

describe('game-logic', () => {
  describe('parseGameStateFromSheet', () => {
    it('should parse basic game state with minimal data', () => {
      const sheetData = {
        valueRanges: [
          // Game sheet
          {
            values: [
              ['Name', 'Test Game'],
              ['Owner Email', 'owner@test.com'],
              ['Operator Email', 'operator@test.com'],
            ],
          },
          // Players sheet
          {
            values: [
              ['ID', 'Name', 'Email'], // Header
              ['1', 'Player 1', 'player1@test.com'],
              ['2', 'Player 2', 'player2@test.com'],
            ],
          },
          // Rounds sheet
          {
            values: [
              ['Index', 'Cards', 'Trump', 'State', 'CompletedAt'], // Header
            ],
          },
          // Scores sheet
          {
            values: [
              ['Round', 'PlayerEmail', 'Bid', 'Tricks', 'Points', 'Total'], // Header
            ],
          },
        ],
      };

      const gameState = parseGameStateFromSheet(sheetData, 'sheet123');

      expect(gameState.id).toBe('sheet123');
      expect(gameState.name).toBe('Test Game');
      expect(gameState.ownerEmail).toBe('owner@test.com');
      expect(gameState.operatorEmail).toBe('operator@test.com');
      expect(gameState.players).toHaveLength(2);
      expect(gameState.players[0]).toEqual({
        id: '1',
        name: 'Player 1',
        email: 'player1@test.com',
        tricks: 0,
        bid: 0,
        score: 0,
      });
      expect(gameState.rounds).toHaveLength(0);
      expect(gameState.currentRoundIndex).toBe(0);
    });

    it('should parse game state with rounds', () => {
      const sheetData = {
        valueRanges: [
          {
            values: [
              ['Name', 'Test Game'],
              ['Owner Email', 'owner@test.com'],
            ],
          },
          {
            values: [
              ['ID', 'Name', 'Email'],
              ['1', 'Player 1', 'player1@test.com'],
              ['2', 'Player 2', 'player2@test.com'],
            ],
          },
          {
            values: [
              ['Index', 'Cards', 'Trump', 'State', 'CompletedAt'],
              ['1', '5', 'S', 'BIDDING', ''],
              ['2', '4', 'D', 'COMPLETED', '2024-01-01'],
            ],
          },
          {
            values: [
              ['Round', 'PlayerEmail', 'Bid', 'Tricks', 'Points', 'Total'],
            ],
          },
        ],
      };

      const gameState = parseGameStateFromSheet(sheetData, 'sheet123');

      expect(gameState.rounds).toHaveLength(2);
      expect(gameState.rounds[0]).toEqual({
        index: 1,
        cards: 5,
        trump: 'S',
        state: 'BIDDING',
        bids: {},
        tricks: {},
      });
      expect(gameState.rounds[1]).toEqual({
        index: 2,
        cards: 4,
        trump: 'D',
        state: 'COMPLETED',
        bids: {},
        tricks: {},
      });
      expect(gameState.currentRoundIndex).toBe(1); // First non-completed round
    });

    it('should parse game state with scores and calculate totals', () => {
      const sheetData = {
        valueRanges: [
          {
            values: [
              ['Name', 'Test Game'],
              ['Owner Email', 'owner@test.com'],
            ],
          },
          {
            values: [
              ['ID', 'Name', 'Email'],
              ['1', 'Player 1', 'player1@test.com'],
              ['2', 'Player 2', 'player2@test.com'],
            ],
          },
          {
            values: [
              ['Index', 'Cards', 'Trump', 'State', 'CompletedAt'],
              ['1', '5', 'S', 'COMPLETED', '2024-01-01'],
            ],
          },
          {
            values: [
              ['Round', 'PlayerEmail', 'Bid', 'Tricks', 'Points', 'Total'],
              ['1', 'player1@test.com', '3', '3', '8', '8'], // Made bid: 3 + 5 cards = 8
              ['1', 'player2@test.com', '2', '1', '0', '0'], // Missed bid: 0 points
            ],
          },
        ],
      };

      const gameState = parseGameStateFromSheet(sheetData, 'sheet123');

      expect(gameState.players[0].score).toBe(8);
      expect(gameState.players[1].score).toBe(0);
      expect(gameState.rounds[0].bids).toEqual({
        'player1@test.com': 3,
        'player2@test.com': 2,
      });
      expect(gameState.rounds[0].tricks).toEqual({
        'player1@test.com': 3,
        'player2@test.com': 1,
      });
    });

    it('should handle empty bids and tricks correctly', () => {
      const sheetData = {
        valueRanges: [
          {
            values: [
              ['Name', 'Test Game'],
              ['Owner Email', 'owner@test.com'],
            ],
          },
          {
            values: [
              ['ID', 'Name', 'Email'],
              ['1', 'Player 1', 'player1@test.com'],
            ],
          },
          {
            values: [
              ['Index', 'Cards', 'Trump', 'State', 'CompletedAt'],
              ['1', '5', 'S', 'BIDDING', ''],
            ],
          },
          {
            values: [
              ['Round', 'PlayerEmail', 'Bid', 'Tricks', 'Points', 'Total'],
              ['1', 'player1@test.com', '3', '', '0', '0'], // Tricks not entered yet
            ],
          },
        ],
      };

      const gameState = parseGameStateFromSheet(sheetData, 'sheet123');

      expect(gameState.rounds[0].bids).toEqual({
        'player1@test.com': 3,
      });
      expect(gameState.rounds[0].tricks).toEqual({}); // Empty string means -1, which we don't add
    });

    it('should set currentRoundIndex to next round when all rounds completed', () => {
      const sheetData = {
        valueRanges: [
          {
            values: [
              ['Name', 'Test Game'],
              ['Owner Email', 'owner@test.com'],
            ],
          },
          {
            values: [
              ['ID', 'Name', 'Email'],
              ['1', 'Player 1', 'player1@test.com'],
            ],
          },
          {
            values: [
              ['Index', 'Cards', 'Trump', 'State', 'CompletedAt'],
              ['1', '5', 'S', 'COMPLETED', '2024-01-01'],
              ['2', '4', 'D', 'COMPLETED', '2024-01-02'],
            ],
          },
          {
            values: [
              ['Round', 'PlayerEmail', 'Bid', 'Tricks', 'Points', 'Total'],
            ],
          },
        ],
      };

      const gameState = parseGameStateFromSheet(sheetData, 'sheet123');

      expect(gameState.currentRoundIndex).toBe(3); // Next round after last completed
    });

    it('should default to first player email when owner email missing', () => {
      const sheetData = {
        valueRanges: [
          {
            values: [
              ['Name', 'Test Game'],
            ],
          },
          {
            values: [
              ['ID', 'Name', 'Email'],
              ['1', 'Player 1', 'player1@test.com'],
            ],
          },
          {
            values: [['Index', 'Cards', 'Trump', 'State', 'CompletedAt']],
          },
          {
            values: [['Round', 'PlayerEmail', 'Bid', 'Tricks', 'Points', 'Total']],
          },
        ],
      };

      const gameState = parseGameStateFromSheet(sheetData, 'sheet123');

      expect(gameState.ownerEmail).toBe('player1@test.com');
      expect(gameState.operatorEmail).toBe('player1@test.com');
    });

    it('should handle multiple rounds with mixed states', () => {
      const sheetData = {
        valueRanges: [
          {
            values: [
              ['Name', 'Test Game'],
              ['Owner Email', 'owner@test.com'],
            ],
          },
          {
            values: [
              ['ID', 'Name', 'Email'],
              ['1', 'Player 1', 'player1@test.com'],
              ['2', 'Player 2', 'player2@test.com'],
            ],
          },
          {
            values: [
              ['Index', 'Cards', 'Trump', 'State', 'CompletedAt'],
              ['1', '5', 'S', 'COMPLETED', '2024-01-01'],
              ['2', '4', 'D', 'PLAYING', ''],
              ['3', '3', 'C', 'BIDDING', ''],
            ],
          },
          {
            values: [
              ['Round', 'PlayerEmail', 'Bid', 'Tricks', 'Points', 'Total'],
              ['1', 'player1@test.com', '2', '2', '7', '7'],
              ['1', 'player2@test.com', '3', '3', '8', '8'],
              ['2', 'player1@test.com', '1', '', '0', '7'],
              ['2', 'player2@test.com', '3', '', '0', '8'],
            ],
          },
        ],
      };

      const gameState = parseGameStateFromSheet(sheetData, 'sheet123');

      expect(gameState.currentRoundIndex).toBe(2); // First non-completed round (PLAYING)
      expect(gameState.players[0].score).toBe(7);
      expect(gameState.players[1].score).toBe(8);
    });

    it('should correctly score zero bids when made', () => {
      const sheetData = {
        valueRanges: [
          {
            values: [
              ['Name', 'Test Game'],
              ['Owner Email', 'owner@test.com'],
            ],
          },
          {
            values: [
              ['ID', 'Name', 'Email'],
              ['1', 'Player 1', 'player1@test.com'],
            ],
          },
          {
            values: [
              ['Index', 'Cards', 'Trump', 'State', 'CompletedAt'],
              ['1', '5', 'S', 'COMPLETED', '2024-01-01'],
            ],
          },
          {
            values: [
              ['Round', 'PlayerEmail', 'Bid', 'Tricks', 'Points', 'Total'],
              ['1', 'player1@test.com', '0', '0', '5', '5'], // Bid 0, made 0: gets 0 + 5 cards = 5
            ],
          },
        ],
      };

      const gameState = parseGameStateFromSheet(sheetData, 'sheet123');

      expect(gameState.players[0].score).toBe(5); // 0 bid + 5 cards
      expect(gameState.rounds[0].bids['player1@test.com']).toBe(0);
      expect(gameState.rounds[0].tricks['player1@test.com']).toBe(0);
    });
  });

  describe('fetchGameFromSheet', () => {
    it('should fetch game data from Google Sheets', async () => {
      const mockAuth = {};
      const mockBatchGet = jest.fn().mockResolvedValue({
        data: {
          valueRanges: [
            {
              values: [
                ['Name', 'Test Game'],
                ['Owner Email', 'owner@test.com'],
              ],
            },
            {
              values: [
                ['ID', 'Name', 'Email'],
                ['1', 'Player 1', 'player1@test.com'],
              ],
            },
            {
              values: [['Index', 'Cards', 'Trump', 'State', 'CompletedAt']],
            },
            {
              values: [['Round', 'PlayerEmail', 'Bid', 'Tricks', 'Points', 'Total']],
            },
          ],
        },
      });

      (google.sheets as jest.Mock).mockReturnValue({
        spreadsheets: {
          values: {
            batchGet: mockBatchGet,
          },
        },
      });

      const gameState = await fetchGameFromSheet(mockAuth, 'sheet123');

      expect(google.sheets).toHaveBeenCalledWith({ version: 'v4', auth: mockAuth });
      expect(mockBatchGet).toHaveBeenCalledWith({
        spreadsheetId: 'sheet123',
        ranges: ['Game!A:B', 'Players!A:C', 'Rounds!A:E', 'Scores!A:F'],
      });
      expect(gameState.id).toBe('sheet123');
      expect(gameState.name).toBe('Test Game');
    });

    it('should handle API errors gracefully', async () => {
      const mockAuth = {};
      const mockBatchGet = jest.fn().mockRejectedValue(new Error('API Error'));

      (google.sheets as jest.Mock).mockReturnValue({
        spreadsheets: {
          values: {
            batchGet: mockBatchGet,
          },
        },
      });

      await expect(fetchGameFromSheet(mockAuth, 'sheet123')).rejects.toThrow('API Error');
    });
  });
});

