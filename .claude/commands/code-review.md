---
command: '/code-review'
category: 'Code Quality'
purpose: 'Automated PR code review with parallel agents and confidence scoring'
wave-enabled: false
performance-profile: 'complex'
---

# /code-review - PR Code Review Command

Automatically review pull requests for CLAUDE.md compliance, constitution compliance, bugs, and best practices, posting findings as a formatted PR comment.

## Overview

This command executes 5 parallel review agents to comprehensively analyze PR changes, then posts findings above the confidence threshold (80) as a PR comment.

## Environment Variables

**Required** (set by verify.yml workflow):
- `FEATURE_BRANCH` - Git branch being reviewed
- `PR_NUMBER` - GitHub PR number (from workflow)
- `GH_TOKEN` - GitHub token for PR operations
- `GITHUB_REPOSITORY` - Repository in owner/repo format

## Execution Phases

### Phase 1: Context Loading

**Load compliance guidelines**:

```bash
# 1. Read constitution (non-negotiable rules)
cat .specify/memory/constitution.md

# 2. Read CLAUDE.md from project root
cat CLAUDE.md

# 3. Find CLAUDE.md in modified directories
git diff --name-only main...HEAD | xargs -I{} dirname {} | sort -u | while read dir; do
  [ -f "$dir/CLAUDE.md" ] && cat "$dir/CLAUDE.md"
done
```

**If constitution.md is missing**:
- Log warning: "Constitution not found at .specify/memory/constitution.md, proceeding with CLAUDE.md only"
- Continue with CLAUDE.md guidelines

### Phase 2: PR Analysis

**Get PR diff and context**:

```bash
# Get PR diff
gh pr diff ${PR_NUMBER}

# Get current commit SHA for file links
GIT_SHA=$(git rev-parse HEAD)

# Get repository info for links
# Format: https://github.com/${GITHUB_REPOSITORY}/blob/${GIT_SHA}/${file}#L${line}
```

### Phase 3: Parallel Agent Review

**Launch 5 review agents simultaneously using Task tool**:

Each agent analyzes the PR diff from a specific dimension and returns findings.

#### Agent 1: CLAUDE_MD_COMPLIANCE

**Focus**: CLAUDE.md guideline adherence

**Checks**:
- ES module syntax usage (import/export over require/module.exports)
- Function keyword preference (named functions over arrow functions for exports)
- Explicit return types on all functions
- Component patterns (shadcn/ui usage, feature folders)
- API route conventions (App Router patterns)
- State management (TanStack Query for server state)

**Base confidence**: 75-85 (coding style violations)

#### Agent 2: CONSTITUTION_COMPLIANCE

**Focus**: Constitution non-negotiable rules

**Checks**:
- TypeScript strict mode compliance (no implicit any)
- No `any` types without justification comment
- shadcn/ui exclusive usage (no custom UI primitives)
- Prisma parameterized queries (no raw SQL)
- Testing Trophy compliance (right test type for right scenario)
- Security-first patterns (input validation, no exposed secrets)

**Base confidence**: 80-90 (constitution violations are high confidence)

#### Agent 3: BUG_DETECTION

**Focus**: Identifying obvious bugs and issues

**Checks**:
- Null/undefined handling (optional chaining, null checks)
- Promise error handling (try-catch, .catch())
- Off-by-one errors (array indexing)
- Logic errors (wrong operator, inverted conditions)
- Race conditions (async state updates)
- Missing await keywords

**Base confidence**: 70-95 (varies by certainty)

#### Agent 4: GIT_HISTORY_CONTEXT

**Focus**: Changes in context of git history

**Checks**:
- Regression risk (reverting previous fixes)
- Breaking changes (API signature changes)
- Related file changes (modified dependency not updated)
- Dependency updates impact (version compatibility)
- Large refactors without tests

**Base confidence**: 65-80 (context-dependent)

#### Agent 5: CODE_COMMENT_COMPLIANCE

**Focus**: Code comments and documentation

**Checks**:
- JSDoc on exported complex functions
- Comment accuracy (comments match code)
- TODO/FIXME resolution (should be addressed)
- Dead comment removal (commented-out code)
- Excessive comments (over-documented simple code)

**Base confidence**: 60-75 (stylistic)

### Phase 4: Confidence Scoring

**Calculate confidence score for each finding**:

```
Base Score (per dimension):
- CLAUDE_MD_COMPLIANCE: 75 base
- CONSTITUTION_COMPLIANCE: 80 base
- BUG_DETECTION: 70 base
- GIT_HISTORY_CONTEXT: 65 base
- CODE_COMMENT_COMPLIANCE: 60 base

Modifiers:
- Explicit rule violation: +30 points
- Pattern match (clear violation): +20 points
- Context suggests (indirect evidence): +10 points
- Uncertain but suspicious: +5 points
```

**Constitution rule base scores** (high priority):
- TypeScript strict mode violation: 80 base + 30 (explicit) = 100+
- `any` type without justification: 85 base
- shadcn/ui violation: 80 base
- Testing Trophy violation: 80 base
- Security violation: 90 base

**CLAUDE.md guideline base scores**:
- Coding style violation: 75-85 base
- Pattern violation: 70-80 base
- Convention violation: 65-75 base

### Phase 5: Filtering

**Apply confidence threshold**:

```typescript
const CONFIDENCE_THRESHOLD = 80;
const filteredFindings = findings.filter(f => f.confidence >= CONFIDENCE_THRESHOLD);
```

Only findings with confidence >= 80 are included in the PR comment.

### Phase 6: Output Formatting

**Generate markdown table**:

```markdown
## 🔍 Automated Code Review Results

| Issue | File | Confidence | Source |
|-------|------|------------|--------|
| Missing type annotation | [src/api/tickets.ts:42](https://github.com/{owner}/{repo}/blob/{SHA}/src/api/tickets.ts#L42) | 85% | Constitution |
| Unused import | [src/utils/helpers.ts:5](https://github.com/{owner}/{repo}/blob/{SHA}/src/utils/helpers.ts#L5) | 82% | CLAUDE.md |

**Total Issues Found**: 2
**Review Dimensions**: CLAUDE.md ✅ | Constitution ✅ | Bugs ✅ | History ✅ | Comments ✅

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

**If no issues found**:

```markdown
## ✅ Automated Code Review Results

No issues found above confidence threshold (80%).

**Review Dimensions**: CLAUDE.md ✅ | Constitution ✅ | Bugs ✅ | History ✅ | Comments ✅

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

### Phase 7: Post Comment

**Post to PR using GitHub CLI**:

```bash
gh pr comment ${PR_NUMBER} --body "$(cat <<'EOF'
[generated markdown content]
EOF
)"
```

## Constraints (CRITICAL)

**MUST NOT**:
- Run `bun run build` - CI handles build validation
- Run `bun run type-check` - CI handles type checking
- Run `bun run test` - CI handles test execution
- Block workflow on review failures (non-blocking)
- Create issues or labels - advisory only

**MUST**:
- Complete within 15 minutes
- Post comment to PR (if PR exists)
- Include source (CLAUDE.md or Constitution) for each finding
- Use full Git SHA in file links
- Handle errors gracefully (log and continue)

## Error Handling

**If PR doesn't exist**:
```
Warning: PR #${PR_NUMBER} not found, skipping code review
```

**If gh CLI fails**:
```
Warning: Failed to post PR comment. Review completed but not posted.
```

**If constitution.md missing**:
```
Warning: Constitution not found, proceeding with CLAUDE.md only
```

**If timeout occurs**:
```
Warning: Code review timed out after 15 minutes
```

All errors are non-blocking - the workflow continues.

## Edge Cases

### Missing constitution.md
- Proceed with CLAUDE.md only
- Log warning message
- Constitution-related checks are skipped

### PR creation failure
- Skip code review step entirely
- No error (graceful skip)

### API timeout
- Log warning
- Continue workflow without review comment
- Review is advisory, not blocking

### Large PRs (>100 files)
- Focus on most critical files (TypeScript sources)
- Skip generated files, dependencies, tests
- Note truncation in comment

## Performance

- Use parallel Task agents for review dimensions
- Timeout: 15 minutes total
- Non-blocking (continue-on-error: true in workflow)

## Example Workflow

```
User: /code-review

Phase 1: Context Loading
   Reading .specify/memory/constitution.md...
   Reading CLAUDE.md...

Phase 2: PR Analysis
   PR #42: Add user authentication feature
   Changed files: 15 (src/*, app/api/*)

Phase 3: Parallel Agent Review
   Launching 5 review agents...
   - CLAUDE_MD_COMPLIANCE: 3 findings
   - CONSTITUTION_COMPLIANCE: 1 finding
   - BUG_DETECTION: 2 findings
   - GIT_HISTORY_CONTEXT: 0 findings
   - CODE_COMMENT_COMPLIANCE: 1 finding

Phase 4: Confidence Scoring
   Total findings: 7
   Above threshold (80): 4

Phase 5: Filtering
   Filtered to 4 high-confidence findings

Phase 6: Output Formatting
   Generated markdown table

Phase 7: Post Comment
   Posted comment to PR #42

Done. Code review complete with 4 issues reported.
```
