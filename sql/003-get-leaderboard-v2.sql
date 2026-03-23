-- ScoreJudge: Updated leaderboard function with confidence-weighted rating + country filter
-- RUN THIS IN YOUR SUPABASE SQL EDITOR (production project: cbvdfouitqpdjjwiqokk)
-- AFTER running 002-add-country-code-and-backfill.sql

CREATE OR REPLACE FUNCTION get_leaderboard(filter_country TEXT DEFAULT NULL)
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
    confidence_rating NUMERIC,
    win_rate NUMERIC,
    podium_rate NUMERIC
)
LANGUAGE sql
STABLE
AS $$
    WITH completed_games AS (
        -- Get games that have at least one completed round
        -- Optionally filter by country_code
        SELECT DISTINCT g.id AS game_id
        FROM games g
        INNER JOIN rounds r ON r.game_id = g.id
        WHERE r.state = 'COMPLETED'
          AND (filter_country IS NULL OR g.country_code = filter_country)
    ),
    game_rankings AS (
        -- For each completed game, rank players by score using DENSE_RANK
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
            -- Raw average percentile (before confidence weighting)
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
        -- Confidence-weighted rating (Bayesian shrinkage toward global average)
        -- K=30: need ~30 games for rating to fully reflect actual performance
        -- Players with few games get pulled toward 50% (neutral)
        -- Players with 100+ games: rating ≈ their actual avg_percentile
        ROUND((ps.games_played * ps.avg_percentile + 30 * 50)::NUMERIC / (ps.games_played + 30)) AS confidence_rating,
        CASE WHEN ps.games_played > 0
             THEN ROUND((ps.wins_1st::NUMERIC / ps.games_played) * 100)
             ELSE 0
        END AS win_rate,
        CASE WHEN ps.games_played > 0
             THEN ROUND(((ps.wins_1st + ps.second_place + ps.third_place)::NUMERIC / ps.games_played) * 100)
             ELSE 0
        END AS podium_rate
    FROM player_stats ps
    WHERE ps.games_played >= 10
    ORDER BY confidence_rating DESC, ps.wins_1st DESC, ps.total_score DESC;
$$;
