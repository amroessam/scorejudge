# 🎯 Observability Setup - COMPLETE

## ✅ What's Running

**ELK Stack with Native APM:**
- ✅ Elasticsearch on port 9200
- ✅ Kibana on port 5601
- ✅ APM Server on port 8200 (Native Elastic APM format)

## 🚀 CRITICAL: Restart Your Dev Server

Your app needs to be restarted to load the APM agent:

```bash
# Stop current server (Ctrl+C), then:
npm run dev
```

You should see APM agent initialization logs.

## 📊 View Data in Kibana

### 1. Open Kibana APM
http://localhost:5601/app/apm

You should now see the **scorejudge** service!

### 2. Explore Traces
- Click on "scorejudge" service
- View transactions (API requests)
- See errors and performance metrics
- Drill down into individual traces

### 3. Custom Context
Every trace includes:
- `user.id` - User database ID
- `user.email` - User email
- `game.id` - Game UUID
- `game.name` - Game name
- All HTTP details

## 🔍 What's Been Logged

### Database Operations (src/lib/db.ts)
- ✅ `getUserByEmail` - With timing
- ✅ `upsertUser` - With full context
- ✅ `updateUser` - With changes tracked
- ✅ `createGame` - With owner info
- ✅ `addPlayer` - With game/user context
- All with debug, info, and error levels

### API Routes
- ✅ `/api/games` (GET/POST) - Full tracing
- ✅ `/api/games/{gameId}` (GET/PATCH/DELETE) - Full tracing
- ✅ `/api/games/{gameId}/rounds` (POST) - Detailed round operations
  - START action with player validation
  - BIDS action with dealer constraint
  - TRICKS action with distribution validation
  - UNDO action with score rollback
- All with structured logging

### WebSocket
- ✅ Game connections
- ✅ Discovery channel
- With user and game context

## 🎨 Log Levels

All logs include:
- `trace_id` - Links to APM traces
- `span_id` - Current operation
- `user_id` - Who did it
- `game_id` - Which game
- `duration` - How long it took
- `module` - Which part of code

### Levels Used:
- **debug** - Detailed operations (DB queries, validations)
- **info** - Important events (user created, game started)
- **warn** - Warnings (forbidden access, constraints)
- **error** - Failures (DB errors, validation failures)

## 📈 Example Queries in Kibana

### Find all errors:
```
Filter by: transaction.result = "error"
```

### Find slow requests:
```
Filter by: transaction.duration.us > 1000000  (>1 second)
```

### Find specific user activity:
```
Search: user.id:"user-uuid-here"
```

### Find game operations:
```
Search: game.id:"game-uuid-here"
```

## 🐛 Debugging Workflow

### When something goes wrong:

1. **Check APM Errors Tab**
   - See all errors with full stack traces
   - Click to see the full trace

2. **View Transaction Timeline**
   - See exactly what happened
   - Database queries, API calls, everything

3. **Check Logs**
   - Structured logs with full context
   - Correlated with traces via `trace_id`

4. **Search by Context**
   - Filter by user_id, game_id, or any custom field
   - See the complete user journey

## 📝 What's Instrumented

### Authentication
- User lookup by email
- User creation/update
- OAuth flow (via APM auto-instrumentation)

### Game Operations
- Game creation with player addition
- Player joining
- Round management (START, BIDS, TRICKS, UNDO)
- Score calculations
- Game deletion/leaving

### Database
- All Supabase queries
- Connection timing
- Error tracking
- Query parameters

### WebSocket
- Connection establishment
- Game state broadcasts
- Discovery updates

## 🔧 Configuration

### APM Agent (apm.js)
```javascript
serviceName: 'scorejudge'
serverUrl: 'http://localhost:8200'
environment: 'development'
captureBody: 'all'  // Captures request/response bodies
captureHeaders: true  // Captures HTTP headers
```

### Environment Variables
```bash
ELASTIC_APM_SERVER_URL=http://localhost:8200  # APM Server
NODE_ENV=development  # Environment
LOG_LEVEL=debug  # Minimum log level
```

## 🎯 Success Criteria

After restarting your dev server:

1. ✅ See "scorejudge" service in Kibana APM
2. ✅ Traces appear for each API request
3. ✅ Custom fields (user_id, game_id) visible
4. ✅ Errors show up with full context
5. ✅ Database operations tracked with timing
6. ✅ Can search by user or game

## 🚨 Troubleshooting

**APM not showing data?**
```bash
# Check APM Server
curl http://localhost:8200/

# Check logs
docker logs apm-server

# Restart dev server
npm run dev
```

**No traces appearing?**
1. Restart your dev server
2. Make a request (create a game, view games)
3. Wait 10-30 seconds
4. Refresh Kibana APM

**Elasticsearch issues?**
```bash
# Check health
curl http://localhost:9200/_cluster/health?pretty

# Check indices
curl http://localhost:9200/_cat/indices?v
```

## 📚 Next Steps

1. **Restart dev server** - Load APM agent
2. **Use the app** - Generate traces
3. **Open Kibana APM** - See your data
4. **Explore traces** - Click through transactions
5. **Debug issues** - Use the full context

**Now restart your dev server and check Kibana APM! 🎉**
