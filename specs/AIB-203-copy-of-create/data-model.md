# Data Model: AI-Board Claude Code Plugin Package

**Branch**: `AIB-203-copy-of-create` | **Date**: 2026-02-01

## Overview

This feature involves file-based plugin packaging, not database entities. The data model describes the plugin manifest schema and file structure specifications.

## 1. Plugin Manifest Schema (`plugin.json`)

```typescript
interface PluginManifest {
  // Required fields
  name: string;                    // "ai-board" - unique identifier, kebab-case

  // Metadata fields
  version: string;                 // "1.0.0" - semantic version
  description: string;             // Brief plugin description
  author: {
    name: string;                  // "AI-Board Team"
    email?: string;                // Optional contact
    url?: string;                  // Optional homepage
  };
  homepage?: string;               // Documentation URL
  repository?: string;             // GitHub repository URL
  license?: string;                // "MIT"
  keywords?: string[];             // Discovery tags

  // Component path fields
  commands?: string | string[];    // Path(s) to command files/directories
  skills?: string | string[];      // Path(s) to skill directories
  hooks?: string | HooksConfig;    // Path to hooks.json or inline config
}
```

**Validation Rules**:
- `name`: Required, kebab-case, no spaces
- `version`: Must follow semver format (MAJOR.MINOR.PATCH)
- All paths must be relative and start with `./`
- Commands must be `.md` files or directories containing `.md` files

## 2. Hooks Configuration Schema (`hooks.json`)

```typescript
interface HooksConfig {
  hooks: {
    SessionStart?: Hook[];         // Run when Claude Code session starts
    PostToolUse?: Hook[];          // Run after tool execution
  };
}

interface Hook {
  matcher?: string;                // Regex to match tool names (e.g., "Write|Edit")
  hooks: HookAction[];
}

interface HookAction {
  type: "command" | "prompt" | "agent";
  command?: string;                // Shell command (for type: "command")
  prompt?: string;                 // LLM prompt (for type: "prompt")
}
```

**Post-Install Hook** (constitution setup):
```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/bash/setup-constitution.sh"
          }
        ]
      }
    ]
  }
}
```

## 3. Command File Schema

```typescript
interface CommandFile {
  // YAML front matter (optional)
  frontMatter?: {
    command?: string;              // Explicit command name (e.g., "/ai-board.specify")
    description?: string;          // Brief description
    category?: string;             // Command category
    purpose?: string;              // Detailed purpose
  };

  // Markdown body
  body: string;                    // Command instructions and workflow
}
```

**Naming Convention**:
- File: `ai-board.{command-name}.md`
- Command: `/ai-board.{command-name}`
- If no explicit `command:` in front matter, derived from filename

## 4. Skill File Schema

```typescript
interface SkillDirectory {
  'SKILL.md': SkillFile;           // Main skill definition (required)
  patterns?: {                     // Optional pattern files
    [name: string]: string;        // Additional .md files
  };
  scripts?: {                      // Optional scripts
    [name: string]: string;        // Shell or JS scripts
  };
}

interface SkillFile {
  frontMatter: {
    name: string;                  // Skill identifier
    description: string;           // When to use this skill
  };
  body: string;                    // Skill content
}
```

## 5. Plugin Directory Structure

```
.claude-plugin/
└── plugin.json                    # Manifest

commands/                          # 16 command files
├── ai-board.specify.md
├── ai-board.clarify.md
├── ai-board.plan.md
├── ai-board.tasks.md
├── ai-board.implement.md
├── ai-board.checklist.md
├── ai-board.analyze.md
├── ai-board.constitution.md
├── ai-board.quick-impl.md
├── ai-board.cleanup.md
├── ai-board.verify.md
├── ai-board.iterate-verify.md
├── ai-board.code-review.md
├── ai-board.code-simplifier.md
├── ai-board.compare.md
└── ai-board.sync-specifications.md

skills/
└── testing/                       # Testing skill
    ├── SKILL.md
    └── patterns/
        ├── unit.md
        ├── component.md
        ├── frontend-integration.md
        ├── backend-integration.md
        └── e2e.md

scripts/
├── bash/                          # 11 bash scripts
│   ├── common.sh
│   ├── create-new-feature.sh
│   ├── check-prerequisites.sh
│   ├── setup-plan.sh
│   ├── setup-constitution.sh      # NEW: Post-install hook script
│   ├── create-pr-and-transition.sh
│   ├── create-pr-only.sh
│   ├── prepare-images.sh
│   ├── detect-incomplete-implementation.sh
│   ├── auto-ship-tickets.sh
│   ├── transition-to-verify.sh
│   └── update-agent-context.sh
├── analyze-slow-tests.js
├── analyze-test-duplicates.js
└── generate-test-report.js

templates/                         # 6 templates
├── spec-template.md
├── plan-template.md
├── tasks-template.md
├── checklist-template.md
├── summary-template.md
└── agent-file-template.md

memory/
└── constitution.md                # Default constitution template

hooks/
└── hooks.json                     # Post-install hooks
```

## 6. Path Resolution Environment Variables

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `CLAUDE_PLUGIN_ROOT` | Absolute path to installed plugin | `/home/user/.claude/plugins/ai-board` |
| `SPECIFY_FEATURE` | Feature branch name (optional) | `AIB-123-feature-name` |

## 7. File State Transitions

### Constitution Setup Flow
```
State: No constitution exists
  └─> SessionStart hook triggers
      └─> setup-constitution.sh runs
          └─> Checks: if ! [ -f ".specify/memory/constitution.md" ]
              └─> Creates: .specify/memory/ directory
              └─> Copies: ${CLAUDE_PLUGIN_ROOT}/memory/constitution.md
State: Constitution exists
  └─> SessionStart hook triggers
      └─> setup-constitution.sh runs
          └─> Checks: if [ -f ".specify/memory/constitution.md" ]
              └─> No action (preserves existing)
```

### Command Execution Flow
```
User: /ai-board.specify "Feature description"
  └─> Claude Code loads: ${CLAUDE_PLUGIN_ROOT}/commands/ai-board.specify.md
      └─> Command invokes: ${CLAUDE_PLUGIN_ROOT}/scripts/bash/create-new-feature.sh
          └─> Script resolves paths using get_plugin_root()
          └─> Creates spec files in project's specs/{branch}/
```

## 8. Entity Relationships

```
Plugin (ai-board)
├── has many → Commands (16)
│   └── references → Scripts (via ${CLAUDE_PLUGIN_ROOT})
│   └── references → Templates (via ${CLAUDE_PLUGIN_ROOT})
│   └── references → Other Commands (inter-command references)
├── has one → Skill (testing)
│   └── has many → Patterns (5)
├── has many → Scripts (14)
│   └── uses → common.sh (shared utilities)
├── has many → Templates (6)
├── has one → Memory/Constitution (1)
└── has one → Hooks configuration (1)
```

## 9. Validation Constraints

| Entity | Constraint | Validation |
|--------|-----------|------------|
| plugin.json | name required | Non-empty string, kebab-case |
| plugin.json | paths relative | Must start with `./` |
| command file | valid markdown | Parseable as MD with optional YAML front matter |
| skill directory | SKILL.md required | File must exist |
| hooks.json | valid event names | Must be known event (SessionStart, PostToolUse, etc.) |
| hooks.json | valid hook types | Must be command, prompt, or agent |
| scripts | executable | Must have execute permission (755) |
