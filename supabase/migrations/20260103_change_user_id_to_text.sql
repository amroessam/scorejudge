-- Change user ID columns from UUID to TEXT to support debug/anonymous users
-- This allows both real UUIDs (from Google OAuth) and string IDs (from debug mode)

-- Drop foreign key constraints first
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_owner_id_fkey;
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_operator_id_fkey;
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_first_dealer_id_fkey;
ALTER TABLE game_players DROP CONSTRAINT IF EXISTS game_players_user_id_fkey;
ALTER TABLE round_players DROP CONSTRAINT IF EXISTS round_players_user_id_fkey;

-- Change column types from UUID to TEXT
ALTER TABLE users ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE games ALTER COLUMN owner_id TYPE TEXT USING owner_id::TEXT;
ALTER TABLE games ALTER COLUMN operator_id TYPE TEXT USING operator_id::TEXT;
ALTER TABLE games ALTER COLUMN first_dealer_id TYPE TEXT USING first_dealer_id::TEXT;
ALTER TABLE game_players ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE round_players ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Re-add foreign key constraints
ALTER TABLE games ADD CONSTRAINT games_owner_id_fkey 
  FOREIGN KEY (owner_id) REFERENCES users(id);
ALTER TABLE games ADD CONSTRAINT games_operator_id_fkey 
  FOREIGN KEY (operator_id) REFERENCES users(id);
ALTER TABLE games ADD CONSTRAINT games_first_dealer_id_fkey 
  FOREIGN KEY (first_dealer_id) REFERENCES users(id);
ALTER TABLE game_players ADD CONSTRAINT game_players_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE round_players ADD CONSTRAINT round_players_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id);
