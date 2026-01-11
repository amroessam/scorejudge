# ELK Stack + OpenTelemetry - Setup Complete! ✅

## What's Been Configured

### 1. **ELK Stack** (Running in Docker)
- ✅ Elasticsearch - Data storage
- ✅ Kibana - Visualization UI at http://localhost:5601
- ✅ OpenTelemetry Collector - Trace/log collection

### 2. **Application Instrumentation**
- ✅ OpenTelemetry SDK initialized in `src/lib/tracing.ts`
- ✅ Structured logging with Pino in `src/lib/logger.ts`
- ✅ API routes instrumented with traces
- ✅ WebSocket connections instrumented
- ✅ Automatic trace context injection into logs

### 3. **Kibana Data Views**
- ✅ APM Traces data view
- ✅ APM Logs data view
- ✅ APM Metrics data view

## Next Steps - IMPORTANT!

### 1. Restart Your Dev Server
Your app is currently running with the OLD code. You need to restart it:

```bash
# In your terminal running npm run dev, press Ctrl+C
# Then restart:
npm run dev
```

You should see:
```
[Tracing] OpenTelemetry SDK initialized
```

### 2. Generate Some Activity
Use your app to create traces and logs:
- Sign in
- Create a game
- View games list
- Join a game
- Any API interaction

### 3. View in Kibana

**Open Kibana:** http://localhost:5601

**View Traces:**
1. Go to **Analytics → Discover**
2. Select **APM Traces** data view
3. You'll see traces with:
   - `TraceId` - Unique trace identifier
   - `SpanId` - Span identifier
   - `Attributes.user.id` - User ID
   - `Attributes.user.email` - User email
   - `Attributes.game.id` - Game ID
   - `Attributes.game.name` - Game name
   - `Attributes.http.method` - HTTP method
   - `Attributes.http.route` - API route

**View Logs:**
1. Go to **Analytics → Discover**
2. Select **APM Logs** data view
3. Logs include:
   - `trace_id` - Correlates with traces
   - `span_id` - Current span
   - `user_id` - User context
   - `game_id` - Game context
   - `level` - Log level
   - `msg` - Log message

## Example Searches in Kibana

**Find all activity for a specific user:**
```
Attributes.user.id: "user-uuid-here"
```

**Find all operations on a specific game:**
```
Attributes.game.id: "game-uuid-here"
```

**Find all POST requests:**
```
Attributes.http.method: "POST"
```

**Find errors:**
```
level: "error"
```

**Correlate logs with traces:**
1. Find a log entry
2. Copy its `trace_id`
3. Switch to APM Traces data view
4. Search: `TraceId: "paste-trace-id-here"`
5. See the complete request flow!

## What You Get

### For Each User Action:
- **Traces** show the request flow through your API
- **Logs** show detailed operations with context
- **Both** are correlated via `trace_id`

### Context Included:
- `user_id` - Who performed the action
- `user_email` - User's email
- `game_id` - Which game (when applicable)
- `game_name` - Game name
- `trace_id` - Links logs to traces
- `span_id` - Current operation

## Instrumented Endpoints

All these routes now have traces and structured logs:

- `GET /api/games` - List user's games
- `POST /api/games` - Create new game
- `GET /api/games/{gameId}` - Get game details
- `PATCH /api/games/{gameId}` - Update game
- `DELETE /api/games/{gameId}` - Delete/leave game
- WebSocket connections

## Troubleshooting

**Not seeing traces?**
1. Did you restart the dev server?
2. Check: `docker logs otel-collector`
3. Verify: `curl http://localhost:9200/_cat/indices?v`

**Not seeing logs?**
1. Restart dev server
2. Check logs include `trace_id` field
3. Use the app to generate activity

**Kibana not showing data?**
1. Wait 10-30 seconds for data to appear
2. Refresh the Discover page
3. Check time range (top right) - set to "Last 15 minutes"

## Files Created/Modified

### New Files:
- `docker-compose.observability.yml` - ELK stack configuration
- `otel-collector-config.yaml` - OTEL Collector configuration
- `src/lib/logger.ts` - Structured logging with trace context
- `src/lib/tracing.ts` - OpenTelemetry instrumentation
- `src/instrumentation.ts` - Next.js instrumentation hook
- `setup-kibana.sh` - Kibana setup script
- `OBSERVABILITY.md` - Complete documentation

### Modified Files:
- `src/app/api/games/route.ts` - Added structured logging
- `server.ts` - Added WebSocket tracing
- `package.json` - Added OTEL and Pino packages

## Quick Commands

```bash
# View OTEL Collector logs
docker logs -f otel-collector

# Check Elasticsearch indices
curl http://localhost:9200/_cat/indices?v

# Count traces
curl http://localhost:9200/traces-scorejudge/_count

# Stop ELK stack
docker compose -f docker-compose.observability.yml down

# Restart ELK stack
docker compose -f docker-compose.observability.yml up -d
```

## Success Criteria

After restarting your dev server and using the app, you should see:

1. ✅ Traces in Kibana with `user_id` and `game_id`
2. ✅ Logs in Kibana with `trace_id` for correlation
3. ✅ Ability to search by user, game, or trace
4. ✅ Complete request flow visibility

**Now restart your dev server and start exploring! 🚀**
