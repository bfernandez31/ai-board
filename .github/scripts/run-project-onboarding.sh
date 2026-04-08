#!/usr/bin/env bash
set -euo pipefail

target_repo="${GITHUB_REPOSITORY_TARGET:-}"
selected_agent="${SELECTED_AGENT:-CLAUDE}"

if [[ -z "$target_repo" ]]; then
  echo "Missing GITHUB_REPOSITORY_TARGET" >&2
  exit 1
fi

default_branch="main"
commit_sha="mock-onboarding-commit"

echo "Running project onboarding for ${target_repo} with ${selected_agent}"

{
  echo "default_branch=${default_branch}"
  echo "commit_sha=${commit_sha}"
} >> "$GITHUB_OUTPUT"
