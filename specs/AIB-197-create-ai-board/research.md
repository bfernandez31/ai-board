# Research: Create ai-board Claude Code Plugin Package

**Branch**: `AIB-197-create-ai-board` | **Date**: 2026-02-01

## Research Questions

### Q1: How do Claude Code plugins resolve paths to bundled resources?

**Decision**: Use `${CLAUDE_PLUGIN_ROOT}` environment variable for all intra-plugin path references.

**Rationale**: According to Claude Code plugin documentation, plugins install in different locations depending on user installation method (marketplace, local, npm). The `${CLAUDE_PLUGIN_ROOT}` variable resolves to the absolute path of the plugin directory at runtime, ensuring consistent path resolution regardless of installation method.

**Alternatives Considered**:
1. Relative paths from command file - Rejected because command file location varies by installation method
2. Hardcoded absolute paths - Rejected because installation location is not predictable
3. User-configured paths - Rejected because it adds unnecessary configuration burden

**Implementation Impact**: All 17 command files must update their resource references from `.specify/` relative paths to `${CLAUDE_PLUGIN_ROOT}/` paths.

---

### Q2: What is the complete command frontmatter schema for Claude Code commands?

**Decision**: Use a flexible frontmatter schema with required and optional fields based on command complexity.

**Rationale**: Analysis of the existing 17 commands revealed two patterns:
- Simple format (12 commands): Only `description` field
- Extended format (5 commands): Additional fields for categorization, restrictions, and behavior hints

**Complete Schema** (all optional except description):
```yaml
---
# Required
description: "Brief description of command purpose"

# Optional - Categorization
command: "/command-name"              # Slash command invocation name
category: "Category Name"              # Grouping category
purpose: "User-facing purpose"         # Human-readable purpose

# Optional - Behavior
model: "opus|haiku"                    # Preferred model
wave-enabled: true|false               # Wave mode support
performance-profile: "simple|complex"  # Complexity hint

# Optional - Security
allowed-tools: ["tool1", "tool2"]      # Restricted tool access
disable-model-invocation: true|false   # Prevent model invocation
---
```

**Current Command Classification**:
| Command Type | Count | Fields Used |
|--------------|-------|-------------|
| Simple (description only) | 12 | description |
| Extended (with restrictions) | 5 | command, category, purpose, allowed-tools, model |

---

### Q3: Do Claude Code plugins support installation hooks for file copying?

**Decision**: Handle file copying in command logic, not installation hooks.

**Rationale**: Claude Code plugins currently support hooks for runtime events (PreToolUse, PostToolUse, SessionStart, etc.) but **do not provide installation-time hooks**. The spec requirement FR-010 ("copy constitution template if missing") must be implemented within command execution.

**Alternatives Considered**:
1. Installation hooks - Not available in current plugin system
2. PostInstall script - Not supported by plugin manifest
3. Marketplace install script - Not a standard feature

**Implementation Strategy**:
```bash
# In ai-board.specify.md and ai-board.plan.md
if [ ! -f ".specify/memory/constitution.md" ]; then
  mkdir -p .specify/memory
  cp "${CLAUDE_PLUGIN_ROOT}/memory/constitution.md" ".specify/memory/constitution.md"
fi
```

**Commands Requiring This Logic**: ai-board.specify, ai-board.plan (first commands typically run in workflow)

---

### Q4: Which GitHub workflow files reference commands that need renaming?

**Decision**: Update command references in 5 workflow files from `speckit.*` to `ai-board.*`.

**Rationale**: Analysis of `.github/workflows/` directory identified workflow files containing command invocations.

**Workflow Files Requiring Updates**:

| Workflow | Commands to Update | Count |
|----------|-------------------|-------|
| speckit.yml | speckit.specify, speckit.plan, speckit.tasks, speckit.implement, speckit.clarify | 5 |
| quick-impl.yml | quick-impl (invocation in claude command) | 1 |
| cleanup.yml | cleanup (invocation in claude command) | 1 |
| ai-board-assist.yml | ai-board-assist (invocation in claude command) | 1 |
| iterate.yml | iterate-verify (invocation in claude command) | 1 |

**No Updates Required**:
- rollback-reset.yml - No command invocations
- deploy-preview.yml - No command invocations
- auto-ship.yml - Script invocations only (no commands)

**Sample Update Pattern** (from speckit.yml):
```yaml
# Before
claude --model claude-opus-4-5-20251101 --dangerously-skip-permissions "/speckit.specify $payload"

# After
claude --model claude-opus-4-5-20251101 --dangerously-skip-permissions "/ai-board.specify $payload"
```

---

### Q5: What is the correct plugin directory structure?

**Decision**: Place `.claude-plugin/` at plugin root with only `plugin.json`; all components at plugin root level.

**Rationale**: Claude Code plugin documentation explicitly states that components (commands, agents, skills, hooks) MUST be at plugin root, not inside `.claude-plugin/`.

**Correct Structure**:
```
ai-board-plugin/                      # Plugin root
├── .claude-plugin/
│   └── plugin.json                   # ONLY manifest here
├── commands/                         # Commands at root level
├── skills/                           # Skills at root level
├── agents/                           # Agents at root level
├── scripts/                          # Scripts at root level
├── templates/                        # Templates at root level
└── memory/                           # Memory/constitution at root level
```

**Alternatives Considered**:
1. Nested under `.claude-plugin/` - Explicitly prohibited by documentation
2. Flat structure without directories - Valid but less organized
3. Custom directory names - Valid but less conventional

---

## Research Summary

| Topic | Decision | Confidence |
|-------|----------|------------|
| Path Resolution | Use `${CLAUDE_PLUGIN_ROOT}` | High |
| Command Frontmatter | Flexible schema, maintain existing patterns | High |
| Installation Hooks | Not available; use command logic | High |
| Workflow Updates | 5 workflows need command renames | High |
| Directory Structure | Components at plugin root | High |

## Outstanding Questions (None)

All research questions resolved. Ready to proceed to Phase 1: Design & Contracts.
