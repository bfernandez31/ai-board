# Implementation Summary: Create setup-environment.sh Script

**Branch**: `AIB-468-copy-of-create` | **Date**: 2026-04-01
**Spec**: [spec.md](spec.md)

## Changes Summary

Created centralized `setup-environment.sh` script that reads `.ai-board/config.yml` from target repos and handles all environment setup: yq bootstrap, config validation, package manager installation (bun/npm/yarn/pnpm), dependency install, agent CLI install (claude-code/codex), env var export with secret precedence, plugin symlinks, project detection (Prisma/Playwright), and final validation. Replaced ~200 duplicated setup lines across 6 workflow files with a single script invocation.

## Key Decisions

- Used yq v4 binary download for YAML parsing (reliable, fast bootstrap)
- Env vars use `${VAR:-config_value}` pattern to preserve workflow secrets
- Script assumes Node.js is pre-installed via actions/setup-node (kept as workflow step for caching)
- Symlinks use relative paths assuming sibling directory layout (ai-board + target)
- Config-not-found exits with error (projects must have `.ai-board/config.yml`)

## Files Modified

- `.github/scripts/setup-environment.sh` (NEW) — centralized setup script
- `.ai-board/config.yml` (NEW) — ai-board project self-config
- `.github/workflows/speckit.yml` — replaced setup blocks with script call
- `.github/workflows/quick-impl.yml` — replaced setup blocks with script call
- `.github/workflows/verify.yml` — replaced setup blocks with script call
- `.github/workflows/ai-board-assist.yml` — replaced setup blocks with script call
- `.github/workflows/iterate.yml` — replaced setup blocks with script call
- `.github/workflows/health-scan.yml` — replaced setup blocks with script call

## ⚠️ Manual Requirements

None — fully automated. External projects need to create `.ai-board/config.yml` to use the centralized script.
