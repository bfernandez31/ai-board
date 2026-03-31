#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:?project_id is required}"
APP_URL="${APP_URL:?APP_URL is required}"
WORKFLOW_API_TOKEN="${WORKFLOW_API_TOKEN:?WORKFLOW_API_TOKEN is required}"
GITHUB_ENV_FILE="${GITHUB_ENV:?GITHUB_ENV is required}"

response_file="$(mktemp)"
status_code="$(
  curl -sS -o "$response_file" -w "%{http_code}" \
    -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
    "${APP_URL}/api/projects/${PROJECT_ID}/ai-credentials/owner"
)"

if [[ "$status_code" != "200" ]]; then
  echo "Failed to fetch project owner AI credential (status ${status_code})" >&2
  cat "$response_file" >&2
  rm -f "$response_file"
  exit 1
fi

credential_json="$(cat "$response_file")"
rm -f "$response_file"

env_var_name="$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.envVarName);" "$credential_json")"
secret_value="$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.secret);" "$credential_json")"
credential_type="$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.credentialType);" "$credential_json")"

echo "::add-mask::${secret_value}"
echo "AI_CREDENTIAL_TYPE=${credential_type}" >> "$GITHUB_ENV_FILE"
echo "ANTHROPIC_API_KEY=" >> "$GITHUB_ENV_FILE"
echo "CLAUDE_CODE_OAUTH_TOKEN=" >> "$GITHUB_ENV_FILE"
echo "${env_var_name}=${secret_value}" >> "$GITHUB_ENV_FILE"
