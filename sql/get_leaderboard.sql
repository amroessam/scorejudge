-- ScoreJudge Leaderboard Function
-- Replaces the 5-step JS aggregation that broke due to PostgREST URL length limits.
-- Based on the working SQL from the Supabase SQL editor, with added percentile calculation.
--
-- RUN THIS IN YOUR SUPABASE SQL EDITOR (production project: cbvdfouitqpdjjwiqokk)
-- After running, the app will call: supabaseAdmin.rpc('get_leaderboard')

CREATE OR REPLACE FUNCTION get_leaderboard()
RETURNS TABLE (
    email TEXT,
    player_name TEXT,
    player_image TEXT,
    games_played BIGINT,
    wins_1st BIGINT,
    second_place BIGINT,
    third_place BIGINT,
    last_place BIGINT,
    total_score BIGINT,
    avg_percentile NUMERIC,
    win_rate NUMERIC,
    podium_rate NUMERIC
)
LANGUAGE sql
STABLE
AS $$
    WITH completed_games AS (
        -- Get games that have at least one completed round
        SELECT DISTINCT g.id AS game_id
        FROM games g
        INNER JOIN rounds r ON r.game_id = g.id
        WHERE r.state = 'COMPLETED'
    ),
    game_rankings AS (
        -- For each completed game, rank players by score
        SELECT
            gp.game_id,
            gp.user_id,
            gp.score,
            u.email,
            u.name,
            u.display_name,
            u.image,
            DENSE_RANK() OVER (PARTITION BY gp.game_id ORDER BY gp.score DESC) AS rank,
            DENSE_RANK() OVER (PARTITION BY gp.game_id ORDER BY gp.score ASC) AS reverse_rank,
            COUNT(*) OVER (PARTITION BY gp.game_id) AS total_players
        FROM game_players gp
        INNER JOIN completed_games cg ON cg.game_id = gp.game_id
        INNER JOIN users u ON u.id = gp.user_id
    ),
    player_stats AS (
        SELECT
            gr.email,
            COALESCE(gr.display_name, gr.name, split_part(gr.email, '@', 1)) AS player_name,
            (ARRAY_AGG(gr.image ORDER BY gr.image NULLS LAST))[1] AS player_image,
            COUNT(*) AS games_played,
            SUM(CASE WHEN gr.rank = 1 THEN 1 ELSE 0 END) AS wins_1st,
            SUM(CASE WHEN gr.rank = 2 THEN 1 ELSE 0 END) AS second_place,
            SUM(CASE WHEN gr.rank = 3 THEN 1 ELSE 0 END) AS third_place,
            SUM(CASE WHEN gr.reverse_rank = 1 AND gr.total_players > 1 THEN 1 ELSE 0 END) AS last_place,
            SUM(gr.score) AS total_score,
            -- Average percentile: (total_players - rank) / (total_players - 1) * 100
            -- Handles edge case where total_players = 1 (avoid division by zero)
            ROUND(AVG(
                CASE WHEN gr.total_players > 1
                     THEN ((gr.total_players - gr.rank)::NUMERIC / (gr.total_players - 1)) * 100
                     ELSE 100
                END
            )) AS avg_percentile
        FROM game_rankings gr
        GROUP BY gr.email, COALESCE(gr.display_name, gr.name, split_part(gr.email, '@', 1))
    )
    SELECT
        ps.email,
        ps.player_name,
        ps.player_image,
        ps.games_played,
        ps.wins_1st,
        ps.second_place,
        ps.third_place,
        ps.last_place,
        ps.total_score,
        ps.avg_percentile,
        CASE WHEN ps.games_played > 0
             THEN ROUND((ps.wins_1st::NUMERIC / ps.games_played) * 100)
             ELSE 0
        END AS win_rate,
        CASE WHEN ps.games_played > 0
             THEN ROUND(((ps.wins_1st + ps.second_place + ps.third_place)::NUMERIC / ps.games_played) * 100)
             ELSE 0
        END AS podium_rate
    FROM player_stats ps
    WHERE ps.games_played >= 3
    ORDER BY ps.avg_percentile DESC, ps.wins_1st DESC, ps.total_score DESC;
$$;
