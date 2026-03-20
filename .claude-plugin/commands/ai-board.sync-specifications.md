---
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
description: Synchronize branch specifications with global project documentation
---

## Context

1. Run `${CLAUDE_PLUGIN_ROOT:-./.claude-plugin}/scripts/bash/check-prerequisites.sh --json --paths-only` from repo root:
   - Extract `BRANCH` → current branch name
   - Extract `FEATURE_DIR` → feature specs directory path
   - **On failure or missing values → STOP and report the error.**

2. Get changed files:
   ```bash
   git diff main --name-only --diff-filter=ACMR
   ```
   - **If empty → STOP: "✅ No changes to synchronize."**

3. Discover global specs:
   ```bash
   find specs/specifications -type f -name "*.md" -not -path "*/archive/*" | sort
   ```
   - **If missing → STOP: "❌ Missing specs/specifications/ directory."**

4. Check feature specs in `FEATURE_DIR` (`spec.md`, `plan.md`, `tasks.md`):
   - **If none exist → STOP: "⏭️ No feature specs found, skipping sync."**

## Task

Synchronize feature branch specifications into global project documentation.

### Principles

| # | Rule | Detail |
|---|------|--------|
| 1 | **Current state only** | Docs describe how the system works NOW |
| 2 | **No historical markers** | Never: "Added in #X", "Updated in vY", "New:", "Changed:" |
| 3 | **Replace in-place** | Update existing sections — never append changelog-style blocks |
| 4 | **Minimal footprint** | Only touch files directly impacted by the changes |
| 5 | **Idempotent** | Running twice produces identical output |
| 6 | **Match existing style** | Read the target file first — match tone, structure, heading depth |
| 7 | **No commit** | Only write files — git operations are handled externally |

### Process

#### 1 — Build change inventory

Read specs from `FEATURE_DIR` (`spec.md`, `plan.md`, `tasks.md`).

Cross-reference with `git diff main --name-only` to understand the scope.

Build an internal change list:
- Each new or modified **behavior** (user-facing)
- Each new or modified **API endpoint, data model, or integration**
- Each new **pattern, dependency, or convention**

#### 2 — Map each change to a target file

For each item, find the **single best target** in `specs/specifications/`:
- **Scan headers first** — read only the first 5-10 lines of each candidate to match by title/structure, then read the full file only for the selected target
- Prefer updating an existing section over creating a new file
- If no suitable file exists, create one following existing naming conventions

#### 3 — Update functional docs (`specs/specifications/functional/` or equivalent)

What the feature does, from the **user's perspective**:
- Present tense: "The system sends…"
- Cover: behavior, inputs/outputs, edge cases, error states
- **Before editing**: read the full target file, match its structure

#### 4 — Update technical docs (`specs/specifications/technical/` or equivalent)

How it's implemented, from the **developer's perspective**:
- APIs: method, path, request/response shape, error codes
- Data models: fields, relationships
- Integrations: external services, webhooks, event flows
- Short code examples only when they clarify usage
- **Before editing**: read the full target file, match its structure

#### 5 — Conditional: update CLAUDE.md

Only if **at least one** is true:
- New technology or dependency added
- New architectural pattern introduced
- New CLI command or dev convention established

Otherwise, do **not** touch CLAUDE.md.

#### 6 — Conditional: Mermaid sequence diagrams

Add or update **only** when the feature introduces:
- A multi-step workflow (3+ steps)
- An API sequence with 3+ actors
- An interaction with an external service

Place in the **most relevant technical doc**, not in a separate file.

Rules:
- Max 6 participants — split if needed
- `->>` for sync calls, `-->>` for async/responses
- Short labels (verb + noun, max 5 words)
- Update existing diagrams in-place — never duplicate

## Output

**Do not commit.** Report what was done:

```
📚 Specifications synchronized

Updated:
- specs/specifications/functional/[file].md: [what changed]
- specs/specifications/technical/[file].md: [what changed]

Created:
- specs/specifications/[path]/[file].md: [why new file was needed]

Skipped:
- CLAUDE.md: [reason, omit if updated]
```

Omit any section with no entries. If nothing needed synchronization:
```
✅ Specifications already up to date — no changes needed.
```
