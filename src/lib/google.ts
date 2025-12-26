import { google } from 'googleapis';
import { JWT } from 'next-auth/jwt';

// Helper to get authenticated Google Client from NextAuth Token
export function getGoogleFromToken(token: JWT) {
    if (!token.accessToken || !token.refreshToken) {
        throw new Error("Missing Google OAuth tokens. Please sign in again and grant permissions.");
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        throw new Error("Google OAuth credentials not configured. Check environment variables.");
    }

    const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    );

    auth.setCredentials({
        access_token: token.accessToken as string,
        refresh_token: token.refreshToken as string,
        // expiry_date?
    });

    return auth;
}

// Create game resources asynchronously (fire-and-forget)
// Updates the game state with the real sheetId when done
export function createGameResourcesInSheetAsync(
    auth: any, 
    gameName: string, 
    user: { id: string, name?: string | null, email?: string | null },
    tempGameId: string,
    updateGameState: (tempId: string, sheetId: string) => void
) {
    // Run all Google operations in background
    (async () => {
        const drive = google.drive({ version: 'v3', auth });
        const sheets = google.sheets({ version: 'v4', auth });

        try {
            // 1. Find or Create 'judgement' folder
            let folderId: string;
            const folderQuery = "mimeType='application/vnd.google-apps.folder' and name='scorejudge' and trashed=false";
            
            try {
                const folderRes = await drive.files.list({
                    q: folderQuery,
                    spaces: 'drive',
                    fields: 'files(id, name)',
                });

                if (folderRes.data.files && folderRes.data.files.length > 0) {
                    folderId = folderRes.data.files[0].id!;
                } else {
                    const createRes = await drive.files.create({
                        requestBody: {
                            name: 'scorejudge',
                            mimeType: 'application/vnd.google-apps.folder',
                        },
                        fields: 'id',
                    });
                    folderId = createRes.data.id!;
                }
            } catch (e: any) {
                console.error("Error finding/creating folder:", e);
                // Continue without folder - create sheet in root
                folderId = '';
            }

            // 2. Create Sheet
            const sheetRes = await drive.files.create({
                requestBody: {
                    name: `ScoreJudge - ${gameName}`,
                    mimeType: 'application/vnd.google-apps.spreadsheet',
                    ...(folderId ? { parents: [folderId] } : {}),
                },
                fields: 'id',
            });
            const sheetId = sheetRes.data.id!;

            // Update game state with real sheetId
            updateGameState(tempGameId, sheetId);

            // Share sheet with owner (user) as writer - fire-and-forget
            if (user.email) {
                drive.permissions.create({
                    fileId: sheetId,
                    requestBody: {
                        role: 'writer',
                        type: 'user',
                        emailAddress: user.email,
                    },
                    sendNotificationEmail: false,
                }).catch((e: any) => {
                    console.error("Failed to share sheet with owner (continuing anyway):", e);
                });
            }

            // 3. Init Tabs - MUST await this before writing headers
            try {
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: sheetId,
                    requestBody: {
                        requests: [
                            { updateSheetProperties: { properties: { sheetId: 0, title: 'Game' }, fields: 'title' } },
                            { addSheet: { properties: { title: 'Players' } } },
                            { addSheet: { properties: { title: 'Rounds' } } },
                            { addSheet: { properties: { title: 'Scores' } } },
                        ],
                    },
                });

                // 4. Init Header Rows - Only after tabs are created
                await sheets.spreadsheets.values.batchUpdate({
                    spreadsheetId: sheetId,
                    requestBody: {
                        valueInputOption: 'USER_ENTERED',
                        data: [
                            {
                                range: 'Game!A1:B7', values: [
                                    ['Key', 'Value'],
                                    ['Name', gameName],
                                    ['Created At', new Date().toISOString()],
                                    ['Status', 'ACTIVE'],
                                    ['Current Round', '0'],
                                    ['Owner Email', user.email || ''],
                                    ['Operator Email', user.email || '']
                                ]
                            },
                            {
                                range: 'Players!A1:C2', values: [
                                    ['ID', 'Name', 'Email'],
                                    [user.id, user.name || 'Owner', user.email || '']
                                ]
                            },
                            { range: 'Rounds!A1:E1', values: [['Index', 'Cards', 'Trump', 'State', 'Completed At']] },
                            { range: 'Scores!A1:F1', values: [['Round', 'PlayerEmail', 'Bid', 'Tricks', 'Points', 'Total']] },
                        ]
                    }
                });
            } catch (e: any) {
                console.error("Failed to create tabs or write headers to sheet:", e);
                // Continue - game will work in memory
            }
        } catch (e: any) {
            console.error("Error creating game resources in background:", e);
            // Game will continue to work with temp ID in memory
        }
    })();
}

// Legacy synchronous version (kept for backwards compatibility if needed)
export async function createGameResourcesInSheet(auth: any, gameName: string, user: { id: string, name?: string | null, email?: string | null }) {
    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Find or Create 'judgement' folder
    let folderId: string;
    const folderQuery = "mimeType='application/vnd.google-apps.folder' and name='scorejudge' and trashed=false";
    
    try {
        const folderRes = await drive.files.list({
            q: folderQuery,
            spaces: 'drive',
            fields: 'files(id, name)',
        });

        if (folderRes.data.files && folderRes.data.files.length > 0) {
            folderId = folderRes.data.files[0].id!;
        } else {
            try {
                const createRes = await drive.files.create({
                    requestBody: {
                        name: 'scorejudge',
                        mimeType: 'application/vnd.google-apps.folder',
                    },
                    fields: 'id',
                });
                folderId = createRes.data.id!;
            } catch (e: any) {
                console.error("Error creating folder", e);
                if (e?.code === 403 && e?.message?.includes('API has not been used')) {
                    throw new Error("Google Drive API is not enabled. Please enable it at: https://console.cloud.google.com/apis/library/drive.googleapis.com");
                }
                throw e;
            }
        }
    } catch (e: any) {
        if (e?.code === 403 && e?.message?.includes('API has not been used')) {
            throw new Error("Google Drive API is not enabled. Please enable it at: https://console.cloud.google.com/apis/library/drive.googleapis.com");
        }
        throw e;
    }

    // 2. Create Sheet
    try {
        const sheetRes = await drive.files.create({
            requestBody: {
                name: `ScoreJudge - ${gameName}`,
                mimeType: 'application/vnd.google-apps.spreadsheet',
                parents: [folderId],
            },
            fields: 'id',
        });
        const sheetId = sheetRes.data.id!;

        // Share sheet with owner (user) as writer - fire-and-forget
        if (user.email) {
            drive.permissions.create({
                fileId: sheetId,
                requestBody: {
                    role: 'writer',
                    type: 'user',
                    emailAddress: user.email,
                },
                sendNotificationEmail: false,
            }).catch((e: any) => {
                console.error("Failed to share sheet with owner (continuing anyway):", e);
                // Continue - game will work in memory
            });
        }

        // 3. Init Tabs (fire-and-forget)
        sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: {
                requests: [
                    { updateSheetProperties: { properties: { sheetId: 0, title: 'Game' }, fields: 'title' } },
                    { addSheet: { properties: { title: 'Players' } } },
                    { addSheet: { properties: { title: 'Rounds' } } },
                    { addSheet: { properties: { title: 'Scores' } } },
                ],
            },
        }).catch((e: any) => {
            console.error("Failed to create tabs in sheet (continuing anyway):", e);
            // Continue - game will work in memory
        });

        // 4. Init Header Rows (fire-and-forget)
        sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: [
                    {
                        range: 'Game!A1:B7', values: [
                            ['Key', 'Value'],
                            ['Name', gameName],
                            ['Created At', new Date().toISOString()],
                            ['Status', 'ACTIVE'],
                            ['Current Round', '0'],
                            ['Owner Email', user.email || ''],
                            ['Operator Email', user.email || ''] // Defaults to owner
                        ]
                    },
                    {
                        range: 'Players!A1:C2', values: [
                            ['ID', 'Name', 'Email'],
                            [user.id, user.name || 'Owner', user.email || '']
                        ]
                    },
                    { range: 'Rounds!A1:E1', values: [['Index', 'Cards', 'Trump', 'State', 'Completed At']] },
                    { range: 'Scores!A1:F1', values: [['Round', 'PlayerEmail', 'Bid', 'Tricks', 'Points', 'Total']] },
                ]
            }
        }).catch((e: any) => {
            console.error("Failed to write headers to sheet (continuing anyway):", e);
            // Continue - game will work in memory
        });

        return sheetId;
    } catch (e: any) {
        if (e?.code === 403 && e?.message?.includes('API has not been used')) {
            const apiName = e?.message?.includes('Drive') ? 'Drive' : 'Sheets';
            const apiUrl = apiName === 'Drive' 
                ? 'https://console.cloud.google.com/apis/library/drive.googleapis.com'
                : 'https://console.cloud.google.com/apis/library/sheets.googleapis.com';
            throw new Error(`Google ${apiName} API is not enabled. Please enable it at: ${apiUrl}`);
        }
        throw e;
    }
}

export async function listValidationGames(auth: any) {
    const drive = google.drive({ version: 'v3', auth });
    // Find files in 'judgement' folder? Or just with name 'Judgement - *'
    // Better: find 'judgement' folder first, then list children.

    // Quick search: name contains 'Judgement - ' and mimeType = spreadsheet
    const res = await drive.files.list({
        q: "name contains 'ScoreJudge - ' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        fields: 'files(id, name, createdTime)',
        orderBy: 'createdTime desc'
    });

    return res.data.files || [];
}
