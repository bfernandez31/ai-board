# Quickstart: Health Scan Commands

**Branch**: `AIB-378-copy-of-health` | **Date**: 2026-03-29

## What This Feature Does

Implements 4 health scan commands that analyze a target repository and produce structured JSON reports:

1. **health-security**: OWASP Top 10 vulnerability analysis
2. **health-compliance**: Constitution/coding standards verification
3. **health-tests**: Test suite execution with auto-fix
4. **health-spec-sync**: Specification-implementation drift detection

## How It Works

```
health-scan.yml workflow
  → clones target repo
  → maps scan type to command (SCAN_COMMAND_MAP)
  → executes command via Claude Code CLI
  → parses JSON stdout
  → creates remediation tickets
  → updates scan status via API
```

## Command Execution

Each command receives arguments and outputs JSON:

```bash
# Full scan
claude-code run health-security

# Incremental scan
claude-code run health-security --base-commit abc1234 --head-commit def5678

# Tests (always full, ignores base-commit)
claude-code run health-tests
```

## Output Format

All commands produce:
```json
{
  "score": 85,
  "issuesFound": 3,
  "issuesFixed": 0,
  "report": { /* scan-specific */ },
  "tokensUsed": 0,
  "costUsd": 0
}
```

## Key Files

| File | Purpose |
|------|---------|
| `.claude-plugin/commands/ai-board.health-security.md` | Security scan instructions |
| `.claude-plugin/commands/ai-board.health-compliance.md` | Compliance scan instructions |
| `.claude-plugin/commands/ai-board.health-tests.md` | Tests scan instructions |
| `.claude-plugin/commands/ai-board.health-spec-sync.md` | Spec sync scan instructions |
| `lib/health/report-schemas.ts` | Zod validation for report output |
| `lib/health/types.ts` | TypeScript types for reports |
| `lib/health/scan-commands.ts` | Static command mapping |
| `lib/health/ticket-creation.ts` | Remediation ticket grouping |

## Dependencies

- Existing: `health-scan.yml` workflow (AIB-377)
- Existing: `lib/health/` utilities (AIB-377)
- Existing: Health API endpoints (AIB-370/371)
