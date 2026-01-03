#!/bin/bash
# fetch-telemetry.sh
# Fetches job telemetry for tickets referenced in /compare commands
# Used by ai-board-assist.yml workflow before Claude executes /compare
#
# Environment variables required:
#   APP_URL - Base URL for API calls
#   WORKFLOW_API_TOKEN - Bearer token for authentication
#   PROJECT_ID - Current project ID
#   BRANCH - Current ticket branch (spec directory name)
#
# Arguments:
#   $1 - Comment content to parse for ticket references

set -e

COMMENT="$1"

if [ -z "$COMMENT" ]; then
  echo "❌ Error: Comment content required as first argument"
  exit 1
fi

if [ -z "$APP_URL" ] || [ -z "$WORKFLOW_API_TOKEN" ] || [ -z "$PROJECT_ID" ] || [ -z "$BRANCH" ]; then
  echo "❌ Error: Required environment variables not set"
  echo "  APP_URL: ${APP_URL:-not set}"
  echo "  WORKFLOW_API_TOKEN: ${WORKFLOW_API_TOKEN:+set}"
  echo "  PROJECT_ID: ${PROJECT_ID:-not set}"
  echo "  BRANCH: ${BRANCH:-not set}"
  exit 1
fi

# Extract ticket references from comment using regex pattern
# Pattern: #[A-Z0-9]{3,6}-[0-9]+ (e.g., #AIB-127, #ABC-1)
TICKETS=$(echo "$COMMENT" | grep -oE '#[A-Z0-9]{3,6}-[0-9]+' | tr -d '#' | sort -u)

if [ -z "$TICKETS" ]; then
  echo "ℹ️ No ticket references found in comment, skipping telemetry fetch"
  exit 0
fi

echo "📊 Found ticket references: $TICKETS"

# Initialize telemetry JSON with generated timestamp
TELEMETRY_JSON=$(jq -n --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{generatedAt: $ts, tickets: {}}')

# Process each ticket
for TICKET_KEY in $TICKETS; do
  echo "📊 Fetching telemetry for $TICKET_KEY..."

  # Step 1: Resolve ticket key to ticket ID via search API
  SEARCH_URL="${APP_URL}/api/projects/${PROJECT_ID}/tickets/search?q=${TICKET_KEY}"

  SEARCH_RESULT=$(curl -sL -w "\n%{http_code}" \
    -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
    "$SEARCH_URL" 2>/dev/null) || {
    echo "⚠️ API request failed for $TICKET_KEY, using empty telemetry"
    TELEMETRY=$(jq -n --arg key "$TICKET_KEY" '{
      ticketKey: $key, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0,
      cacheCreationTokens: 0, costUsd: 0, durationMs: 0, model: null,
      toolsUsed: [], jobCount: 0, hasData: false
    }')
    TELEMETRY_JSON=$(echo "$TELEMETRY_JSON" | jq --arg key "$TICKET_KEY" --argjson tel "$TELEMETRY" '.tickets[$key] = $tel')
    continue
  }

  HTTP_CODE=$(echo "$SEARCH_RESULT" | tail -1)
  SEARCH_BODY=$(echo "$SEARCH_RESULT" | sed '$d')

  if [ "$HTTP_CODE" != "200" ]; then
    echo "⚠️ Search API returned $HTTP_CODE for $TICKET_KEY, using empty telemetry"
    TELEMETRY=$(jq -n --arg key "$TICKET_KEY" '{
      ticketKey: $key, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0,
      cacheCreationTokens: 0, costUsd: 0, durationMs: 0, model: null,
      toolsUsed: [], jobCount: 0, hasData: false
    }')
    TELEMETRY_JSON=$(echo "$TELEMETRY_JSON" | jq --arg key "$TICKET_KEY" --argjson tel "$TELEMETRY" '.tickets[$key] = $tel')
    continue
  fi

  TICKET_ID=$(echo "$SEARCH_BODY" | jq -r '.results[0].id // empty')

  if [ -z "$TICKET_ID" ]; then
    echo "⚠️ Ticket $TICKET_KEY not found, using empty telemetry"
    TELEMETRY=$(jq -n --arg key "$TICKET_KEY" '{
      ticketKey: $key, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0,
      cacheCreationTokens: 0, costUsd: 0, durationMs: 0, model: null,
      toolsUsed: [], jobCount: 0, hasData: false
    }')
    TELEMETRY_JSON=$(echo "$TELEMETRY_JSON" | jq --arg key "$TICKET_KEY" --argjson tel "$TELEMETRY" '.tickets[$key] = $tel')
    continue
  fi

  echo "  → Resolved $TICKET_KEY to ticket ID: $TICKET_ID"

  # Step 2: Fetch jobs for the ticket
  JOBS_URL="${APP_URL}/api/projects/${PROJECT_ID}/tickets/${TICKET_ID}/jobs"

  JOBS_RESULT=$(curl -sL -w "\n%{http_code}" \
    -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
    "$JOBS_URL" 2>/dev/null) || {
    echo "⚠️ Jobs API request failed for $TICKET_KEY, using empty telemetry"
    TELEMETRY=$(jq -n --arg key "$TICKET_KEY" '{
      ticketKey: $key, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0,
      cacheCreationTokens: 0, costUsd: 0, durationMs: 0, model: null,
      toolsUsed: [], jobCount: 0, hasData: false
    }')
    TELEMETRY_JSON=$(echo "$TELEMETRY_JSON" | jq --arg key "$TICKET_KEY" --argjson tel "$TELEMETRY" '.tickets[$key] = $tel')
    continue
  }

  HTTP_CODE=$(echo "$JOBS_RESULT" | tail -1)
  JOBS_BODY=$(echo "$JOBS_RESULT" | sed '$d')

  if [ "$HTTP_CODE" != "200" ]; then
    echo "⚠️ Jobs API returned $HTTP_CODE for $TICKET_KEY, using empty telemetry"
    TELEMETRY=$(jq -n --arg key "$TICKET_KEY" '{
      ticketKey: $key, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0,
      cacheCreationTokens: 0, costUsd: 0, durationMs: 0, model: null,
      toolsUsed: [], jobCount: 0, hasData: false
    }')
    TELEMETRY_JSON=$(echo "$TELEMETRY_JSON" | jq --arg key "$TICKET_KEY" --argjson tel "$TELEMETRY" '.tickets[$key] = $tel')
    continue
  fi

  # Step 3: Aggregate telemetry from COMPLETED jobs
  # Extract completed jobs first, then aggregate
  COMPLETED_JOBS=$(echo "$JOBS_BODY" | jq '[.[] | select(.status == "COMPLETED")]')

  INPUT_TOKENS=$(echo "$COMPLETED_JOBS" | jq '[.[].inputTokens | select(. != null)] | add | if . == null then 0 else . end')
  OUTPUT_TOKENS=$(echo "$COMPLETED_JOBS" | jq '[.[].outputTokens | select(. != null)] | add | if . == null then 0 else . end')
  CACHE_READ=$(echo "$COMPLETED_JOBS" | jq '[.[].cacheReadTokens | select(. != null)] | add | if . == null then 0 else . end')
  CACHE_CREATE=$(echo "$COMPLETED_JOBS" | jq '[.[].cacheCreationTokens | select(. != null)] | add | if . == null then 0 else . end')
  COST=$(echo "$COMPLETED_JOBS" | jq '[.[].costUsd | select(. != null)] | add | if . == null then 0 else . end')
  DURATION=$(echo "$COMPLETED_JOBS" | jq '[.[].durationMs | select(. != null)] | add | if . == null then 0 else . end')
  MODEL=$(echo "$COMPLETED_JOBS" | jq -r '[.[].model | select(. != null)] | first | if . == null then "null" else . end')
  TOOLS=$(echo "$COMPLETED_JOBS" | jq '[.[].toolsUsed | select(. != null) | .[]] | unique | sort')
  JOB_COUNT=$(echo "$COMPLETED_JOBS" | jq 'length')
  HAS_DATA=$(echo "$COST" | jq '. > 0')

  # Build telemetry JSON
  TELEMETRY=$(jq -n \
    --arg key "$TICKET_KEY" \
    --argjson inputTokens "$INPUT_TOKENS" \
    --argjson outputTokens "$OUTPUT_TOKENS" \
    --argjson cacheRead "$CACHE_READ" \
    --argjson cacheCreate "$CACHE_CREATE" \
    --argjson cost "$COST" \
    --argjson duration "$DURATION" \
    --arg model "$MODEL" \
    --argjson tools "$TOOLS" \
    --argjson jobCount "$JOB_COUNT" \
    --argjson hasData "$HAS_DATA" \
    '{
      ticketKey: $key,
      inputTokens: $inputTokens,
      outputTokens: $outputTokens,
      cacheReadTokens: $cacheRead,
      cacheCreationTokens: $cacheCreate,
      costUsd: $cost,
      durationMs: $duration,
      model: (if $model == "null" then null else $model end),
      toolsUsed: $tools,
      jobCount: $jobCount,
      hasData: $hasData
    }')

  JOB_COUNT=$(echo "$TELEMETRY" | jq -r '.jobCount')
  COST=$(echo "$TELEMETRY" | jq -r '.costUsd')
  echo "  → Found $JOB_COUNT completed jobs, total cost: \$${COST}"

  # Add to combined JSON
  TELEMETRY_JSON=$(echo "$TELEMETRY_JSON" | jq --arg key "$TICKET_KEY" --argjson tel "$TELEMETRY" '.tickets[$key] = $tel')
done

# Create specs directory if needed and write context file
mkdir -p "specs/${BRANCH}"
CONTEXT_FILE="specs/${BRANCH}/.telemetry-context.json"
echo "$TELEMETRY_JSON" > "$CONTEXT_FILE"

echo "✅ Telemetry context written to $CONTEXT_FILE"
echo "📄 Content:"
cat "$CONTEXT_FILE"
