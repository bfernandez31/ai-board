# Research: AI-Board Claude Code Plugin Package

**Branch**: `AIB-203-copy-of-create` | **Date**: 2026-02-01

## 1. Claude Code Plugin System Architecture

### Decision: Plugin directory structure follows standard Claude Code conventions
**Rationale**: Claude Code plugins require a specific structure with `.claude-plugin/plugin.json` manifest and component directories at plugin root level.

**Structure**:
```
ai-board-plugin/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest (REQUIRED)
├── commands/                 # Slash commands
├── skills/                   # Agent skills with SKILL.md
├── scripts/                  # Bash and JS scripts
├── templates/                # Document templates
├── memory/                   # Constitution template
└── hooks/                    # Event handlers (optional)
```

**Alternatives Considered**:
- Flat structure: Rejected - doesn't follow Claude Code conventions
- Nested in `.claude-plugin/`: Rejected - components MUST be at plugin root per documentation

### Decision: Use `${CLAUDE_PLUGIN_ROOT}` for all path resolution
**Rationale**: Claude Code provides this environment variable containing the absolute path to the installed plugin directory, enabling portable path resolution regardless of installation location.

**Implementation**:
- Scripts use `${CLAUDE_PLUGIN_ROOT}` instead of git-based repo root detection
- Commands invoke scripts via `${CLAUDE_PLUGIN_ROOT}/scripts/bash/`
- Templates loaded from `${CLAUDE_PLUGIN_ROOT}/templates/`

**Alternatives Considered**:
- Relative path from command location: Rejected - doesn't work after plugin caching
- Hardcoded installation paths: Rejected - not portable across systems

## 2. Command Naming and Namespace

### Decision: Rename all `speckit.*` commands to `ai-board.*`
**Rationale**: Provides consistent branding and clearer identification of ai-board plugin commands. Per spec, this was marked as a CRITICAL change requiring workflow updates.

**Current Commands** (8 speckit commands):
| Current Name | New Name |
|--------------|----------|
| `/speckit.specify` | `/ai-board.specify` |
| `/speckit.clarify` | `/ai-board.clarify` |
| `/speckit.plan` | `/ai-board.plan` |
| `/speckit.tasks` | `/ai-board.tasks` |
| `/speckit.implement` | `/ai-board.implement` |
| `/speckit.checklist` | `/ai-board.checklist` |
| `/speckit.analyze` | `/ai-board.analyze` |
| `/speckit.constitution` | `/ai-board.constitution` |

**Additional Standalone Commands** (8 commands):
| Current Name | New Name |
|--------------|----------|
| `/quick-impl` | `/ai-board.quick-impl` |
| `/cleanup` | `/ai-board.cleanup` |
| `/verify` | `/ai-board.verify` |
| `/iterate-verify` | `/ai-board.iterate-verify` |
| `/code-review` | `/ai-board.code-review` |
| `/code-simplifier` | `/ai-board.code-simplifier` |
| `/compare` | `/ai-board.compare` |
| `/sync-specifications` | `/ai-board.sync-specifications` |

**Special Case**: `ai-board-assist.md` remains as-is since it's triggered via @ai-board mention, not a user command.

**Alternatives Considered**:
- Keep speckit namespace: Rejected - inconsistent branding
- Mixed namespace: Rejected - confusion between speckit.* and ai-board.*

## 3. GitHub Workflow Command References

### Decision: Update all workflow files to use `ai-board.*` command names
**Rationale**: Workflows dispatch commands to Claude Code CLI, so command names must match plugin command names.

**Workflows Requiring Updates** (6 files):

1. **speckit.yml** - Lines 291, 293, 297-298, 317-318, 338, 341, 345, 394
   - `/speckit.specify` → `/ai-board.specify`
   - `/speckit.plan` → `/ai-board.plan`
   - `/speckit.tasks` → `/ai-board.tasks`
   - `/speckit.implement` → `/ai-board.implement`
   - `/speckit.clarify` → `/ai-board.clarify`

2. **quick-impl.yml** - References `/quick-impl`
   - `/quick-impl` → `/ai-board.quick-impl`

3. **verify.yml** - References `/verify`
   - `/verify` → `/ai-board.verify`

4. **cleanup.yml** - References `/cleanup`
   - `/cleanup` → `/ai-board.cleanup`

5. **iterate.yml** - References `/iterate-verify`
   - `/iterate-verify` → `/ai-board.iterate-verify`

6. **ai-board-assist.yml** - References `/ai-board-assist`
   - No change needed (already uses ai-board namespace)

**Alternatives Considered**:
- Alias mapping layer: Rejected - adds complexity, breaks debugging
- Gradual migration: Rejected - plugin installation is atomic

## 4. Internal Command Cross-References

### Decision: Update all inter-command references to use new namespace
**Rationale**: Commands reference each other in documentation and workflow descriptions. These must be updated for consistency.

**Cross-Reference Map**:

| Source Command | References | Updated References |
|---------------|------------|-------------------|
| `ai-board.specify` | `/speckit.clarify`, `/speckit.plan` | `/ai-board.clarify`, `/ai-board.plan` |
| `ai-board.clarify` | `/speckit.specify`, `/speckit.plan` | `/ai-board.specify`, `/ai-board.plan` |
| `ai-board.plan` | `/speckit.tasks` | `/ai-board.tasks` |
| `ai-board.tasks` | `/speckit.analyze` | `/ai-board.analyze` |
| `ai-board.analyze` | `/tasks` | `/ai-board.tasks` |
| `ai-board.quick-impl` | `/speckit.specify`, `/speckit.plan`, `/speckit.implement` | `/ai-board.specify`, `/ai-board.plan`, `/ai-board.implement` |

## 5. Script Path Resolution Migration

### Decision: Scripts detect plugin context vs standalone context
**Rationale**: Scripts need to work both in plugin context (installed) and standalone context (development in ai-board repo).

**Implementation**:
```bash
get_plugin_root() {
    # If running in plugin context, CLAUDE_PLUGIN_ROOT is set
    if [[ -n "${CLAUDE_PLUGIN_ROOT:-}" ]]; then
        echo "$CLAUDE_PLUGIN_ROOT"
        return
    fi

    # Otherwise, use git repo root detection (standalone mode)
    if git rev-parse --show-toplevel >/dev/null 2>&1; then
        git rev-parse --show-toplevel
        return
    fi

    # Fallback: Navigate from script location
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    (cd "$script_dir/../.." && pwd)  # Up 2 levels from scripts/bash/
}
```

**Path Mapping** (plugin context):
| Current Path | Plugin Path |
|--------------|-------------|
| `.specify/scripts/bash/` | `${CLAUDE_PLUGIN_ROOT}/scripts/bash/` |
| `.specify/templates/` | `${CLAUDE_PLUGIN_ROOT}/templates/` |
| `.specify/memory/` | `${CLAUDE_PLUGIN_ROOT}/memory/` |

**Alternatives Considered**:
- Separate plugin scripts: Rejected - duplication maintenance burden
- Symlinks: Rejected - caching issues with plugin system

## 6. Constitution Template Handling

### Decision: Copy constitution.md only if target doesn't exist
**Rationale**: Per spec, existing customizations must be preserved. New projects get a starting template.

**Implementation**:
```bash
# Plugin post-install hook
if [ ! -f ".specify/memory/constitution.md" ]; then
    mkdir -p ".specify/memory"
    cp "${CLAUDE_PLUGIN_ROOT}/memory/constitution.md" ".specify/memory/constitution.md"
fi
```

**Alternatives Considered**:
- Always overwrite: Rejected - loses customizations
- Merge: Rejected - complex, error-prone
- Never copy: Rejected - new projects need starting point

## 7. Plugin Manifest Schema

### Decision: Use complete plugin.json with all component paths
**Rationale**: Claude Code requires explicit declaration of all plugin components.

**Manifest Structure**:
```json
{
  "name": "ai-board",
  "version": "1.0.0",
  "description": "AI-board automated development workflow commands, scripts, and templates",
  "author": {
    "name": "AI-Board Team"
  },
  "repository": "https://github.com/ai-board/ai-board",
  "license": "MIT",
  "keywords": ["ai-board", "workflow", "specification", "implementation"],
  "commands": "./commands/",
  "skills": "./skills/",
  "hooks": "./hooks/hooks.json"
}
```

**Notes**:
- Scripts and templates are not listed in manifest (accessed via ${CLAUDE_PLUGIN_ROOT})
- Skills inherit from existing `.claude/skills/` structure
- Hooks configure post-install behavior for constitution setup

## 8. Testing Strategy

### Decision: Integration tests for installation, unit tests for path utilities
**Rationale**: Per Testing Trophy and spec requirements.

**Test Coverage**:

| Test Type | Location | Tests |
|-----------|----------|-------|
| Unit | `tests/unit/plugin/` | Path resolution utilities, manifest validation |
| Integration | `tests/integration/plugin/` | Plugin installation, command availability |

**Test Scenarios**:
1. Plugin installation creates all expected paths
2. Commands resolve to correct plugin paths
3. Constitution copy behavior (new vs existing)
4. All 16 commands are discoverable after installation
5. Path resolution works in GitHub Actions environment

## 9. File Inventory for Plugin Package

### Commands (16 files → `commands/`)
```
ai-board.specify.md
ai-board.clarify.md
ai-board.plan.md
ai-board.tasks.md
ai-board.implement.md
ai-board.checklist.md
ai-board.analyze.md
ai-board.constitution.md
ai-board.quick-impl.md
ai-board.cleanup.md
ai-board.verify.md
ai-board.iterate-verify.md
ai-board.code-review.md
ai-board.code-simplifier.md
ai-board.compare.md
ai-board.sync-specifications.md
```

### Scripts (10 bash + 3 JS → `scripts/`)
```
scripts/bash/
├── common.sh
├── create-new-feature.sh
├── check-prerequisites.sh
├── setup-plan.sh
├── create-pr-and-transition.sh
├── create-pr-only.sh
├── prepare-images.sh
├── detect-incomplete-implementation.sh
├── auto-ship-tickets.sh
├── transition-to-verify.sh
└── update-agent-context.sh

scripts/
├── analyze-slow-tests.js
├── analyze-test-duplicates.js
└── generate-test-report.js
```

### Templates (6 files → `templates/`)
```
spec-template.md
plan-template.md
tasks-template.md
checklist-template.md
summary-template.md
agent-file-template.md
```

### Skills (1 skill → `skills/`)
```
skills/testing/
├── SKILL.md
└── patterns/
    ├── unit.md
    ├── component.md
    ├── frontend-integration.md
    ├── backend-integration.md
    └── e2e.md
```

### Memory (1 file → `memory/`)
```
constitution.md
```

## 10. Migration Approach

### Decision: Create plugin structure alongside existing files, not in-place modification
**Rationale**: Safer approach that preserves existing functionality during development.

**Implementation Steps**:
1. Create `.claude-plugin/` directory structure in ai-board repo
2. Copy and rename command files with `ai-board.*` prefix
3. Update path references in copied commands to use `${CLAUDE_PLUGIN_ROOT}`
4. Update internal command references to new namespace
5. Update GitHub workflow files to reference new command names
6. Add plugin.json manifest
7. Add hooks.json for post-install constitution setup
8. Add installation tests

**Alternatives Considered**:
- In-place rename: Rejected - breaks existing functionality during transition
- Branch-based: This approach uses feature branch for isolation
