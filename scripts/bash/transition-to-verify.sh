#!/bin/bash
# Transition Ticket to VERIFY Stage
#
# This script is called by speckit.yml and quick-impl.yml workflows
# after successful implementation to move the ticket to VERIFY stage.
# The VERIFY workflow will then run tests and create the PR.
#
# Usage: transition-to-verify.sh <ticket_id> <project_id> <app_url> <workflow_api_token>

set -e

# Parse arguments
TICKET_ID=$1
PROJECT_ID=$2
APP_URL=$3
WORKFLOW_API_TOKEN=$4

# Validate required arguments
if [ -z "$TICKET_ID" ] || [ -z "$PROJECT_ID" ] || [ -z "$APP_URL" ] || [ -z "$WORKFLOW_API_TOKEN" ]; then
  echo "❌ Error: Missing required arguments"
  echo "Usage: $0 <ticket_id> <project_id> <app_url> <workflow_api_token>"
  exit 1
fi

echo "📋 Transitioning ticket to VERIFY stage..."
echo "  Ticket ID: $TICKET_ID"
echo "  Project ID: $PROJECT_ID"

# Transition ticket to VERIFY stage
TRANSITION_RESPONSE=$(curl -X POST "${APP_URL}/api/projects/${PROJECT_ID}/tickets/${TICKET_ID}/transition" \
  -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"targetStage": "VERIFY"}' \
  -w "\n%{http_code}" \
  -s -S)

HTTP_CODE=$(echo "$TRANSITION_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "✅ Ticket transitioned to VERIFY stage"
  echo "   This will trigger the verify workflow to run tests and create PR"
else
  echo "⚠️ Failed to transition ticket to VERIFY (HTTP $HTTP_CODE)"
  echo "Response: $(echo "$TRANSITION_RESPONSE" | head -n-1)"
  exit 1
fi

echo ""
echo "✅ Transition complete! VERIFY workflow will now run tests."
