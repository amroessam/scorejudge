-- ScoreJudge: Add country_code column and backfill existing games
-- RUN THIS IN YOUR SUPABASE SQL EDITOR (production project: cbvdfouitqpdjjwiqokk)

-- Step 1: Add country_code column to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT NULL;

-- Step 2: Create temporary player-region mapping
CREATE TEMP TABLE player_regions (email TEXT, region TEXT);
INSERT INTO player_regions (email, region) VALUES
    -- Dubai (AE)
    ('waqar.hameed21@gmail.com', 'AE'),
    ('waseem.ahameed@gmail.com', 'AE'),
    ('assadmansoor7@gmail.com', 'AE'),
    ('mohammedranasaif@gmail.com', 'AE'),
    ('ismail.abbas0@gmail.com', 'AE'),
    ('ykhuzema@gmail.com', 'AE'),
    ('royalstandardae@gmail.com', 'AE'),
    ('mu.a.motiwala@gmail.com', 'AE'),
    ('assadmansoor77@gmail.com', 'AE'),
    -- Pakistan (PK)
    ('jehanzebzubair321@gmail.com', 'PK'),
    ('shoaikhthebrand@gmail.com', 'PK'),
    ('syedhassanalishams@gmail.com', 'PK'),
    ('omernaeem112@gmail.com', 'PK'),
    ('aqueelbokhari@gmail.com', 'PK'),
    ('maryum.haider8894@gmail.com', 'PK'),
    ('nishitahemdev@gmail.com', 'PK'),
    ('hafeezbilalhafeez@gmail.com', 'PK'),
    ('alyakhan167@gmail.com', 'PK'),
    ('shayantanvir@gmail.com', 'PK'),
    ('hazimkhan1254@gmail.com', 'PK'),
    ('yasir.ejaz.193@gmail.com', 'PK'),
    ('ahmaddar22@gmail.com', 'PK');
    -- Note: Gogo (ahmadjavedashari@gmail.com) is cross-region — tagged by co-players

-- Step 3: Tag each game by the MAJORITY region of its players
WITH game_region_counts AS (
    SELECT
        gp.game_id,
        pr.region,
        COUNT(*) as player_count
    FROM game_players gp
    JOIN users u ON u.id = gp.user_id
    JOIN player_regions pr ON pr.email = u.email
    GROUP BY gp.game_id, pr.region
),
game_majority_region AS (
    SELECT DISTINCT ON (game_id)
        game_id,
        region
    FROM game_region_counts
    ORDER BY game_id, player_count DESC, region
)
UPDATE games g
SET country_code = gmr.region
FROM game_majority_region gmr
WHERE g.id = gmr.game_id
  AND g.country_code IS NULL;

-- Step 4: Verify
SELECT country_code, COUNT(*) as game_count
FROM games
GROUP BY country_code
ORDER BY game_count DESC;

DROP TABLE player_regions;
