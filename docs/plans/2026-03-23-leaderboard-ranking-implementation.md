# Leaderboard Ranking Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace raw percentile ranking with confidence-weighted rating, add regional leaderboards via IP geolocation, and backfill existing games with country codes.

**Architecture:** Update the Postgres `get_leaderboard()` function to accept a country filter and compute confidence ratings. Add `country_code` column to games table. Detect host IP on game creation via Cloudflare header or fallback API. Backfill 217 existing games using player→region mapping.

**Tech Stack:** Postgres (Supabase RPC), Next.js App Router, TypeScript, IP geolocation (CF-IPCountry header)

**Git config:** `user.name="satwa3k"` `user.email="assadmansoor7@gmail.com"`

---

## Player → Region Mapping (for backfill)

**Dubai (AE):**
- waqar.hameed21@gmail.com (😏)
- waseem.ahameed@gmail.com (WTF)
- assadmansoor7@gmail.com (Chingar)
- mohammedranasaif@gmail.com (Saif)
- ismail.abbas0@gmail.com (Undead)
- ykhuzema@gmail.com (Real Africa)
- royalstandardae@gmail.com (Buffering...)
- mu.a.motiwala@gmail.com (Pyare mohan)
- assadmansoor77@gmail.com (Qasoom)

**Pakistan (PK):**
- jehanzebzubair321@gmail.com (Jehanzeb Zubair)
- shoaikhthebrand@gmail.com (Haider Sheikh)
- syedhassanalishams@gmail.com (hassan ali shams)
- omernaeem112@gmail.com (Skimpy Dust)
- aqueelbokhari@gmail.com (Aqueel Bokhari)
- maryum.haider8894@gmail.com (Maryum Haider)
- nishitahemdev@gmail.com (Nishita)
- hafeezbilalhafeez@gmail.com (Hafeez Bilal)
- alyakhan167@gmail.com (alya khan)
- shayantanvir@gmail.com (Shayan Butt)
- hazimkhan1254@gmail.com (hazim khan)
- yasir.ejaz.193@gmail.com (Yasir Ejaz)
- ahmaddar22@gmail.com (Ahmad Z Dar)

**Cross-region:** ahmadjavedashari@gmail.com (Gogo) — games tagged by co-players

---

### Task 1: Add `country_code` Column + Backfill SQL

**User action required:** Run this SQL in Supabase SQL editor (production project).

**Step 1: Write the migration SQL**

Create `sql/002-add-country-code-and-backfill.sql`:

```sql
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

-- Step 3: Tag each game by the MAJORITY region of its players
-- For each game, count AE vs PK players. Majority wins.
-- Cross-region player (Gogo) is excluded from the count — his games are tagged
-- by the OTHER players in the game.
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
```

**Step 2: Commit the migration file**

```bash
git add sql/002-add-country-code-and-backfill.sql
git -c user.name="satwa3k" -c user.email="assadmansoor7@gmail.com" commit -m "sql: add country_code column and backfill existing games by player region"
```

**Step 3: User runs the SQL in Supabase SQL editor**

Expected output: Shows count of games per region (roughly 150+ AE, 50+ PK, some NULL for edge cases).

---

### Task 2: Update `get_leaderboard()` with Confidence Rating + Country Filter

**User action required:** Run updated SQL in Supabase SQL editor after this task.

**Step 1: Write the failing test**

Add to `src/lib/__tests__/leaderboard-rpc.test.ts`:

```typescript
it('passes country_code filter to RPC when provided', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const { getGlobalLeaderboard } = await import('@/lib/db');
    await getGlobalLeaderboard('AE');

    expect(mockRpc).toHaveBeenCalledWith('get_leaderboard', { filter_country: 'AE' });
});

it('passes no filter when country is undefined', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const { getGlobalLeaderboard } = await import('@/lib/db');
    await getGlobalLeaderboard();

    expect(mockRpc).toHaveBeenCalledWith('get_leaderboard', { filter_country: null });
});

it('maps confidence_rating from RPC response', async () => {
    mockRpc.mockResolvedValue({
        data: [{
            email: 'test@test.com',
            player_name: 'Test',
            player_image: null,
            games_played: 50,
            wins_1st: 10,
            second_place: 15,
            third_place: 5,
            last_place: 3,
            total_score: 5000,
            avg_percentile: 65,
            confidence_rating: 61,
            win_rate: 20,
            podium_rate: 60,
        }],
        error: null,
    });

    const { getGlobalLeaderboard } = await import('@/lib/db');
    const result = await getGlobalLeaderboard();

    expect(result[0].averagePercentile).toBe(61); // confidence_rating maps to averagePercentile
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/leaderboard-rpc.test.ts --no-coverage`

**Step 3: Update `src/lib/db.ts` — add country parameter**

Change `getGlobalLeaderboard()` signature and RPC call:

```typescript
export async function getGlobalLeaderboard(countryCode?: string): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabaseAdmin.rpc('get_leaderboard', {
        filter_country: countryCode || null,
    });

    // ... rest stays the same, but map confidence_rating instead of avg_percentile:
    // averagePercentile: Number(row.confidence_rating),
```

**Step 4: Write the updated SQL function**

Create `sql/003-get-leaderboard-v2.sql`:

```sql
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
        SELECT DISTINCT g.id AS game_id
        FROM games g
        INNER JOIN rounds r ON r.game_id = g.id
        WHERE r.state = 'COMPLETED'
          AND (filter_country IS NULL OR g.country_code = filter_country)
    ),
    game_rankings AS (
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
        -- Confidence-weighted rating: pulls small samples toward 50% (global average)
        -- K=30: need ~30 games for rating to stabilize at actual performance
        ROUND((ps.games_played * ps.avg_percentile + 30 * 50) / (ps.games_played + 30)) AS confidence_rating,
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
```

**Step 5: Run tests, commit**

```bash
git add sql/003-get-leaderboard-v2.sql src/lib/db.ts src/lib/__tests__/leaderboard-rpc.test.ts
git -c user.name="satwa3k" -c user.email="assadmansoor7@gmail.com" commit -m "feat(leaderboard): add confidence-weighted rating and country filter

K=30 confidence factor pulls small samples toward average.
Minimum 10 games to appear. Optional country_code filter for regional boards."
```

---

### Task 3: Update Leaderboard API Route to Accept Country Filter

**Files:**
- Modify: `src/app/api/leaderboard/route.ts`
- Test: `src/app/api/leaderboard/__tests__/route.test.ts`

**Step 1: Write the failing test**

Add to route test:

```typescript
it('passes country query param to getGlobalLeaderboard', async () => {
    // Test that GET /api/leaderboard?country=AE passes 'AE' to the function
});
```

**Step 2: Update the route**

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    try {
        const country = req.nextUrl.searchParams.get('country') || undefined;

        // ... cache key should include country
        const cacheKey = country || 'global';

        // ... pass to getGlobalLeaderboard(country)
    }
}
```

**Step 3: Run tests, commit**

```bash
git add src/app/api/leaderboard/route.ts src/app/api/leaderboard/__tests__/route.test.ts
git -c user.name="satwa3k" -c user.email="assadmansoor7@gmail.com" commit -m "feat(api): accept country query param for regional leaderboard filtering"
```

---

### Task 4: Add IP Geolocation on Game Creation

**Files:**
- Create: `src/lib/geolocation.ts`
- Test: `src/lib/__tests__/geolocation.test.ts`
- Modify: `src/app/api/games/route.ts` (POST handler)
- Modify: `src/lib/db.ts` (createGame function)

**Step 1: Write the failing test**

Create `src/lib/__tests__/geolocation.test.ts`:

```typescript
import { getCountryFromRequest } from '@/lib/geolocation';

describe('getCountryFromRequest', () => {
    it('returns country from CF-IPCountry header', () => {
        const headers = new Headers({ 'CF-IPCountry': 'AE' });
        expect(getCountryFromRequest(headers)).toBe('AE');
    });

    it('returns country from X-Vercel-IP-Country header', () => {
        const headers = new Headers({ 'X-Vercel-IP-Country': 'PK' });
        expect(getCountryFromRequest(headers)).toBe('PK');
    });

    it('returns null when no geo headers present', () => {
        const headers = new Headers({});
        expect(getCountryFromRequest(headers)).toBeNull();
    });

    it('normalizes country code to uppercase', () => {
        const headers = new Headers({ 'CF-IPCountry': 'ae' });
        expect(getCountryFromRequest(headers)).toBe('AE');
    });
});
```

**Step 2: Implement geolocation utility**

Create `src/lib/geolocation.ts`:

```typescript
/**
 * Extract country code from request headers.
 * Checks CDN-provided headers (Cloudflare, Vercel, AWS) first,
 * falls back to X-Forwarded-For IP lookup if needed.
 */
export function getCountryFromRequest(headers: Headers): string | null {
    // Cloudflare
    const cfCountry = headers.get('CF-IPCountry');
    if (cfCountry && cfCountry !== 'XX') return cfCountry.toUpperCase();

    // Vercel
    const vercelCountry = headers.get('X-Vercel-IP-Country');
    if (vercelCountry) return vercelCountry.toUpperCase();

    // AWS CloudFront
    const awsCountry = headers.get('CloudFront-Viewer-Country');
    if (awsCountry) return awsCountry.toUpperCase();

    return null;
}
```

**Step 3: Update `createGame` in db.ts to accept country_code**

```typescript
export async function createGame(name: string, ownerId: string, countryCode?: string | null) {
    const { data, error } = await supabaseAdmin
        .from('games')
        .insert({
            name,
            owner_id: ownerId,
            operator_id: ownerId,
            country_code: countryCode || null,
        })
        .select()
        .single();
    // ...
}
```

**Step 4: Update games route POST handler**

```typescript
import { getCountryFromRequest } from '@/lib/geolocation';

// Inside POST handler:
const countryCode = getCountryFromRequest(req.headers);
const game = await createGame(gameName, user.id, countryCode);
```

**Step 5: Run tests, commit**

```bash
git add src/lib/geolocation.ts src/lib/__tests__/geolocation.test.ts src/lib/db.ts src/app/api/games/route.ts
git -c user.name="satwa3k" -c user.email="assadmansoor7@gmail.com" commit -m "feat: detect host country via IP geolocation on game creation

Reads CF-IPCountry, X-Vercel-IP-Country, or CloudFront-Viewer-Country headers.
Stores country_code on the games table for regional leaderboard filtering."
```

---

### Task 5: Add Region Filter Tabs to Leaderboard UI

**Files:**
- Modify: `src/app/leaderboard/page.tsx`
- Modify: `src/components/home/GlobalLeaderboard.tsx` (update min games text)

**Step 1: Add region filter state and tabs**

In `src/app/leaderboard/page.tsx`, add:

```typescript
const [region, setRegion] = useState<string | undefined>(undefined);

// Fetch with region filter
useEffect(() => {
    const url = region ? `/api/leaderboard?country=${region}` : '/api/leaderboard';
    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.leaderboard) setLeaderboard(data.leaderboard);
            setLoading(false);
        })
        .catch(() => { setError('Failed to load'); setLoading(false); });
}, [region]);
```

Add filter tabs above the table:

```tsx
<div className="flex gap-2 justify-center mb-4">
    {[
        { label: 'All', value: undefined },
        { label: '🇦🇪 UAE', value: 'AE' },
        { label: '🇵🇰 Pakistan', value: 'PK' },
    ].map(tab => (
        <button
            key={tab.label}
            onClick={() => setRegion(tab.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                region === tab.value
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--muted)]/30 text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50'
            }`}
        >
            {tab.label}
        </button>
    ))}
</div>
```

**Step 2: Update minimum games text**

In both `src/app/leaderboard/page.tsx` and `src/components/home/GlobalLeaderboard.tsx`, change:
```
"Minimum 3 games to appear on leaderboard"
```
To:
```
"Minimum 10 games to appear on leaderboard"
```

**Step 3: Run tests, commit**

```bash
git add src/app/leaderboard/page.tsx src/components/home/GlobalLeaderboard.tsx
git -c user.name="satwa3k" -c user.email="assadmansoor7@gmail.com" commit -m "feat(leaderboard): add regional filter tabs (All / UAE / Pakistan)

Tabs filter leaderboard by country. Min games text updated to 10."
```

---

### Task 6: Final Verification

**Step 1: Run full test suite**

Run: `npx jest --no-coverage --testPathIgnorePatterns='node_modules|.auto-claude'`
Expected: All tests pass

**Step 2: User runs SQL files in Supabase editor**

1. Run `sql/002-add-country-code-and-backfill.sql` — adds column + backfills regions
2. Run `sql/003-get-leaderboard-v2.sql` — updates the function with confidence rating + country filter

**Step 3: Verify via API**

```bash
# Global leaderboard (all regions, confidence-weighted)
curl -s https://your-app/api/leaderboard | jq '.leaderboard[:5]'

# UAE only
curl -s https://your-app/api/leaderboard?country=AE | jq '.leaderboard[:5]'

# Pakistan only
curl -s https://your-app/api/leaderboard?country=PK | jq '.leaderboard[:5]'
```

**Step 4: Push**

```bash
git push origin main
```

---

## Summary

| Task | What | Risk |
|------|------|------|
| 1 | Add country_code column + backfill via player mapping | Low — additive schema change |
| 2 | Update SQL function: confidence rating + country filter | Medium — changes ranking order |
| 3 | API route accepts `?country=` param | Low — additive |
| 4 | IP geolocation on game creation | Low — new utility |
| 5 | Region filter tabs in UI | Low — UI only |
| 6 | Final verification | — |
