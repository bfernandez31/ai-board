# Data Model: ai-board Claude Code Plugin Package

**Branch**: `AIB-197-create-ai-board` | **Date**: 2026-02-01

## Overview

This document defines the data structures for the ai-board Claude Code plugin package. The "data model" for a plugin consists of:
1. Plugin manifest schema (plugin.json)
2. Command file structure and frontmatter
3. Directory organization

## Entity: Plugin Manifest (plugin.json)

The plugin manifest defines the plugin's metadata and component locations.

### Schema

```typescript
interface PluginManifest {
  // Required
  name: string;                      // "ai-board" - kebab-case identifier

  // Metadata (recommended)
  version: string;                   // "1.0.0" - semver format
  description: string;               // Brief plugin description
  author?: {
    name: string;                    // "ai-board team"
    email?: string;                  // Contact email
    url?: string;                    // GitHub/website URL
  };
  homepage?: string;                 // Documentation URL
  repository?: string;               // Source repository URL
  license?: string;                  // "MIT" or other SPDX identifier
  keywords?: string[];               // Discovery tags

  // Component paths (supplement defaults, don't replace)
  commands?: string | string[];      // "./commands/" or ["./cmd1.md"]
  agents?: string | string[];        // "./agents/"
  skills?: string | string[];        // "./skills/"
  hooks?: string | object;           // "./hooks.json" or inline config
  mcpServers?: string | object;      // "./mcp-config.json" or inline
  lspServers?: string | object;      // "./.lsp.json" or inline
}
```

### Concrete Instance

```json
{
  "name": "ai-board",
  "version": "1.0.0",
  "description": "AI-powered specification-driven development workflow automation",
  "author": {
    "name": "ai-board",
    "url": "https://github.com/ai-board/ai-board"
  },
  "repository": "https://github.com/ai-board/ai-board",
  "license": "MIT",
  "keywords": [
    "ai-development",
    "specification",
    "workflow",
    "automation",
    "code-generation"
  ]
}
```

## Entity: Command File Structure

Command files define slash commands available to Claude Code.

### Frontmatter Schema

```typescript
interface CommandFrontmatter {
  // Required
  description: string;               // Brief command purpose

  // Optional - Categorization
  command?: string;                  // "/ai-board.verify" - invocation name
  category?: string;                 // "Testing & Quality" - grouping
  purpose?: string;                  // Human-readable purpose

  // Optional - Behavior hints
  model?: "opus" | "haiku";         // Preferred model
  "wave-enabled"?: boolean;          // Wave mode support
  "performance-profile"?: string;    // "simple" | "complex" | "heavy"

  // Optional - Security restrictions
  "allowed-tools"?: string[];        // Restricted tool access
  "disable-model-invocation"?: boolean; // Prevent model invocation
}
```

### Command Naming Convention

| Original Name | New Name | Type |
|---------------|----------|------|
| speckit.specify | ai-board.specify | Workflow |
| speckit.plan | ai-board.plan | Workflow |
| speckit.tasks | ai-board.tasks | Workflow |
| speckit.implement | ai-board.implement | Workflow |
| speckit.clarify | ai-board.clarify | Workflow |
| speckit.checklist | ai-board.checklist | Utility |
| speckit.constitution | ai-board.constitution | Configuration |
| speckit.analyze | ai-board.analyze | Analysis |
| verify | ai-board.verify | Testing |
| cleanup | ai-board.cleanup | Maintenance |
| quick-impl | ai-board.quick-impl | Workflow |
| iterate-verify | ai-board.iterate-verify | Testing |
| code-review | ai-board.code-review | Analysis |
| code-simplifier | ai-board.code-simplifier | Refactoring |
| compare | ai-board.compare | Analysis |
| sync-specifications | ai-board.sync-specifications | Workflow |
| ai-board-assist | ai-board-assist | Assistant |

## Entity: Skill Structure

Skills are directories with a SKILL.md file defining the skill's capabilities.

### SKILL.md Frontmatter Schema

```typescript
interface SkillFrontmatter {
  name: string;                      // "testing" - skill identifier
  description: string;               // Brief skill description
}
```

### Example: Testing Skill Structure

```
skills/
└── testing/
    ├── SKILL.md                     # Skill definition
    └── patterns/                    # Supporting resources
        ├── unit.md                  # Unit test patterns
        ├── component.md             # Component test patterns
        ├── frontend-integration.md  # Frontend integration patterns
        ├── backend-integration.md   # Backend integration patterns
        └── e2e.md                   # E2E test patterns
```

## Entity: Script Files

Scripts provide utility functions for commands.

### Bash Script Structure

```typescript
interface BashScript {
  name: string;                      // e.g., "create-new-feature.sh"
  location: string;                  // "${CLAUDE_PLUGIN_ROOT}/scripts/bash/"
  outputs?: {
    json?: boolean;                  // Supports --json flag
    text?: boolean;                  // Default text output
  };
  dependencies?: string[];           // Scripts it sources (e.g., "common.sh")
}
```

### Script Inventory

| Script | Purpose | JSON Output |
|--------|---------|-------------|
| common.sh | Shared utility functions | No |
| create-new-feature.sh | Create feature branch and spec | Yes |
| check-prerequisites.sh | Validate prerequisites | Yes |
| setup-plan.sh | Setup planning phase | Yes |
| update-agent-context.sh | Update agent context files | No |
| create-pr-and-transition.sh | Create PR and transition ticket | No |
| create-pr-only.sh | Create PR without transition | No |
| detect-incomplete-implementation.sh | Detect incomplete impl | No |
| prepare-images.sh | Prepare image assets | No |
| transition-to-verify.sh | Transition to VERIFY stage | No |
| auto-ship-tickets.sh | Auto-ship completed tickets | No |

### JavaScript Script Structure

| Script | Purpose |
|--------|---------|
| analyze-slow-tests.js | Analyze slow-running tests |
| analyze-test-duplicates.js | Find duplicate test coverage |
| generate-test-report.js | Generate test execution report |

## Entity: Template Files

Markdown templates for spec-driven development workflow.

### Template Inventory

| Template | Purpose | Used By |
|----------|---------|---------|
| spec-template.md | Feature specification template | ai-board.specify |
| plan-template.md | Implementation plan template | ai-board.plan |
| tasks-template.md | Task breakdown template | ai-board.tasks |
| checklist-template.md | Quality checklist template | ai-board.checklist |
| summary-template.md | Implementation summary template | ai-board.implement |
| agent-file-template.md | Agent context file template | update-agent-context.sh |

## Relationships

```
plugin.json
    ├── commands/ (1:N) → Command Files
    │   └── Each command → scripts/ (0:N)
    │   └── Each command → templates/ (0:N)
    ├── skills/ (1:N) → Skill Directories
    │   └── Each skill → SKILL.md (1:1)
    │   └── Each skill → patterns/ (0:N)
    ├── agents/ (1:N) → Agent Files (placeholder for AIB-199)
    ├── memory/ (1:1) → constitution.md
    ├── scripts/ (1:N) → Script Files
    │   ├── bash/ → Bash Scripts
    │   └── *.js → JavaScript Scripts
    └── templates/ (1:N) → Template Files
```

## Validation Rules

1. **Plugin Manifest**:
   - `name` must be kebab-case, no spaces
   - `version` must follow semver (X.Y.Z)
   - All paths must be relative, start with `./`

2. **Command Files**:
   - Must have `.md` extension
   - Must include YAML frontmatter with `description`
   - Internal references use `${CLAUDE_PLUGIN_ROOT}`

3. **Skill Directories**:
   - Must contain `SKILL.md` file
   - SKILL.md must have `name` and `description` frontmatter

4. **Scripts**:
   - Bash scripts must be executable (`chmod +x`)
   - Must use `${CLAUDE_PLUGIN_ROOT}` for plugin-relative paths
   - Must source `common.sh` for shared utilities

5. **Templates**:
   - Must have `.md` extension
   - Must be valid markdown with placeholders
