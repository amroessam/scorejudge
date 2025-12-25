# Setup Instructions

## Enable Google APIs

Before using the app, you need to enable the required Google APIs in your Google Cloud Console:

1. **Google Drive API**
   - Visit: https://console.cloud.google.com/apis/library/drive.googleapis.com
   - Click "Enable"
   - Wait a few minutes for the API to propagate

2. **Google Sheets API**
   - Visit: https://console.cloud.google.com/apis/library/sheets.googleapis.com
   - Click "Enable"
   - Wait a few minutes for the API to propagate

## Environment Variables

Make sure your `.env` file contains:

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key
```

## OAuth Consent Screen

Make sure your OAuth consent screen is configured with:
- Scopes: `https://www.googleapis.com/auth/drive.file` and `https://www.googleapis.com/auth/spreadsheets`
- Access type: `offline`
- Prompt: `consent`

## After Enabling APIs

1. Restart your development server
2. Sign out and sign back in to refresh OAuth tokens
3. Try creating a game again

