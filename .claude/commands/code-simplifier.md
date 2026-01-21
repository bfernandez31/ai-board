---
command: "/code-simplifier"
description: "Simplifies and refines code for clarity, consistency, and maintainability while preserving all functionality"
model: "opus"
allowed-tools: ["Read", "Edit", "Write", "Glob", "Grep", "Bash", "TodoWrite"]
---

# Code Simplifier Command

> **Model**: Opus (deep analysis required)
> **Purpose**: Enhancing code clarity while maintaining functionality

Simplifies and refines code for clarity, consistency, and maintainability while preserving all functionality. Focuses on recently modified code unless instructed otherwise.

## Context Discovery

1. **CLAUDE.md** (auto-loaded) → Project stack, commands, conventions
2. **Read `.specify/memory/constitution.md`** → Project principles, non-negotiable rules
3. **Get modified files** → Use `git diff --name-only main...HEAD` to identify changed files

## Refinement Goals

You will analyze recently modified code and apply refinements that:

### 1. Preserve Functionality

Never change what the code does - only how it does it. All original features, outputs, and behaviors must remain intact.

### 2. Apply Project Standards

Follow the established coding standards from CLAUDE.md including:

- Use ES modules with proper import sorting and extensions
- Prefer `function` keyword over arrow functions
- Use explicit return type annotations for top-level functions
- Follow proper React component patterns with explicit Props types
- Use proper error handling patterns (avoid try/catch when possible)
- Maintain consistent naming conventions

### 3. Enhance Clarity

Simplify code structure by:

- Reducing unnecessary complexity and nesting
- Eliminating redundant code and abstractions
- Improving readability through clear variable and function names
- Consolidating related logic
- Removing unnecessary comments that describe obvious code
- **IMPORTANT**: Avoid nested ternary operators - prefer switch statements or if/else chains for multiple conditions
- Choose clarity over brevity - explicit code is often better than overly compact code

### 4. Maintain Balance

Avoid over-simplification that could:

- Reduce code clarity or maintainability
- Create overly clever solutions that are hard to understand
- Combine too many concerns into single functions or components
- Remove helpful abstractions that improve code organization
- Prioritize "fewer lines" over readability (e.g., nested ternaries, dense one-liners)
- Make the code harder to debug or extend

### 5. Focus Scope

Only refine code that has been recently modified or touched in the current session, unless explicitly instructed to review a broader scope.

## Execution Process

### Phase 1: Discovery

```bash
# Get list of modified files since branching from main
git diff --name-only main...HEAD
```

Filter to only include code files (exclude test files, configs, docs):
- `*.ts`, `*.tsx` - TypeScript files
- `*.js`, `*.jsx` - JavaScript files
- Exclude: `*.test.*`, `*.spec.*`, `*.md`, `*.json`, `*.yml`

### Phase 2: Analysis

For each modified file:

1. Read the file content
2. Identify opportunities to improve elegance and consistency
3. Check against CLAUDE.md standards
4. Check against constitution principles

### Phase 3: Refinement

Apply project-specific best practices and coding standards:

1. Make targeted edits to simplify code
2. Ensure all functionality remains unchanged
3. Verify the refined code is simpler and more maintainable

### Phase 4: Validation

After each change:

1. Run type-check: `bun run type-check`
2. Run lint: `bun run lint`
3. If errors introduced, revert and try alternative approach

### Phase 5: Commit

If changes were made:

```bash
git add .
git commit -m "refactor: simplify code for clarity and consistency

Applied code simplification:
- [List specific improvements]

No functionality changes - only code clarity improvements."
```

## Safety Rules

**NEVER**:
- Change behavior or business logic
- Modify API contracts
- Remove functionality
- Break tests
- Make changes without validation

**ALWAYS**:
- Read CLAUDE.md for project standards
- Read constitution for project principles
- Test after each change
- Revert if validation fails
- Keep functionality identical

## No Changes Needed

If code is already clean:
1. Log: "Code already meets quality standards, no simplification needed"
2. Exit gracefully

---

**Philosophy**: This command focuses on code clarity and consistency while preserving exact functionality. It reads CLAUDE.md (auto-loaded) for stack/commands and `.specify/memory/constitution.md` for project principles.
