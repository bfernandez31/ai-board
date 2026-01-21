---
command: "/code-simplifier"
description: "Simplify recently modified code while preserving functionality"
model: "opus"
allowed-tools: ["Read", "Edit", "Glob", "Grep", "Bash", "TodoWrite"]
---

# /code-simplifier - Code Simplification Command

> **Model**: Opus (deep analysis required)
> **Thinking**: Ultrathink (comprehensive code understanding)

Automated code simplification analyzing changed files on the current branch.

## Input Payload

`$ARGUMENTS` contains optional parameters:
```
--branch <branch-name>  # Feature branch name (optional, defaults to current branch)
```

## Context Discovery

1. **CLAUDE.md** (auto-loaded) → Project stack, conventions, commands
2. **Read `.specify/memory/constitution.md`** → Project principles, non-negotiable rules
3. **Get changed files** → Use `git diff --name-only main...HEAD` to identify modified files

## Workflow

### Phase 1: Identify Targets

List all changed TypeScript files (excluding tests):

```bash
# Get list of changed TypeScript files
git diff --name-only main...HEAD -- '*.ts' '*.tsx' ':!*.test.*' ':!*.spec.*'
```

Filter to files with simplification opportunities:
- Read each file and identify complexity patterns
- Skip files that are already clean and simple

Update progress:
- [x] T001: Get changed files list
- [x] T002: Filter to TypeScript source files

### Phase 2: Analyze & Simplify

For each target file, analyze and simplify using these patterns:

**Patterns to Simplify**:

| Pattern | Issue | Solution |
|---------|-------|----------|
| Nested ternaries | Hard to read | Convert to if/else or switch |
| Redundant abstractions | Unnecessary indirection | Inline where appropriate |
| Complex boolean expressions | Cognitive load | Extract to named variables |
| Deeply nested callbacks | Callback hell | Convert to async/await |
| Unnecessary indirection | Extra layers | Direct function calls |
| Overly clever code | Maintainability | Straightforward alternatives |

**Patterns to PRESERVE** (DO NOT CHANGE):

- All existing functionality (critical)
- Performance optimizations
- Type safety mechanisms
- Error handling boundaries
- API contracts and interfaces
- Database query patterns
- Authentication/authorization logic

**For each file**:
1. Read current content
2. Identify specific simplification opportunities
3. Apply ONE change at a time
4. Run impacted tests to verify functionality
5. If tests pass → continue
6. If tests fail → revert change immediately

Update progress:
- [x] T003: Analyze file for simplification opportunities
- [x] T004: Apply simplifications one at a time
- [x] T005: Run impacted tests after each change

### Phase 3: Commit

After all simplifications are applied and tests pass:

```bash
git add .
if ! git diff --staged --quiet; then
  git commit -m "refactor(ticket-{id}): simplify code

  Simplified:
  - [list of changes made]

  All impacted tests verified passing."
fi
```

Update progress:
- [x] T006: Commit simplification changes

## Safety Rules

**NEVER**:
- Run the full test suite (only impacted tests)
- Change behavior or business logic
- Modify API contracts or response formats
- Remove functionality still in use
- Leave codebase in broken state
- Simplify code that could break tests

**ALWAYS**:
- Read `.specify/memory/constitution.md` for project principles
- Use test/lint commands from CLAUDE.md
- Test after each change
- Revert if tests fail
- Preserve all existing functionality
- Keep changes minimal and focused

## Error Handling

- If no changed files found: Log "No changed TypeScript files to simplify" and exit gracefully
- If no simplification opportunities: Log "Code is already clean, no simplifications needed" and exit
- If tests fail after change: Revert immediately and continue to next opportunity
- If all simplifications fail: Report summary and exit gracefully

## Commit Message Format

```
refactor(ticket-{id}): simplify code

Simplified:
- [file1]: [description of change]
- [file2]: [description of change]

All impacted tests verified passing.
```

## No Changes Needed

If codebase is clean:
1. Log: "Codebase is clean, no simplifications needed"
2. Exit gracefully (no commit needed)

---

**Philosophy**: This command prioritizes code clarity and maintainability without changing behavior. It reads CLAUDE.md (auto-loaded) for stack/commands and `.specify/memory/constitution.md` for project principles. All changes must preserve existing functionality and pass impacted tests.
