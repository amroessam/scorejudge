import { supabaseAdmin } from './supabase';
import { GameState, Player, Round } from './store';

// --- User Operations ---

export async function getUserByEmail(email: string) {
    const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is code for "no rows returned"
        console.error('Error fetching user by email:', error);
        return null;
    }
    return data;
}

export async function upsertUser(user: {
    email: string;
    name?: string;
    image?: string;
    google_sub?: string;
    id?: string; // Allow passing custom ID for debug users
}) {
    // Use provided ID, or fall back to google_sub, or email as last resort
    const userId = user.id || user.google_sub || user.email;

    const { data, error } = await supabaseAdmin
        .from('users')
        .upsert({
            id: userId,
            email: user.email,
            name: user.name,
            image: user.image,
            google_sub: user.google_sub,
            updated_at: new Date().toISOString()
        }, { onConflict: 'email' })
        .select()
        .single();

    if (error) {
        console.error('Error upserting user:', error);
        return null;
    }
    return data;
}

export async function updateUser(userId: string, updates: { display_name?: string; theme?: string; notifications_enabled?: boolean; sound_enabled?: boolean; image?: string }) {
    const { data, error } = await supabaseAdmin
        .from('users')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        console.error('Error updating user:', error);
        return null;
    }
    return data;
}

// --- Game Operations ---

export async function createGame(name: string, ownerId: string) {
    const { data, error } = await supabaseAdmin
        .from('games')
        .insert({
            name,
            owner_id: ownerId,
            operator_id: ownerId,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating game:', error);
        return null;
    }

    // Add owner as the first player
    await addPlayer(data.id, ownerId, 0);

    return data;
}

export async function addPlayer(gameId: string, userId: string, order: number) {
    const { error } = await supabaseAdmin
        .from('game_players')
        .insert({
            game_id: gameId,
            user_id: userId,
            player_order: order,
        });

    if (error) {
        console.error('Error adding player:', error);
        return false;
    }
    return true;
}

export async function getGame(gameId: string): Promise<GameState | null> {
    const { data: game, error } = await supabaseAdmin
        .from('games')
        .select(`
      *,
      owner:users!owner_id(email),
      operator:users!operator_id(email),
      first_dealer:users!first_dealer_id(email),
      game_players(
        score,
        player_order,
        user:users(*)
      ),
      rounds(
        *,
        round_players(*)
      )
    `)
        .eq('id', gameId)
        .single();

    if (error || !game) {
        console.error('Error fetching game:', error);
        return null;
    }

    // Map to GameState interface
    const players: Player[] = game.game_players
        .sort((a: any, b: any) => a.player_order - b.player_order)
        .map((gp: any) => ({
            id: gp.user.id,
            name: gp.user.display_name || gp.user.name || 'Unknown',
            email: gp.user.email,
            image: gp.user.image,
            score: gp.score,
            bid: 0, // Current round bid (populated as needed)
            tricks: 0, // Current round tricks (populated as needed)
        }));

    const rounds: Round[] = game.rounds
        .sort((a: any, b: any) => a.round_index - b.round_index)
        .map((r: any) => {
            const bids: Record<string, number> = {};
            const tricks: Record<string, number> = {};

            r.round_players.forEach((rp: any) => {
                const playerEmail = game.game_players.find((gp: any) => gp.user.id === rp.user_id)?.user.email;
                if (playerEmail) {
                    if (rp.bid !== null) bids[playerEmail] = rp.bid;
                    if (rp.tricks !== null) tricks[playerEmail] = rp.tricks;
                }
            });

            return {
                index: r.round_index,
                cards: r.cards,
                trump: r.trump,
                state: r.state,
                bids,
                tricks
            };
        });

    return {
        id: game.id,
        name: game.name,
        players,
        rounds,
        currentRoundIndex: game.current_round_index,
        ownerEmail: game.owner.email,
        operatorEmail: game.operator?.email || game.owner.email,
        firstDealerEmail: game.first_dealer?.email,
        createdAt: new Date(game.created_at).getTime(),
        lastUpdated: new Date(game.updated_at).getTime(),
    };
}

export async function updateGame(gameId: string, updates: any) {
    // Map internal GameState field names to DB names if needed
    const dbUpdates: any = { updated_at: new Date().toISOString() };

    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.currentRoundIndex !== undefined) dbUpdates.current_round_index = updates.currentRoundIndex;

    const { error } = await supabaseAdmin
        .from('games')
        .update(dbUpdates)
        .eq('id', gameId);

    if (error) {
        console.error('Error updating game:', error);
        return false;
    }
    return true;
}

export async function deleteGame(gameId: string) {
    const { error } = await supabaseAdmin
        .from('games')
        .delete()
        .eq('id', gameId);

    if (error) {
        console.error('Error deleting game:', error);
        return false;
    }
    return true;
}

// --- Round Operations ---

export async function saveRound(gameId: string, roundIndex: number, roundData: Partial<Round>) {
    // 1. Ensure round exists
    const { data: round, error: roundError } = await supabaseAdmin
        .from('rounds')
        .upsert({
            game_id: gameId,
            round_index: roundIndex,
            cards: roundData.cards!,
            trump: roundData.trump!,
            state: roundData.state || 'BIDDING'
        }, { onConflict: 'game_id,round_index' })
        .select()
        .single();

    if (roundError) {
        console.error('Error saving round:', roundError);
        return null;
    }

    // 2. Save player data for round
    // This would be more complex as we need to map emails back to UUIDs
    // Usually we'd do this inside the API handler which has access to context
    return round;
}

export async function saveRoundBids(gameId: string, roundIndex: number, bids: Record<string, number>, players: Player[], cards: number, trump: string) {
    // 1. Get or create round
    const { data: round, error: roundError } = await supabaseAdmin
        .from('rounds')
        .upsert({
            game_id: gameId,
            round_index: roundIndex,
            cards,
            trump,
            state: 'PLAYING'
        }, { onConflict: 'game_id,round_index' })
        .select()
        .single();

    if (roundError) {
        console.error('Error saving round for bids:', roundError);
        return false;
    }

    // 2. Save bids for each player
    const bidEntries = players.map(p => ({
        round_id: round.id,
        user_id: p.id,
        bid: bids[p.email]
    }));

    const { error: bidsError } = await supabaseAdmin
        .from('round_players')
        .upsert(bidEntries, { onConflict: 'round_id,user_id' });

    if (bidsError) {
        console.error('Error saving player bids:', bidsError);
        return false;
    }

    return true;
}

export async function saveRoundTricks(gameId: string, roundIndex: number, tricks: Record<string, number>, points: Record<string, number>, players: Player[]) {
    // 1. Get the round
    const { data: round, error: roundError } = await supabaseAdmin
        .from('rounds')
        .select('id')
        .eq('game_id', gameId)
        .eq('round_index', roundIndex)
        .single();

    if (roundError) {
        console.error('Error fetching round for tricks:', roundError);
        return false;
    }

    // 2. Update player data (tricks and points)
    const trickEntries = players.map(p => ({
        round_id: round.id,
        user_id: p.id,
        tricks: tricks[p.email],
        points: points[p.email]
    }));

    const { error: tricksError } = await supabaseAdmin
        .from('round_players')
        .upsert(trickEntries, { onConflict: 'round_id,user_id' });

    if (tricksError) {
        console.error('Error saving player tricks:', tricksError);
        return false;
    }

    // 3. Update round state
    await supabaseAdmin
        .from('rounds')
        .update({ state: 'COMPLETED' })
        .eq('id', round.id);

    // 4. Update total scores in game_players
    for (const p of players) {
        await supabaseAdmin
            .from('game_players')
            .update({ score: p.score })
            .eq('game_id', gameId)
            .eq('user_id', p.id);
    }

    return true;
}

export async function initializeRounds(gameId: string, rounds: Round[], players: Player[]) {
    // 1. Insert rounds
    const roundEntries = rounds.map(r => ({
        game_id: gameId,
        round_index: r.index,
        cards: r.cards,
        trump: r.trump,
        state: r.state
    }));

    const { data: dbRounds, error: roundsError } = await supabaseAdmin
        .from('rounds')
        .insert(roundEntries)
        .select();

    if (roundsError) {
        console.error('Error initializing rounds:', roundsError);
        return false;
    }

    return true;
}

// --- Leaderboard Operations ---

export interface LeaderboardEntry {
    email: string;
    name: string;
    image: string | null;
    gamesPlayed: number;
    wins: number;
    winRate: number;
    totalScore: number;
    lastPlaceCount: number; // 🌈 count
}

export async function getGlobalLeaderboard(): Promise<LeaderboardEntry[]> {
    // 1. Get all completed games with their players and scores
    const { data: games, error } = await supabaseAdmin
        .from('games')
        .select(`
            id,
            game_players(
                score,
                user:users(id, email, name, display_name, image)
            ),
            rounds(state)
        `)
        .gte('created_at', '2026-01-01');

    if (error || !games) {
        console.error('Error fetching games for leaderboard:', error);
        return [];
    }

    // 2. Filter to only completed games (last round is COMPLETED)
    const completedGames = games.filter(game => {
        const rounds = game.rounds as { state: string }[];
        if (!rounds || rounds.length === 0) return false;
        return rounds.some(r => r.state === 'COMPLETED');
    });

    // 3. Aggregate stats per player (by email)
    const playerStats: Record<string, {
        email: string;
        name: string;
        image: string | null;
        gamesPlayed: number;
        wins: number;
        totalScore: number;
        lastPlaceCount: number;
    }> = {};

    for (const game of completedGames) {
        const gamePlayers = game.game_players as any[];
        if (!gamePlayers || gamePlayers.length === 0) continue;

        // Find max and min scores in this game
        const scores = gamePlayers.map(gp => gp.score || 0);
        const maxScore = Math.max(...scores);
        const minScore = Math.min(...scores);

        for (const gp of gamePlayers) {
            const user = gp.user;
            if (!user || !user.email) continue;

            const email = user.email;
            const score = gp.score || 0;

            if (!playerStats[email]) {
                playerStats[email] = {
                    email,
                    name: user.display_name || user.name || 'Unknown',
                    image: user.image,
                    gamesPlayed: 0,
                    wins: 0,
                    totalScore: 0,
                    lastPlaceCount: 0,
                };
            }

            playerStats[email].gamesPlayed++;
            playerStats[email].totalScore += score;

            // Win if tied for max score
            if (score === maxScore) {
                playerStats[email].wins++;
            }

            // Last place if tied for min score (and min != max, i.e., not everyone tied)
            if (score === minScore && minScore !== maxScore) {
                playerStats[email].lastPlaceCount++;
            }
        }
    }

    // 4. Convert to array, calculate win rate, filter min 3 games, sort
    const leaderboard: LeaderboardEntry[] = Object.values(playerStats)
        .filter(p => p.gamesPlayed >= 3)
        .map(p => ({
            ...p,
            winRate: p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0,
        }))
        .sort((a, b) => {
            // Sort by wins (desc), then win rate (desc), then total score (desc)
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.winRate !== a.winRate) return b.winRate - a.winRate;
            return b.totalScore - a.totalScore;
        });

    return leaderboard;
}
