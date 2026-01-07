-- Add is_hidden flag to game_players for soft delete
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- Add index for performance on filtering
CREATE INDEX IF NOT EXISTS idx_game_players_is_hidden ON game_players(user_id, is_hidden);
