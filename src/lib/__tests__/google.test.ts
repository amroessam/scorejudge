import { getGoogleFromToken, createGameResourcesInSheet, listValidationGames } from '@/lib/google';
import { google } from 'googleapis';

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
      })),
    },
    drive: jest.fn(),
    sheets: jest.fn(),
  },
}));

describe('google', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  });

  describe('getGoogleFromToken', () => {
    it('should create Google OAuth client with valid token', () => {
      const mockToken = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        email: 'test@example.com',
        name: 'Test User',
        sub: '123',
      };

      const auth = getGoogleFromToken(mockToken);

      expect(google.auth.OAuth2).toHaveBeenCalledWith(
        'test-client-id',
        'test-client-secret'
      );
      expect(auth).toBeDefined();
    });

    it('should throw error when missing access token', () => {
      const mockToken = {
        refreshToken: 'refresh-token',
        email: 'test@example.com',
        name: 'Test User',
        sub: '123',
      } as any;

      expect(() => getGoogleFromToken(mockToken)).toThrow('Missing Google OAuth tokens');
    });

    it('should throw error when missing refresh token', () => {
      const mockToken = {
        accessToken: 'access-token',
        email: 'test@example.com',
        name: 'Test User',
        sub: '123',
      } as any;

      expect(() => getGoogleFromToken(mockToken)).toThrow('Missing Google OAuth tokens');
    });

    it('should throw error when missing environment variables', () => {
      delete process.env.GOOGLE_CLIENT_ID;
      const mockToken = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        email: 'test@example.com',
        name: 'Test User',
        sub: '123',
      };

      expect(() => getGoogleFromToken(mockToken)).toThrow('Google OAuth credentials not configured');
    });
  });

  describe('listValidationGames', () => {
    it('should list game spreadsheets', async () => {
      const mockFiles = [
        { id: 'sheet1', name: 'ScoreJudge - Game 1', createdTime: '2024-01-01' },
        { id: 'sheet2', name: 'ScoreJudge - Game 2', createdTime: '2024-01-02' },
      ];

      const mockDrive = {
        files: {
          list: jest.fn().mockResolvedValue({
            data: { files: mockFiles },
          }),
        },
      };

      (google.drive as jest.Mock).mockReturnValue(mockDrive);

      const mockAuth = {};
      const files = await listValidationGames(mockAuth);

      expect(files).toEqual(mockFiles);
      expect(mockDrive.files.list).toHaveBeenCalledWith({
        q: "name contains 'ScoreJudge - ' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        fields: 'files(id, name, createdTime)',
        orderBy: 'createdTime desc',
      });
    });

    it('should return empty array when no files found', async () => {
      const mockDrive = {
        files: {
          list: jest.fn().mockResolvedValue({
            data: {},
          }),
        },
      };

      (google.drive as jest.Mock).mockReturnValue(mockDrive);

      const mockAuth = {};
      const files = await listValidationGames(mockAuth);

      expect(files).toEqual([]);
    });
  });

  describe('createGameResourcesInSheet', () => {
    it('should create game resources successfully', async () => {
      const mockDrive = {
        files: {
          list: jest.fn().mockResolvedValue({
            data: {
              files: [{ id: 'folder123', name: 'scorejudge' }],
            },
          }),
          create: jest.fn().mockResolvedValue({
            data: { id: 'sheet123' },
          }),
        },
        permissions: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      const mockSheets = {
        spreadsheets: {
          batchUpdate: jest.fn().mockResolvedValue({}),
          values: {
            batchUpdate: jest.fn().mockResolvedValue({}),
          },
        },
      };

      (google.drive as jest.Mock).mockReturnValue(mockDrive);
      (google.sheets as jest.Mock).mockReturnValue(mockSheets);

      const mockAuth = {};
      const user = {
        id: '123',
        name: 'Test User',
        email: 'test@example.com',
      };

      const sheetId = await createGameResourcesInSheet(mockAuth, 'Test Game', user);

      expect(sheetId).toBe('sheet123');
      expect(mockDrive.files.create).toHaveBeenCalled();
    });

    it('should handle folder creation when folder does not exist', async () => {
      const mockDrive = {
        files: {
          list: jest.fn().mockResolvedValue({
            data: { files: [] },
          }),
          create: jest.fn()
            .mockResolvedValueOnce({ data: { id: 'newfolder123' } }) // Folder creation
            .mockResolvedValueOnce({ data: { id: 'sheet123' } }), // Sheet creation
        },
        permissions: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      const mockSheets = {
        spreadsheets: {
          batchUpdate: jest.fn().mockResolvedValue({}),
          values: {
            batchUpdate: jest.fn().mockResolvedValue({}),
          },
        },
      };

      (google.drive as jest.Mock).mockReturnValue(mockDrive);
      (google.sheets as jest.Mock).mockReturnValue(mockSheets);

      const mockAuth = {};
      const user = {
        id: '123',
        name: 'Test User',
        email: 'test@example.com',
      };

      const sheetId = await createGameResourcesInSheet(mockAuth, 'Test Game', user);

      expect(sheetId).toBe('sheet123');
      expect(mockDrive.files.create).toHaveBeenCalledTimes(2); // Folder + Sheet
    });

    it('should throw error with API not enabled message', async () => {
      const apiError = {
        code: 403,
        message: 'API has not been used in project',
      };

      const mockDrive = {
        files: {
          list: jest.fn().mockRejectedValue(apiError),
        },
      };

      (google.drive as jest.Mock).mockReturnValue(mockDrive);

      const mockAuth = {};
      const user = {
        id: '123',
        name: 'Test User',
        email: 'test@example.com',
      };

      await expect(
        createGameResourcesInSheet(mockAuth, 'Test Game', user)
      ).rejects.toThrow('Google Drive API is not enabled');
    });
  });
});

