# Observability Setup - ELK Stack with OpenTelemetry

Complete observability solution with traces, logs, and metrics correlation.

## Quick Start

### 1. Start the ELK Stack

```bash
docker compose -f docker-compose.observability.yml up -d
```

Wait ~30 seconds for all services to be healthy.

### 2. Configure Kibana Data Views

```bash
./setup-kibana.sh
```

This creates data views for traces, logs, and metrics.

### 3. Restart Your Application

```bash
# Stop current dev server (Ctrl+C)
npm run dev
```

You should see: `[Tracing] OpenTelemetry SDK initialized`

## Viewing Data in Kibana

### Access Kibana
Open http://localhost:5601

### View Traces
1. Go to **Analytics → Discover**
2. Select **APM Traces** data view
3. You'll see all traces with:
   - `trace_id` - Unique trace identifier
   - `span_id` - Span identifier  
   - `user_id` - Database user ID
   - `user_email` - User email
   - `game_id` - Game UUID
   - `game_name` - Game name
   - `http.method` - HTTP method (GET, POST, etc.)
   - `http.route` - API route pattern

### View Logs
1. Go to **Analytics → Discover**
2. Select **APM Logs** data view
3. Logs include:
   - `trace_id` - Correlates with traces
   - `span_id` - Current span
   - `user_id` - User context
   - `game_id` - Game context
   - `level` - Log level (info, warn, error)
   - `msg` - Log message

### Search Examples

**Find all traces for a specific game:**
```
game_id: "abc123-def456-..."
```

**Find all logs for a specific user:**
```
user_id: "user-uuid-here"
```

**Find traces and logs for a specific request:**
```
trace_id: "trace-id-here"
```

**Find errors:**
```
level: "error"
```

**Find game creation events:**
```
msg: "Creating new game"
```

## Trace & Log Correlation

Every log automatically includes `trace_id` and `span_id`, allowing you to:

1. **From Trace → Logs**: Copy the `trace_id` from a trace and search logs
2. **From Log → Trace**: Copy the `trace_id` from a log and search traces
3. **Full Request Flow**: See the complete request flow with all logs in context

## Architecture

```
Application (Next.js)
    ↓ (OTLP/HTTP on port 4318)
OpenTelemetry Collector
    ↓ (ECS format)
Elasticsearch
    ↓
Kibana (Visualization)
```

## Services

| Service        | URL                     | Purpose                          |
|---------------|-------------------------|----------------------------------|
| Kibana        | http://localhost:5601   | Visualization & search UI        |
| Elasticsearch | http://localhost:9200   | Data storage                     |
| OTEL Collector| http://localhost:4318   | Trace/log collection             |

## Instrumented Components

### API Routes
- `GET /api/games` - List user's games
- `POST /api/games` - Create new game
- `GET /api/games/{gameId}` - Get game details
- `PATCH /api/games/{gameId}` - Update game
- `DELETE /api/games/{gameId}` - Delete/leave game

### WebSocket
- Game connections with real-time updates
- Discovery channel for game listings

### Logs
All logs include:
- Trace context (`trace_id`, `span_id`)
- Business context (`user_id`, `game_id`)
- Structured fields for filtering

## Troubleshooting

### No traces appearing?
1. Check OTEL Collector logs: `docker logs otel-collector`
2. Verify app is sending traces: Look for `[Tracing] OpenTelemetry SDK initialized`
3. Check Elasticsearch indices: `curl http://localhost:9200/_cat/indices?v`

### Can't see logs?
1. Ensure Pino instrumentation is active
2. Check that logs include `trace_id` field
3. Verify logs index exists: `curl http://localhost:9200/logs-apm/_count`

### Kibana not showing data views?
Run the setup script again: `./setup-kibana.sh`

## Environment Variables

| Variable                      | Default              | Description              |
|------------------------------|----------------------|--------------------------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | http://localhost:4318 | OTEL Collector endpoint |
| `LOG_LEVEL`                   | info                 | Minimum log level        |

## Stopping the Stack

```bash
# Stop containers
docker compose -f docker-compose.observability.yml down

# Stop and remove data
docker compose -f docker-compose.observability.yml down -v
```

## Example Workflow

1. **User creates a game**
   - Trace shows: POST /api/games with `user_id` and `game_id`
   - Logs show: "Creating new game" with same `trace_id`

2. **Search for that user's activity**
   ```
   user_id: "their-user-id"
   ```

3. **Find all operations on that game**
   ```
   game_id: "the-game-id"
   ```

4. **Investigate an error**
   - Find error log
   - Copy `trace_id`
   - Search traces to see full request context
