# Contract: setup-environment.sh (Phase-Aware)

**Location**: `.github/scripts/setup-environment.sh`
**Type**: Shell script (bash)

## Interface

```bash
setup-environment.sh <target-directory> [--phase <lightweight|full>]
```

### Parameters

| # | Name | Required | Default | Description |
|---|------|----------|---------|-------------|
| 1 | target-directory | Yes | — | Path to the project root |
| — | --phase | No | full | Execution tier: `lightweight` or `full` |

### Exit Codes

| Code | Condition |
|------|-----------|
| 0 | Setup completed successfully |
| 1 | Target directory not found |
| 1 | Config file missing (NOTE: different from run-command.sh — setup requires config) |
| 1 | Invalid YAML or unsupported config version |
| 1 | Missing required config fields |
| 1 | Validation failed |
| 1 | Unrecognized phase parameter |

### Phase: lightweight

Executes:
1. yq bootstrap
2. Config file validation (version, required fields)
3. Package manager installation
4. Symlink creation (`.claude/commands`, `.claude/skills`)
5. Partial validation (package manager on PATH, symlinks exist)

Skips: dependency install, agent CLI, env export, Prisma, Playwright, node_modules validation

### Phase: full

Executes all lightweight steps plus:
6. Dependency installation (`commands.install`)
7. Agent CLI installation
8. Environment variable export (from `env:` section)
9. Prisma detection and `prisma generate`
10. Playwright detection
11. Full validation (node_modules, agent CLI, package manager, symlinks)

### Environment Variables Set

| Variable | Phases | Description |
|----------|--------|-------------|
| `HAS_PRISMA` | full | `true` if Prisma detected |
| `HAS_PLAYWRIGHT` | full | `true` if Playwright detected |
| Config `env.*` keys | full | All key-values from config env section |

### Example Usage in Workflow

```yaml
# Lightweight for specify/plan
- name: Setup environment (lightweight)
  run: ai-board/.github/scripts/setup-environment.sh target --phase lightweight

# Full for implement/verify
- name: Setup environment
  run: ai-board/.github/scripts/setup-environment.sh target --phase full
```
