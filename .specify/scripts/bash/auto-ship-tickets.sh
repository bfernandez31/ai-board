#!/bin/bash
# Auto-Ship Tickets After Vercel Production Deployment
#
# This script is called by auto-ship.yml workflow after successful Vercel production deployment.
# It finds all tickets in VERIFY stage with commits in the deployed SHA and transitions them to SHIP.
#
# Usage: auto-ship-tickets.sh <deployment_sha> <app_url> <workflow_api_token>

set -e

# Parse arguments
DEPLOYMENT_SHA=$1
APP_URL=$2
WORKFLOW_API_TOKEN=$3

# Validate required arguments
if [ -z "$DEPLOYMENT_SHA" ] || [ -z "$APP_URL" ] || [ -z "$WORKFLOW_API_TOKEN" ]; then
  echo "❌ Error: Missing required arguments"
  echo "Usage: $0 <deployment_sha> <app_url> <workflow_api_token>"
  exit 1
fi

echo "🚀 Auto-Ship: Finding tickets to ship for deployment..."
echo "  Deployment SHA: $DEPLOYMENT_SHA"
echo "  API URL: $APP_URL"

# Step 1: Fetch all tickets in VERIFY stage from API
echo ""
echo "📋 Fetching tickets in VERIFY stage..."

# Get project ID from repository (assuming project 3 for production deployment)
# In production, you might want to make this configurable via environment variable
PROJECT_ID=3

echo "  API URL: ${APP_URL}/api/projects/${PROJECT_ID}/tickets/verify"
TICKETS_RESPONSE=$(curl -X GET "${APP_URL}/api/projects/${PROJECT_ID}/tickets/verify" \
  -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -w "\n%{http_code}" \
  -s -S)

# Extract HTTP status code and response body
HTTP_CODE=$(echo "$TICKETS_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$TICKETS_RESPONSE" | head -n-1)

echo "  HTTP Status: $HTTP_CODE"

# Check if request was successful
if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Error: Failed to fetch tickets (HTTP $HTTP_CODE)"
  echo "Response: $RESPONSE_BODY"
  exit 1
fi

# Validate JSON response
if ! echo "$RESPONSE_BODY" | jq -e . >/dev/null 2>&1; then
  echo "❌ Error: Invalid JSON response from API"
  echo "Response: $RESPONSE_BODY"
  exit 1
fi

TICKETS_RESPONSE="$RESPONSE_BODY"

# Parse ticket IDs and branches from response
TICKET_COUNT=$(echo "$TICKETS_RESPONSE" | jq -r '.tickets | length')

if [ "$TICKET_COUNT" -eq 0 ]; then
  echo "ℹ️  No tickets in VERIFY stage - nothing to ship"
  exit 0
fi

echo "✅ Found ${TICKET_COUNT} ticket(s) in VERIFY stage"

# Step 2: For each ticket, check if its branch is included in deployed commit
echo ""
echo "🔍 Checking which tickets are included in deployment..."

SHIPPED_COUNT=0
SKIPPED_COUNT=0

echo "$TICKETS_RESPONSE" | jq -c '.tickets[]' | while read -r ticket; do
  TICKET_ID=$(echo "$ticket" | jq -r '.id')
  TICKET_BRANCH=$(echo "$ticket" | jq -r '.branch // ""')
  TICKET_TITLE=$(echo "$ticket" | jq -r '.title')

  echo ""
  echo "  Ticket #${TICKET_ID}: ${TICKET_TITLE}"
  echo "    Branch: ${TICKET_BRANCH}"

  # Skip tickets without branch (should not happen, but handle gracefully)
  if [ -z "$TICKET_BRANCH" ] || [ "$TICKET_BRANCH" = "null" ]; then
    echo "    ⚠️  Skipping (no branch associated)"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    continue
  fi

  # Check if branch is merged into deployed commit
  # Uses git merge-base to check if branch commit is an ancestor of deployed SHA
  echo "    🔍 Checking if branch merged into ${DEPLOYMENT_SHA:0:7}..."

  # Fetch the branch from remote
  git fetch origin "${TICKET_BRANCH}" --depth=50 >/dev/null 2>&1 || {
    echo "    ⚠️  Skipping (branch not found on remote)"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    continue
  }

  # Get the latest commit on the ticket branch
  BRANCH_COMMIT=$(git rev-parse "origin/${TICKET_BRANCH}" 2>/dev/null || echo "")

  if [ -z "$BRANCH_COMMIT" ]; then
    echo "    ⚠️  Skipping (could not resolve branch commit)"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    continue
  fi

  # Check if branch commit is an ancestor of deployment commit (i.e., merged)
  if git merge-base --is-ancestor "${BRANCH_COMMIT}" "${DEPLOYMENT_SHA}" 2>/dev/null; then
    echo "    ✅ Branch merged into deployment"

    # Transition ticket to SHIP
    echo "    📦 Transitioning to SHIP stage..."
    TRANSITION_RESPONSE=$(curl -X POST "${APP_URL}/api/projects/${PROJECT_ID}/tickets/${TICKET_ID}/transition" \
      -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{"targetStage": "SHIP"}' \
      -w "\n%{http_code}" \
      -s -S)

    HTTP_CODE=$(echo "$TRANSITION_RESPONSE" | tail -n1)

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
      echo "    ✅ Successfully transitioned to SHIP"
      SHIPPED_COUNT=$((SHIPPED_COUNT + 1))

      # Post comment notification
      echo "    💬 Posting deployment notification..."
      curl -X POST "${APP_URL}/api/projects/${PROJECT_ID}/tickets/${TICKET_ID}/comments/ai-board" \
        -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{\"content\": \"🚀 **Deployed to Production**\\n\\nThis ticket has been automatically shipped after successful Vercel deployment.\\n\\n**Deployment SHA**: \\\`${DEPLOYMENT_SHA:0:7}\\\`\\n**Environment**: Production\\n**Status**: Live\", \"userId\": \"ai-board-system-user\"}" \
        -f -s -S >/dev/null 2>&1 || echo "    ⚠️  Failed to post deployment comment (continuing...)"
    else
      echo "    ⚠️  Failed to transition (HTTP $HTTP_CODE)"
      echo "    Response: $(echo "$TRANSITION_RESPONSE" | head -n-1)"
    fi
  else
    echo "    ℹ️  Skipping (branch not merged in this deployment)"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
  fi
done

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Auto-Ship Complete"
echo "  📦 Shipped: ${SHIPPED_COUNT} ticket(s)"
echo "  ⏭️  Skipped: ${SKIPPED_COUNT} ticket(s)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
