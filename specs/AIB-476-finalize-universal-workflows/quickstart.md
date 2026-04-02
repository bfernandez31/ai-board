# Quickstart: Finalize Universal Workflows

## What This Feature Does

Makes ai-board workflows stack-agnostic by:
1. Creating `run-command.sh` — reads project commands from `.ai-board/config.yml` instead of hardcoding `bun`/`npx`
2. Adding conditional service containers — PostgreSQL, Redis, MySQL, MongoDB start only when requested
3. Making `setup-environment.sh` phase-aware — lightweight setup for specify/plan, full setup for build/verify

## Files to Create

| File | Purpose |
|------|---------|
| `.github/scripts/run-command.sh` | New — command lookup and execution from config.yml |

## Files to Modify

| File | Change |
|------|--------|
| `.github/scripts/setup-environment.sh` | Add `--phase` parameter support (lightweight/full) |
| `.github/workflows/speckit.yml` | Replace hardcoded commands with run-command.sh; add service inputs; use setup-environment.sh |
| `.github/workflows/quick-impl.yml` | Same as speckit.yml |
| `.github/workflows/verify.yml` | Replace hardcoded test commands with run-command.sh; add service inputs |
| `.github/workflows/health-scan.yml` | Replace hardcoded install/Prisma with run-command.sh; add service inputs |
| `.github/workflows/iterate.yml` | Add setup-environment.sh call (lightweight) |
| `.github/workflows/ai-board-assist.yml` | Replace hardcoded commands with run-command.sh; add setup-environment.sh |

## Files NOT Modified

| File | Reason |
|------|--------|
| `.github/workflows/deploy-preview.yml` | Vercel-specific, no project commands |
| `.github/workflows/rollback-reset.yml` | Git operations only |
| `.github/workflows/nightly-health.yml` | API calls only (curl) |
| `.github/workflows/auto-ship.yml` | Script call only |
| `.ai-board/config.yml` | Already has all needed command keys |

## Implementation Order

1. **Create run-command.sh** — standalone script, can be tested in isolation
2. **Modify setup-environment.sh** — add phase parameter, backward compatible (default: full)
3. **Update speckit.yml** — most complex workflow, validates the pattern
4. **Update remaining workflows** — apply the same pattern from speckit.yml
5. **Write tests** — unit tests for run-command.sh, integration validation

## Key Decisions

- Infrastructure commands (Prisma generate, Playwright install) stay hardcoded — they're provisioning, not project commands
- Missing config = silent skip (exit 0) — backward compatible
- `yq` is the YAML parser — already in use by setup-environment.sh
- Service containers use empty image string to disable — native GitHub Actions pattern
