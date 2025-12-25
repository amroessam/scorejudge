import { GameState, Player, Round } from './store';
import { google } from 'googleapis';

// --- Types & Constants ---

const TRUMP_CYCLE = ['S', 'D', 'C', 'H', 'NT'];
// Spades, Diamonds, Clubs, Hearts, No Trump

// --- Sheet Parsing Logic ---

export function parseGameStateFromSheet(sheetData: any, gameId: string): GameState {
    // sheetData is the result of spreadsheets.values.get (batch)
    // We expect ranges: Game!A:B, Players!A:C, Rounds!A:E, Scores!A:F

    const gameRows = sheetData.valueRanges[0].values || [];
    const playerRows = sheetData.valueRanges[1].values || []; // Header: ID, Name, Email
    const roundRows = sheetData.valueRanges[2].values || [];  // Header: Index, Cards, Trump, State, CompletedAt
    const scoreRows = sheetData.valueRanges[3].values || [];  // Header: Round, Email, Bid, Tricks, Points, Total

    // 1. Parse Metadata
    const gameName = gameRows.find((r: string[]) => r[0] === 'Name')?.[1] || 'Unknown Game';

    // 2. Parse Players
    const players: Player[] = [];
    // Skip header row 0
    for (let i = 1; i < playerRows.length; i++) {
        const row = playerRows[i];
        if (row.length < 3) continue;
        players.push({
            id: row[0],
            name: row[1],
            email: row[2],
            tricks: 0,
            bid: 0,
            score: 0 // Will Calculate from scores tab
        });
    }

    // 3. Parse Rounds (Definition)
    const rounds: Round[] = [];
    for (let i = 1; i < roundRows.length; i++) {
        const row = roundRows[i];
        rounds.push({
            index: parseInt(row[0]),
            cards: parseInt(row[1]),
            trump: row[2],
            state: row[3] as any,
            bids: {},
            tricks: {}
        });
    }

    // 4. Parse Scores & Apply to State
    // scoreRows: RoundIndex, PlayerEmail, Bid, Tricks, Points, Total
    // We need to populate 'bids' and 'tricks' in the Round objects
    // And update 'score' in Players for the *latest* total.

    // We can just re-calculate totals to be safe, or trust the sheet.
    // Let's trust the sheet's "Points" for now, but aggregation for leaderboard we do here.

    const playerScores = new Map<string, number>(); // email -> total score
    players.forEach(p => playerScores.set(p.email, 0));

    for (let i = 1; i < scoreRows.length; i++) {
        const row = scoreRows[i];
        const rIndex = parseInt(row[0]);
        const email = row[1];
        const bid = parseInt(row[2]);
        const tricks = row[3] === '' ? -1 : parseInt(row[3]); // -1 means not entered/played yet?
        // const points = parseInt(row[4]);

        const round = rounds.find(r => r.index === rIndex);
        if (round) {
            if (!isNaN(bid)) round.bids[email] = bid;
            if (tricks !== -1 && !isNaN(tricks)) round.tricks[email] = tricks;
        }

        // Keep running total if valid
        // Actually, let's re-calculate logic to be 100% sure we match PRD
    }

    // Re-calculate all scores from scratch based on Bids/Tricks in Rounds
    // Scoring: if tricks == bid: points = bid + cardsPerPlayer (not bid + totalCardsDealt)
    // else 0

    players.forEach(p => p.score = 0); // Reset

    rounds.forEach(r => {
        const cardsPerPlayer = r.cards;

        // If round is completed/scored
        // We check if we have bids AND tricks for all players? 
        // Or just calculate what we have.

        players.forEach(p => {
            const bid = r.bids[p.email];
            const tricks = r.tricks[p.email];

            // Only score if tricks is defined, not -1, and equals bid
            if (bid !== undefined && tricks !== undefined && tricks !== -1) {
                if (bid === tricks) {
                    p.score += (bid + cardsPerPlayer);
                } else {
                    p.score += 0;
                }
            }
        });
    });

    // 5. Determine Current Round
    // Last round that is NOT 'COMPLETED' or first one?
    // PRD says "Round plan generation". We assume rounds are pre-generated or generated on fly.
    // If empty rounds, we are at round 0.
    let currentRoundIndex = 0;
    const activeRound = rounds.find(r => r.state !== 'COMPLETED');
    if (activeRound) {
        currentRoundIndex = activeRound.index;
    } else if (rounds.length > 0) {
        // All completed?
        currentRoundIndex = rounds[rounds.length - 1].index + 1; // Finished
    }


    // Get owner email from Game metadata or first player
    const ownerEmail = gameRows.find((r: string[]) => r[0] === 'Owner Email')?.[1] || players[0]?.email || '';
    
    return {
        id: gameId,
        name: gameName,
        players: players || [], // Ensure players is always an array
        rounds: rounds || [], // Ensure rounds is always an array
        currentRoundIndex: currentRoundIndex || 0,
        ownerEmail: ownerEmail || '',
        operatorEmail: gameRows.find((r: string[]) => r[0] === 'Operator Email')?.[1] || ownerEmail || '', // Defaults to owner
        lastUpdated: Date.now()
    };
}

// --- Game Action Helpers ---

export async function fetchGameFromSheet(auth: any, sheetId: string): Promise<GameState> {
    const sheets = google.sheets({ version: 'v4', auth });

    // Use flexible ranges that don't require exact row counts
    const res = await sheets.spreadsheets.values.batchGet({
        spreadsheetId: sheetId,
        ranges: ['Game!A:B', 'Players!A:C', 'Rounds!A:E', 'Scores!A:F'] // Use column ranges instead of fixed rows
    });

    return parseGameStateFromSheet(res.data, sheetId);
}
