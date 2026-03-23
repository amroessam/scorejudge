# Leaderboard Ranking Redesign

**Date:** 2026-03-23
**Status:** Approved

## Problem

1. **Small sample size inflates rankings:** Players with 5-7 games rank above veterans with 190+ games because raw average percentile doesn't account for sample size confidence.
2. **No regional separation:** Players in Dubai and Pakistan play in separate IRL groups but share one global leaderboard. A player who dominates a weaker group inflates their ranking.
3. **Cross-region player:** One player has played in both Dubai and Pakistan — their stats should be split per region.

## Design

### 1. Confidence-Weighted Rating (replaces raw percentile)

**Formula:**

```
confidence_rating = (games_played × avg_percentile + K × 50) / (games_played + K)
```

- `K = 30` (confidence factor — number of games needed for rating to stabilize)
- `50` = neutral starting point (global average)
- Players with 100+ games: rating ≈ their actual avg_percentile
- Players with <10 games: rating pulled strongly toward 50%
- All players appear on the leaderboard (minimum 10 games)

**Why this approach:**
- Used by Microsoft TrueSkill (Halo), Glicko-2 (chess/Lichess), Wilson Score (Reddit)
- Mathematically sound — Bayesian shrinkage toward the prior
- No arbitrary cutoffs — the formula naturally handles small samples
- Retroactive — applies to all existing games, no data migration needed

**Minimum games to appear:** 10 (raised from 3)

### 2. Regional Leaderboards (IP Geolocation)

**Data model:**

```sql
ALTER TABLE games ADD COLUMN country_code TEXT DEFAULT NULL;
```

**How region is determined:**
- On game creation, detect the host's IP country via Cloudflare `CF-IPCountry` header
- Fallback: free IP geolocation API (ip-api.com or similar)
- Store as ISO 3166-1 alpha-2 country code (e.g., `AE`, `PK`)
- This is an IRL game — the host's phone IP determines the game's location

**Leaderboard views:**
- **Global (default):** All games, all players, combined stats
- **Regional filter:** Filter by country code. Shows only games played in that region.
- Players appear on every regional board where they have games
- Stats are split per region (a player's Dubai wins ≠ their Pakistan wins)

**UI:** Tab/filter bar above the leaderboard table: `All | 🇦🇪 UAE | 🇵🇰 Pakistan`

### 3. Cross-Region Player Handling

A player who plays in both regions:
- **UAE leaderboard:** Shows only their UAE-game stats (wins, losses, percentile from UAE games)
- **Pakistan leaderboard:** Shows only their Pakistan-game stats
- **Global leaderboard:** Shows combined stats from all regions
- Confidence rating calculated independently per region

### 4. Backfill Existing Games

Existing 217 games have no `country_code`. Strategy:
- Tag players by region (user provides: "these emails = Dubai, these = Pakistan")
- Games where ALL players are from the same region → tagged as that region
- Mixed-region games → tagged based on game creator's (owner's) region
- Implemented as a one-time SQL script after user provides the player→region mapping

### 5. SQL Function Update

Update `get_leaderboard()` to:
- Accept optional `country_code` parameter for filtering
- Calculate `confidence_rating` using the K=30 formula
- Sort by `confidence_rating DESC` instead of `avg_percentile DESC`
- Filter `WHERE games_played >= 10`

```sql
CREATE OR REPLACE FUNCTION get_leaderboard(filter_country TEXT DEFAULT NULL)
RETURNS TABLE (...) AS $$
    -- Same CTE structure, but:
    -- 1. Filter completed_games by country_code if filter_country is provided
    -- 2. Calculate confidence_rating in player_stats CTE
    -- 3. Sort by confidence_rating DESC
    -- 4. WHERE games_played >= 10
$$;
```

## Files Changed

| File | Change |
|------|--------|
| `sql/get_leaderboard.sql` | Add confidence_rating, country filter, min 10 games |
| `games` table | Add `country_code` column |
| `src/lib/db.ts` | Pass country_code param to RPC |
| `src/app/api/leaderboard/route.ts` | Accept `?country=AE` query param |
| `src/app/leaderboard/page.tsx` | Add region filter tabs |
| `src/components/home/GlobalLeaderboard.tsx` | Update minimum games text |
| `server.ts` or game creation route | Add IP geolocation on game create |

## Out of Scope

- Player groups/rooms (YAGNI — IP geolocation is simpler)
- Manual location picker (auto-detect is sufficient)
- Historical IP tracking (one IP per game creation is enough)
- ELO/MMR rating systems (overkill for a card game among friends)
