# ✅ APM is Now Fully Configured!

## 🎯 Access Your Data

### Kibana APM UI
**URL:** http://localhost:5601/app/apm

You should now see the **scorejudge** service!

### What You'll See

**Services Tab:**
- Service name: `scorejudge`
- Environment: `development`
- Runtime: Node.js 25.2.1

**Transactions:**
- `GET /api/games`
- `POST /api/games`
- `GET /api/games/{gameId}`
- `GET /api/games/discover`
- And all other API routes

**Each Transaction Includes:**
- Duration and timing
- HTTP status codes
- Error rates
- Throughput

### Custom Context in Every Trace

All traces include:
- `user.id` - Database user ID
- `user.email` - User email  
- `game.id` - Game UUID
- `game.name` - Game name
- `trace.id` - For log correlation

## 📊 Viewing Your Data

### Option 1: APM UI (Recommended)
1. Go to http://localhost:5601/app/apm
2. Click on "scorejudge" service
3. Explore:
   - **Transactions** - See all API requests
   - **Errors** - View all errors with stack traces
   - **Metrics** - Performance over time
   - **Service Map** - Visual dependencies

### Option 2: Discover
1. Go to http://localhost:5601/app/discover
2. Select index pattern: `apm-7.17.15-transaction-*`
3. Search and filter:
   ```
   service.name: "scorejudge"
   transaction.name: "GET /api/games"
   ```

### Option 3: Direct Elasticsearch
```bash
# All transactions
curl 'http://localhost:9200/apm-7.17.15-transaction-*/_search?pretty&size=10'

# Specific service
curl 'http://localhost:9200/apm-7.17.15-transaction-*/_search?q=service.name:scorejudge&pretty'
```

## 🔍 Structured Logs

Your terminal shows structured logs with full context:

```json
{
  "level": "info",
  "trace_id": "55c5da860063595e5c0de213e428b370",
  "span_id": "69be45ea2fcb4961",
  "user_id": "104031088875306096940",
  "user_email": "assadmansoor7@gmail.com",
  "game_id": "12763ac9-3eff-49a1-8869-3760d0365f26",
  "game_name": "potato",
  "msg": "Creating new game"
}
```

## 🎯 What's Instrumented

### API Routes
- ✅ `/api/games` (GET, POST)
- ✅ `/api/games/{gameId}` (GET, PATCH, DELETE)
- ✅ `/api/games/{gameId}/rounds` (POST - all actions)
- ✅ `/api/games/discover`
- ✅ All other routes (auto-instrumented)

### Database Operations
- ✅ `getUserByEmail` - with timing
- ✅ `upsertUser` - with full context
- ✅ `createGame` - with owner info
- ✅ `addPlayer` - with game/user context
- ✅ All queries logged with duration

### Errors
- ✅ All 4xx errors (validation, auth, not found)
- ✅ All 5xx errors (server errors, DB errors)
- ✅ Full stack traces
- ✅ Request context

## 🐛 Debugging Workflow

### Find an Error
1. Go to APM → Errors tab
2. See all errors with counts
3. Click to see full details

### Trace a Request
1. Go to APM → Transactions
2. Find slow or failed requests
3. Click to see timeline
4. See all database queries, external calls

### Search by User
In Discover:
```
user.id: "your-user-id"
```

### Search by Game
In Discover:
```
game.id: "your-game-id"
```

### Correlate Logs with Traces
1. Find a log in your terminal with `trace_id`
2. Search in Discover: `trace.id: "that-trace-id"`
3. See the complete request flow

## 📈 Performance Monitoring

### Slow Transactions
APM → Transactions → Sort by duration

### Error Rate
APM → Service overview → Error rate chart

### Throughput
APM → Service overview → Throughput chart

### Database Performance
APM → Transactions → Click transaction → See DB spans

## ✅ Verification

Run these commands to verify everything:

```bash
# Check services are running
docker compose -f docker-compose.observability.yml ps

# Check Elasticsearch has data
curl 'http://localhost:9200/_cat/indices?v' | grep apm

# Check APM Server is healthy
curl http://localhost:8200/

# Check Kibana is healthy
curl http://localhost:5601/api/status
```

## 🎉 Success Criteria

- ✅ Kibana APM shows "scorejudge" service
- ✅ Transactions appear with timing
- ✅ Errors show with stack traces
- ✅ Logs include trace_id, user_id, game_id
- ✅ Can search by user or game
- ✅ Full request flow visible

**Everything is now fully configured and working!** 🚀

Open http://localhost:5601/app/apm and explore your data!
