# Quickstart: AI-Board Claude Code Plugin Package

**Branch**: `AIB-203-copy-of-create` | **Date**: 2026-02-01

## Implementation Order

### Phase 1: Plugin Structure Setup
1. Create `.claude-plugin/plugin.json` manifest
2. Create `hooks/hooks.json` configuration
3. Create `scripts/bash/setup-constitution.sh` (post-install hook)

### Phase 2: Command Migration
1. Copy and rename speckit commands to `ai-board.*` namespace
2. Update path references from `.specify/` to `${CLAUDE_PLUGIN_ROOT}/`
3. Update internal command cross-references

### Phase 3: Workflow Updates
1. Update `speckit.yml` command references
2. Update `quick-impl.yml` command references
3. Update `verify.yml` command references
4. Update `cleanup.yml` command references
5. Update `iterate.yml` command references

### Phase 4: Testing
1. Add unit tests for path resolution utilities
2. Add integration tests for plugin installation

## Key Files to Create

| File | Purpose |
|------|---------|
| `.claude-plugin/plugin.json` | Plugin manifest |
| `hooks/hooks.json` | Post-install hooks |
| `scripts/bash/setup-constitution.sh` | Constitution setup script |
| `commands/ai-board.*.md` | 16 renamed command files |

## Key Files to Modify

| File | Changes |
|------|---------|
| `.github/workflows/speckit.yml` | Update command names |
| `.github/workflows/quick-impl.yml` | Update command name |
| `.github/workflows/verify.yml` | Update command name |
| `.github/workflows/cleanup.yml` | Update command name |
| `.github/workflows/iterate.yml` | Update command name |
| `.specify/scripts/bash/common.sh` | Add `get_plugin_root()` function |

## Path Resolution Pattern

```bash
# In scripts, use this pattern:
get_plugin_root() {
    if [[ -n "${CLAUDE_PLUGIN_ROOT:-}" ]]; then
        echo "$CLAUDE_PLUGIN_ROOT"
    elif git rev-parse --show-toplevel >/dev/null 2>&1; then
        git rev-parse --show-toplevel
    else
        local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        (cd "$script_dir/../.." && pwd)
    fi
}
```

## Command Naming Convention

- File: `commands/ai-board.{name}.md`
- Invocation: `/ai-board.{name}`
- Example: `commands/ai-board.specify.md` → `/ai-board.specify`

## Critical Constraints

1. **Paths must use `${CLAUDE_PLUGIN_ROOT}`** - hardcoded paths break after plugin caching
2. **Components at plugin root** - not inside `.claude-plugin/`
3. **Constitution preserved** - only copy if target doesn't exist
4. **Workflows atomically updated** - all 5 workflow files must be updated together
