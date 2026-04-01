# Contract: setup-environment.sh (Extended)

**Type**: Shell script interface
**Location**: `.github/scripts/setup-environment.sh`

---

## Synopsis

```bash
setup-environment.sh <target-dir> [--mode lightweight|full]
```

## Arguments

| Arg | Required | Default | Description |
|-----|----------|---------|-------------|
| `target-dir` | Yes | — | Absolute path to the target repository root |
| `--mode` | No | `lightweight` | Setup tier: `lightweight` or `full` |

## Mode: lightweight

Executes only:
- yq bootstrap (install if missing)
- Config file validation (if present)
- Symlink creation (`.claude/commands`, `.claude/skills`)
- Runtime installation (bun/node at specified versions)
- Git config (user.name, user.email for CI)
- Agent CLI installation (claude-code or codex)

## Mode: full

Executes everything in `lightweight` plus:
- Dependency installation (`commands.install` from config)
- Environment variable export (`env.*` from config)
- Prisma detection and setup (`prisma generate`, `prisma migrate deploy`)
- Playwright detection and installation
- Global test setup (`npx tsx tests/global-setup.ts` if present)

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Setup completed successfully |
| 1 | Invalid arguments or setup failure |
| 2 | Invalid YAML in config file |

## Workflow Usage

```yaml
# Specify/Plan phases — lightweight
- name: Setup environment
  run: ai-board/.github/scripts/setup-environment.sh ${{ github.workspace }}/target --mode lightweight

# Implement/Verify phases — full
- name: Setup environment
  run: ai-board/.github/scripts/setup-environment.sh ${{ github.workspace }}/target --mode full
```
