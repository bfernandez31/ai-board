# Research: Code Simplifier and PR Review Commands

**Branch**: `AIB-169-add-code-simplifier` | **Date**: 2026-01-21

## Research Questions & Findings

### 1. Command File Structure Pattern

**Decision**: Follow existing command file pattern in `.claude/commands/`

**Rationale**: Existing commands (`/cleanup`, `/verify`, `/quick-impl`) provide proven structure with YAML frontmatter, clear phases, safety rules, and context discovery sections.

**Key Pattern Elements**:
```yaml
---
command: "/command-name"
description: "Brief description"
model: "opus"  # optional, for complex analysis
allowed-tools: ["Read", "Edit", "Write", "Glob", "Grep", "Bash", "TodoWrite"]
---
```

**Alternatives Considered**:
- Custom script approach: Rejected - commands provide Claude Code native integration
- Agent-based approach: User explicitly requested command approach over agent

### 2. Workflow Integration Points

**Decision**: Code simplifier runs after "Commit Test Fixes" (line 352-370), before "Update Documentation" (line 372-420). Code review runs after "Create Pull Request" (line 422-438).

**Rationale**:
- Code simplifier before documentation ensures docs reflect final code state
- Code review after PR creation allows posting comments directly to PR

**Integration Sequence**:
```
Phase 3: Execute /verify → Test Fixes
  ↓
Commit Test Fixes (existing)
  ↓
NEW: Execute /code-simplifier  ← Insert here
  ↓
Commit Simplification Changes (NEW)
  ↓
Phase 5: Update Documentation (existing)
  ↓
Phase 6: Create Pull Request (existing)
  ↓
NEW: Execute /code-review  ← Insert here
```

**Alternatives Considered**:
- Code simplifier before test fixes: Rejected - tests must pass first to ensure functionality preserved
- Code review before PR: Rejected - user explicitly requested "after the creation of the PR"

### 3. Changed Files Detection

**Decision**: Use `git diff --name-only main...HEAD` to identify recently modified files for code simplifier scope

**Rationale**:
- Consistent with existing workflow patterns (cleanup uses similar approach)
- Focuses effort on changed code only, not entire codebase
- Allows Claude to prioritize high-impact simplifications

**Implementation Pattern**:
```bash
# Get list of changed TypeScript files
git diff --name-only main...HEAD -- '*.ts' '*.tsx' ':!*.test.*' ':!*.spec.*'
```

### 4. Constitution and CLAUDE.md Integration for Code Review

**Decision**: Read both context sources but use as reference only (not specification extraction)

**Rationale**: User explicitly stated "do not extract specifications from it, only make a reference"

**Loading Pattern**:
```markdown
## Context Discovery
1. CLAUDE.md (auto-loaded) → Project stack, conventions
2. Read `.specify/memory/constitution.md` → Project principles
3. Use both as review criteria checklist
```

### 5. Confidence Scoring System

**Decision**: Use 0-100 scale with threshold of 80 for reporting issues

**Rationale**:
- FR-007 and FR-008 explicitly require this scoring system
- Threshold of 80 balances catching real issues vs false positives
- SC-006 targets <20% false positive rate

**Scoring Categories**:
| Confidence | Classification |
|------------|----------------|
| 90-100 | Critical - definite violation requiring immediate attention |
| 80-89 | High - likely violation, should be reported |
| 70-79 | Medium - potential issue, below threshold |
| <70 | Low - uncertain, do not report |

### 6. PR Comment Format

**Decision**: Post structured markdown comment with categorized findings

**Rationale**: Follows existing patterns (create-pr-only.sh posts comments, ai-board-assist posts updates)

**Comment Structure**:
```markdown
## Code Review Summary

### Issues Found (Confidence ≥ 80)
- [Category]: [Description] (Confidence: [score])

### Constitution Compliance
- [Principle]: [Status]

### CLAUDE.md Alignment
- [Convention]: [Status]

---
🤖 Automated code review by ai-board
```

### 7. Code Simplification Scope

**Decision**: Focus on clarity and consistency improvements only

**Patterns to Simplify**:
- Nested ternaries → if/else or switch
- Redundant abstractions → inline where appropriate
- Complex boolean expressions → named variables
- Deeply nested callbacks → async/await
- Unnecessary indirection → direct calls

**Patterns to Preserve**:
- All existing functionality (critical)
- Performance optimizations
- Type safety mechanisms
- Error handling boundaries
- API contracts

### 8. Testing Strategy

**Decision**: Integration tests verify workflow behavior; command output verification via result files

**Rationale**: Per constitution, integration tests are preferred for workflow behavior verification

**Test Approach**:
- Test that commands produce expected output format
- Test that workflow steps execute in correct order
- Test that PR comments are posted successfully
- Do not test Claude's internal analysis (behavior, not implementation)

## Dependencies & Prerequisites

| Dependency | Purpose | Source |
|------------|---------|--------|
| Claude Code CLI | Command execution | Already in workflow |
| GitHub CLI (`gh`) | PR comment posting | Already in workflow |
| `git diff` | Changed files detection | Git (available) |
| Constitution file | Review criteria | `.specify/memory/constitution.md` |
| CLAUDE.md files | Project conventions | Auto-loaded |

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Code simplifier breaks functionality | Run impacted tests after changes; revert if failures |
| Review posts too many false positives | Confidence threshold (≥80) filters low-confidence issues |
| Workflow timeout due to added steps | Keep commands focused; parallel operations where possible |
| Constitution file missing | Graceful fallback to CLAUDE.md-only review |

## Open Questions Resolved

1. **Q**: Should code simplifier run full test suite?
   **A**: No - only run impacted tests per existing `/cleanup` pattern to stay within workflow timeouts

2. **Q**: What if PR creation fails before code review?
   **A**: Code review step should be conditional on PR URL availability

3. **Q**: How to handle large PRs exceeding review capacity?
   **A**: Process what can be processed; note limitations in review comment

4. **Q**: How to identify which constitution principles were violated?
   **A**: Match code patterns against non-negotiable rules listed in each principle section
