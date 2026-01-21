# Research: Code Simplifier and PR Code Review

**Feature**: AIB-167-add-code-simplifier
**Date**: 2026-01-21

## Decision 1: Code Simplifier Command Structure

**Decision**: Create a new Claude Code command `/code-simplify` following the existing `/verify` pattern

**Rationale**:
- Existing commands (`/verify`, `/cleanup`, `/iterate-verify`) provide proven patterns for multi-phase execution
- YAML frontmatter + markdown structure enables consistent tool categorization
- Command should execute in phases: Discovery → Analysis → Implementation → Validation → Commit

**Alternatives Considered**:
- Inline bash script in workflow: Rejected because complex logic benefits from Claude's intelligence
- Combining with `/verify` command: Rejected to maintain single responsibility and avoid bloating existing command

**Implementation Pattern** (from `/verify.md`):
```yaml
---
command: '/code-simplify'
category: 'Code Quality'
purpose: 'Automated code simplification maintaining functionality'
wave-enabled: false
performance-profile: 'complex'
---
```

## Decision 2: Code Review Command Structure

**Decision**: Create a new Claude Code command `/code-review` with parallel agent pattern

**Rationale**:
- Spec FR-008 requires 5 parallel agents for comprehensive coverage
- Parallel execution reduces total review time
- Each agent focuses on specific compliance dimension

**Alternatives Considered**:
- Single sequential review: Rejected because spec explicitly requires parallel agents (FR-008)
- GitHub Actions matrix strategy: Rejected because agents need shared context and consolidated output

**Implementation Pattern** (parallel tool calls):
```markdown
**Review Dimensions** (parallel analysis):
1. CLAUDE.md compliance agent
2. Constitution compliance agent
3. Bug detection agent
4. Git history context agent
5. Code comment compliance agent
```

## Decision 3: PR Comment Creation Method

**Decision**: Use GitHub CLI (`gh pr comment`) for PR comments per FR-014

**Rationale**:
- FR-014 explicitly mandates GitHub CLI for PR comment operations
- Existing codebase uses `gh pr create` and `gh pr view` patterns
- GitHub CLI handles authentication via `GH_TOKEN` environment variable

**Alternatives Considered**:
- Internal AI-Board API: Used for ticket comments but not appropriate for GitHub PR comments
- GitHub REST API via curl: More complex authentication handling than gh CLI

**Implementation Pattern** (from create-pr-only.sh):
```bash
# Query PR number from branch
PR_NUMBER=$(gh pr view "${BRANCH}" --json number -q '.number' 2>/dev/null || echo "")

# Post PR comment (FR-014)
gh pr comment "${PR_NUMBER}" --body "$(cat <<'EOF'
## 🔍 Code Review Results
[formatted markdown content]
EOF
)"
```

## Decision 4: Confidence Threshold Implementation

**Decision**: Filter issues with confidence < 80 before reporting (FR-010)

**Rationale**:
- Auto-resolved decision in spec confirms 80 threshold matches reference implementation
- Reduces false positives in PR comments
- Maintains actionable signal-to-noise ratio

**Alternatives Considered**:
- Lower threshold (60): Would increase noise with more false positives
- Higher threshold (90): Would miss valid issues, reducing coverage

**Implementation Pattern**:
```markdown
**Filtering Logic**:
1. Each agent assigns confidence score (0-100) to identified issues
2. Agent outputs issues in JSON format with confidence field
3. Before posting, filter: issues.filter(i => i.confidence >= 80)
4. Format remaining issues as markdown table with file references
```

## Decision 5: Context Loading Strategy

**Decision**: Load both CLAUDE.md and constitution.md for compliance checking (FR-006, FR-007)

**Rationale**:
- Spec explicitly requires reading both files
- Constitution contains non-negotiable rules (TypeScript strict, no `any` types, etc.)
- CLAUDE.md contains project-specific conventions and patterns
- Combined context ensures comprehensive compliance checking

**Alternatives Considered**:
- Constitution only: Would miss project-specific patterns in CLAUDE.md
- CLAUDE.md only: Would miss constitutional non-negotiable rules

**Implementation Pattern** (from ai-board-assist.md):
```markdown
1. Read `.specify/memory/constitution.md` (non-negotiable rules)
2. Read `CLAUDE.md` from project root (project conventions)
3. Read CLAUDE.md from modified directories (directory-specific context)
4. Apply constitution rules first (higher priority)
5. Apply CLAUDE.md patterns second
```

## Decision 6: Workflow Step Placement

**Decision**: Place code simplifier after test fixes commit and before documentation sync (FR-001)

**Rationale**:
- Auto-resolved decision in spec confirms conservative approach
- Running before documentation ensures simplified code is reflected in docs
- Running after test fixes ensures code changes won't break tests

**Alternatives Considered**:
- Before test fixes: Would require re-running tests after simplification
- After documentation: Documentation would reflect pre-simplified code

**Workflow Order** (verify.yml modification):
```
Phase 3: Execute /verify Command (test fixes)
Phase 4: Commit Test Fixes
Phase 4.5: Execute /code-simplify (NEW)
Phase 4.6: Commit Simplifications (NEW)
Phase 5: Update Documentation
Phase 6: Create Pull Request
Phase 6.5: Execute /code-review (NEW - after PR creation)
```

## Decision 7: Code Review Non-Blocking Behavior

**Decision**: Code review failures should not block workflow completion

**Rationale**:
- Edge case in spec: "Review step fails gracefully; PR remains without review comment; workflow continues"
- Code review is informational, not gatekeeping
- Human reviewers make final merge decisions

**Alternatives Considered**:
- Blocking on failures: Would prevent PR creation on API timeouts
- Blocking on findings: Would prevent legitimate PRs that have minor issues

**Implementation Pattern**:
```yaml
- name: Execute Code Review
  continue-on-error: true  # Non-blocking
  run: |
    claude --dangerously-skip-permissions "/code-review ..."

- name: Post Review Comment
  if: ${{ success() }}  # Only if review completed
  run: |
    gh pr comment ...
```

## Decision 8: Issue Reporting Format

**Decision**: Format findings as markdown table with file references using full Git SHA (FR-012)

**Rationale**:
- FR-011 requires formatted Markdown comment
- FR-012 requires full Git SHA file links
- Markdown tables provide clear, scannable format

**Alternatives Considered**:
- Plain text list: Less scannable, harder to identify issues at glance
- JSON output: Not human-readable for PR comments

**Output Format**:
```markdown
## 🔍 Automated Code Review Results

| Issue | File | Confidence | Source |
|-------|------|------------|--------|
| Missing type annotation | [src/file.ts:42](https://github.com/.../blob/{SHA}/src/file.ts#L42) | 85% | Constitution |
| Unused import | [src/util.ts:5](https://github.com/.../blob/{SHA}/src/util.ts#L5) | 90% | CLAUDE.md |

**Total Issues Found**: 2
**Review Dimensions**: CLAUDE.md ✅ | Constitution ✅ | Bugs ✅ | History ✅ | Comments ✅
```

## Decision 9: Scope Limitation for Code Simplifier

**Decision**: Simplifier focuses only on files changed in the feature branch (FR-003)

**Rationale**:
- FR-003 explicitly requires focus on recently modified code
- Prevents unintended changes to stable code
- Reduces execution time and review scope

**Alternatives Considered**:
- Full codebase: Would create massive, unrelated changes
- Only files in latest commit: Would miss files changed earlier in branch

**Implementation Pattern**:
```bash
# Get files changed on feature branch vs main
CHANGED_FILES=$(git diff --name-only main...HEAD -- '*.ts' '*.tsx')

claude --dangerously-skip-permissions "/code-simplify ${CHANGED_FILES}"
```

## Decision 10: No Build/Typecheck in Code Review

**Decision**: Code review MUST NOT run build or typecheck (FR-013)

**Rationale**:
- FR-013 explicitly states CI handles build/typecheck
- Avoids duplicate work (CI already validates)
- Keeps code review focused on intelligent analysis

**Alternatives Considered**:
- Run build for validation: Duplicates CI, increases execution time
- Run typecheck for type issues: Already covered by CI

**Implementation Note**:
- Code review uses file reading and pattern matching only
- No `bun run build`, `bun run type-check`, or similar commands
- Type issues detected via static analysis of code patterns
