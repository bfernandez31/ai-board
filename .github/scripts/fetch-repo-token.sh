#!/usr/bin/env bash
# Fetch the project owner's GitHub OAuth token for repo operations.
# Falls back to GH_PAT if the owner token is unavailable.
#
# Required env vars:
#   APP_URL            - Base URL of the ai-board API
#   WORKFLOW_API_TOKEN - Bearer token for internal API auth
#   GH_PAT_FALLBACK   - Fallback token (typically secrets.GH_PAT)
#
# Usage:
#   REPO_TOKEN=$(bash fetch-repo-token.sh <project_id>)
#
# Outputs the token to stdout. Masks it in GitHub Actions logs.

set -euo pipefail

PROJECT_ID="${1:?Usage: fetch-repo-token.sh <project_id>}"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${APP_URL}/api/internal/github-token?projectId=${PROJECT_ID}" \
  -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
  TOKEN_B64=$(echo "$BODY" | jq -r '.token')
  echo "::add-mask::${TOKEN_B64}" >&2
  TOKEN=$(echo "$TOKEN_B64" | base64 -d)
  echo "::add-mask::${TOKEN}" >&2
  echo "Owner GitHub token loaded" >&2
  echo "$TOKEN"
else
  echo "Owner GitHub token not available (HTTP $HTTP_CODE) — falling back to GH_PAT" >&2
  echo "${GH_PAT_FALLBACK}"
fi
