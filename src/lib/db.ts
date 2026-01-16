import { supabaseAdmin } from './supabase';
import { GameState, Player, Round, removeGame } from './store';
import { DECK_SIZE } from './config';
import { createLogger } from './logger';

const log = createLogger({ module: 'db' });

// --- User Operations ---

export async function getUserByEmail(email: string) {
    const startTime = Date.now();
    log.debug({ email }, 'Fetching user by email');

    const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

    const duration = Date.now() - startTime;

    if (error && error.code !== 'PGRST116') { // PGRST116 is code for "no rows returned"
        log.error({ email, error: error.message, code: error.code, duration }, 'Error fetching user by email');
        return null;
    }

    if (data) {
        log.debug({ email, userId: data.id, duration }, 'User found');
    } else {
        log.debug({ email, duration }, 'User not found');
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
    const startTime = Date.now();
    // Use provided ID, or fall back to google_sub, or email as last resort
    const userId = user.id || user.google_sub || user.email;

    log.info({
        email: user.email,
        userId,
        name: user.name,
        hasImage: !!user.image,
        googleSub: user.google_sub
    }, 'Upserting user');

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

    const duration = Date.now() - startTime;

    if (error) {
        log.error({
            email: user.email,
            userId,
            error: error.message,
            code: error.code,
            duration
        }, 'Error upserting user');
        return null;
    }

    log.info({
        email: user.email,
        userId: data.id,
        duration
    }, 'User upserted successfully');

    return data;
}

export async function updateUser(userId: string, updates: { display_name?: string; theme?: string; notifications_enabled?: boolean; sound_enabled?: boolean; image?: string }) {
    const startTime = Date.now();
    log.debug({ userId, updates }, 'Updating user');

    const { data, error } = await supabaseAdmin
        .from('users')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

    const duration = Date.now() - startTime;

    if (error) {
        log.error({ userId, error: error.message, code: error.code, duration }, 'Error updating user');
        return null;
    }

    log.info({ userId, updates, duration }, 'User updated successfully');
    return data;
}

// --- Game Operations ---

export async function createGame(name: string, ownerId: string) {
    const startTime = Date.now();
    log.info({ name, ownerId }, 'Creating game');

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
        const duration = Date.now() - startTime;
        log.error({ name, ownerId, error: error.message, code: error.code, duration }, 'Error creating game');
        return null;
    }

    log.debug({ gameId: data.id, name, ownerId }, 'Game created, adding owner as first player');

    // Add owner as the first player
    await addPlayer(data.id, ownerId, 0);

    const duration = Date.now() - startTime;
    log.info({ gameId: data.id, name, ownerId, duration }, 'Game created successfully');

    return data;
}

export async function addPlayer(gameId: string, userId: string, order: number) {
    const startTime = Date.now();
    log.debug({ gameId, userId, order }, 'Adding player to game');

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

export async function removePlayerFromGame(gameId: string, userId: string) {
    const { error } = await supabaseAdmin
        .from('game_players')
        .delete()
        .eq('game_id', gameId)
        .eq('user_id', userId);

    if (error) {
        console.error('Error removing player from game:', error);
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
            score: gp.score || 0,
            playerOrder: gp.player_order,
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

export async function hideGameForUser(gameId: string, userId: string) {
    const { error } = await supabaseAdmin
        .from('game_players')
        .update({ is_hidden: true })
        .eq('game_id', gameId)
        .eq('user_id', userId);

    if (error) {
        console.error('Error hiding game for user:', error);
        return false;
    }
    return true;
}

// --- Discovery & Stats ---

export async function getDiscoverableGames(userEmail: string) {
    const { data: games, error } = await supabaseAdmin
        .from('games')
        .select(`
            id,
            name,
            created_at,
            owner:users!owner_id(email),
            game_players(user:users(email))
        `)
        .eq('current_round_index', 0);

    if (error) {
        console.error('Error fetching discoverable games:', error);
        return [];
    }

    return (games || [])
        .filter(g => {
            const players = (g.game_players as any[]) || [];
            const hasJoined = players.some(p => p.user?.email === userEmail);
            return !hasJoined && players.length < 12;
        })
        .map(g => ({
            id: g.id,
            name: g.name,
            ownerEmail: (g.owner as any)?.email,
            playerCount: (g.game_players as any[])?.length || 0,
            createdAt: new Date(g.created_at).getTime(),
        }));
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
    return saveGamePlayerScores(gameId, players);
}

export async function saveGamePlayerScores(gameId: string, players: Player[]) {
    const scoreEntries = players.map(p => ({
        game_id: gameId,
        user_id: p.id,
        score: p.score,
        player_order: p.playerOrder
    }));

    const { error: scoresError } = await supabaseAdmin
        .from('game_players')
        .upsert(scoreEntries, { onConflict: 'game_id,user_id' });

    if (scoresError) {
        log.error({ gameId, error: scoresError.message, scoreEntries }, 'Error saving player scores');
        return false;
    }

    log.info({ gameId, scoreEntries }, 'Successfully saved player scores');
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
    secondPlace: number;
    thirdPlace: number;
    averagePercentile: number; // Fair ranking: accounts for variable player counts
    podiumRate: number; // (wins + 2nd + 3rd) / gamesPlayed * 100
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
        .order('created_at', { ascending: false });

    if (error || !games) {
        console.error('Error fetching games for leaderboard:', error);
        return [];
    }

    // 2. Filter to only completed games (last round is COMPLETED)
    const completedGames = (games || []).filter(game => {
        const rounds = game.rounds as { state: string }[];
        if (!rounds || rounds.length === 0) return false;
        // A game is completed for the global leaderboard if it has at least one COMPLETED round
        // We could make this stricter (e.g., must have the final round completed)
        return rounds.some(r => r.state === 'COMPLETED');
    });

    log.info({
        totalGamesFetched: games?.length || 0,
        completedGamesCount: completedGames.length
    }, 'Leaderboard data fetched');

    // 3. Aggregate stats per player (by email)
    const playerStats: Record<string, {
        email: string;
        name: string;
        image: string | null;
        gamesPlayed: number;
        wins: number;
        secondPlace: number;
        thirdPlace: number;
        totalScore: number;
        lastPlaceCount: number;
        percentileSum: number; // Sum of percentiles for averaging
    }> = {};

    for (const game of completedGames) {
        const gamePlayers = game.game_players as any[];
        if (!gamePlayers || gamePlayers.length < 2) continue; // Need at least 2 players

        const numPlayers = gamePlayers.length;

        // Get distinct scores sorted descending
        const scores = gamePlayers.map(gp => gp.score || 0);
        const distinctScores = [...new Set(scores)].sort((a, b) => b - a);
        const minScore = Math.min(...scores);

        for (const gp of gamePlayers) {
            const userData = gp.user;
            const user = Array.isArray(userData) ? userData[0] : userData;

            if (!user || !user.email) {
                log.debug({ gp }, 'Skipping player entry due to missing user data');
                continue;
            }

            const email = user.email;
            const score = gp.score || 0;
            const rank = distinctScores.indexOf(score) + 1;

            // Calculate percentile for this game
            // Formula: (players - rank) / (players - 1) * 100
            // 1st place = 100%, Last place = 0%
            const percentile = ((numPlayers - rank) / (numPlayers - 1)) * 100;

            if (!playerStats[email]) {
                // Determine best name to show: display_name -> name -> email prefix
                const displayName = user.display_name || user.name || (email ? email.split('@')[0] : 'Unknown');

                playerStats[email] = {
                    email,
                    name: displayName,
                    image: user.image,
                    gamesPlayed: 0,
                    wins: 0,
                    secondPlace: 0,
                    thirdPlace: 0,
                    totalScore: 0,
                    lastPlaceCount: 0,
                    percentileSum: 0,
                };
            }

            playerStats[email].gamesPlayed++;
            playerStats[email].totalScore += score;
            playerStats[email].percentileSum += percentile;

            log.debug({ email, gameId: game.id, score, rank, percentile }, 'Aggregated player stats for game');

            // Track placements
            if (rank === 1) playerStats[email].wins++;
            else if (rank === 2) playerStats[email].secondPlace++;
            else if (rank === 3) playerStats[email].thirdPlace++;

            // Last place if tied for min score (and not everyone tied)
            if (score === minScore && distinctScores.length > 1) {
                playerStats[email].lastPlaceCount++;
            }
        }
    }

    // 4. Convert to array, calculate rates, filter min 3 games, sort by averagePercentile
    const leaderboard: LeaderboardEntry[] = Object.values(playerStats)
        .filter(p => p.gamesPlayed >= 3)
        .map(p => ({
            email: p.email,
            name: p.name,
            image: p.image,
            gamesPlayed: p.gamesPlayed,
            wins: p.wins,
            secondPlace: p.secondPlace,
            thirdPlace: p.thirdPlace,
            totalScore: p.totalScore,
            lastPlaceCount: p.lastPlaceCount,
            averagePercentile: p.gamesPlayed > 0 ? Math.round(p.percentileSum / p.gamesPlayed) : 0,
            winRate: p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0,
            podiumRate: p.gamesPlayed > 0 ? Math.round(((p.wins + p.secondPlace + p.thirdPlace) / p.gamesPlayed) * 100) : 0,
        }))
        .sort((a, b) => {
            // Sort by averagePercentile (desc), then wins (desc), then total score (desc)
            if (b.averagePercentile !== a.averagePercentile) return b.averagePercentile - a.averagePercentile;
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.totalScore - a.totalScore;
        });

    return leaderboard;
}

function getFinalRoundNumber(numPlayers: number): number {
    if (!numPlayers) return 12;
    const maxCards = Math.floor(DECK_SIZE / numPlayers);
    return maxCards * 2 - 1;
}

/**
 * Automatically hard-deletes games that are not completed and are older than 6 hours.
 * Cleans up both memory store and database.
 */
export async function purgeStaleGames() {
    try {
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

        // 1. Fetch games older than 6 hours
        // We fetch id, current_round_index, players (to count), and rounds (to check completion)
        const { data: games, error } = await supabaseAdmin
            .from('games')
            .select(`
                id,
                current_round_index,
                game_players(user_id),
                rounds(round_index, state)
            `)
            .lt('created_at', sixHoursAgo);

        if (error || !games) {
            if (error) console.error('[Maintenance] Error fetching stale games:', error);
            return;
        }

        if (games.length === 0) return;

        console.log(`[Maintenance] Checking ${games.length} stale games for removal...`);

        const toDelete: string[] = [];

        for (const game of games) {
            const numPlayers = game.game_players?.length || 0;
            const finalRound = getFinalRoundNumber(numPlayers);
            const rounds = (game.rounds as any[]) || [];

            // A game is completed if any round with index >= finalRound is COMPLETED
            const isCompleted = rounds.some(r => r.state === 'COMPLETED' && r.round_index >= finalRound);

            if (!isCompleted) {
                toDelete.push(game.id);
            }
        }

        if (toDelete.length > 0) {
            console.log(`[Maintenance] Purging ${toDelete.length} incomplete stale games.`);

            // Perform bulk delete from database
            // Cascading deletes should handle rounds and game_players
            const { error: delError } = await supabaseAdmin
                .from('games')
                .delete()
                .in('id', toDelete);

            if (delError) {
                console.error('[Maintenance] Error purging games from DB:', delError);
            } else {
                // Clear from memory store as well
                for (const id of toDelete) {
                    removeGame(id);
                }
                console.log(`[Maintenance] Successfully purged ${toDelete.length} games.`);
            }
        }
    } catch (e) {
        console.error('[Maintenance] Unexpected error during purge:', e);
    }
}
