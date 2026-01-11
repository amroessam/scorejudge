#!/bin/bash

# Wait for Kibana to be ready
echo "Waiting for Kibana to be ready..."
until curl -s http://localhost:5601/api/status | grep -q 'available'; do
    echo "Waiting for Kibana..."
    sleep 5
done

echo "Kibana is ready!"

# Create index patterns for traces, logs, and metrics
echo "Creating data views..."

# Create traces data view
curl -X POST "http://localhost:5601/api/data_views/data_view" \
  -H "kbn-xsrf: true" \
  -H "Content-Type: application/json" \
  -d '{
    "data_view": {
      "title": "traces-apm*",
      "name": "APM Traces",
      "timeFieldName": "@timestamp"
    }
  }'

echo ""

# Create logs data view
curl -X POST "http://localhost:5601/api/data_views/data_view" \
  -H "kbn-xsrf: true" \
  -H "Content-Type: application/json" \
  -d '{
    "data_view": {
      "title": "logs-apm*",
      "name": "APM Logs",
      "timeFieldName": "@timestamp"
    }
  }'

echo ""

# Create metrics data view  
curl -X POST "http://localhost:5601/api/data_views/data_view" \
  -H "kbn-xsrf: true" \
  -H "Content-Type: application/json" \
  -d '{
    "data_view": {
      "title": "metrics-apm*",
      "name": "APM Metrics",
      "timeFieldName": "@timestamp"
    }
  }'

echo ""
echo "Data views created successfully!"
echo ""
echo "You can now:"
echo "1. View traces at: http://localhost:5601/app/discover (select 'APM Traces' data view)"
echo "2. View logs at: http://localhost:5601/app/discover (select 'APM Logs' data view)"
echo "3. Search for specific traces with game_id or user_id filters"
echo ""
echo "Example queries:"
echo "  - game_id: \"your-game-id\""
echo "  - user_id: \"your-user-id\""
echo "  - trace_id: \"your-trace-id\""
