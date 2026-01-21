---
command: '/code-review'
category: 'Testing & Quality'
purpose: 'Comprehensive code review of a pull request with CLAUDE.md and constitution compliance'
wave-enabled: false
performance-profile: 'complex'
---

# /code-review - Pull Request Code Review Command

Provide a comprehensive code review for a pull request, checking for bugs and compliance with CLAUDE.md and constitution.md guidelines.

## Usage

```bash
/code-review <pr-number-or-branch>
```

## Overview

This command performs a multi-faceted code review on a pull request, checking for:
1. Compliance with CLAUDE.md development guidelines
2. Compliance with constitution.md principles
3. Potential bugs and logic errors
4. Historical context from git blame and related PRs
5. Code comment compliance

## Workflow Steps

### Step 1: Eligibility Check

Check if the pull request is reviewable:
- Is the PR open (not closed)?
- Is the PR not a draft?
- Does it need a code review (not automated or trivially simple)?
- Has it already been reviewed by AI-BOARD?

If any of these conditions fail, exit gracefully with an appropriate message.

### Step 2: Gather Context Files

Retrieve relevant context files:
- Root `CLAUDE.md` file
- Root `.specify/memory/constitution.md` file
- `CLAUDE.md` files in directories whose files the PR modified (if any exist)

### Step 3: PR Summary

View the pull request and create a summary:
- What files were modified?
- What is the high-level purpose of the change?
- What areas of the codebase are affected?

### Step 4: Parallel Code Review (5 Analysis Passes)

Launch 5 independent analysis passes reviewing the changes:

#### Pass #1: CLAUDE.md Compliance Audit
- Verify changes comply with CLAUDE.md guidelines
- Check tech stack requirements (TypeScript strict, React 18, Next.js patterns)
- Verify testing patterns follow Testing Trophy architecture
- Check component patterns (shadcn/ui usage, feature-based folders)
- Note: CLAUDE.md is guidance for Claude writing code, so focus on applicable rules

#### Pass #2: Constitution.md Compliance Audit
- Verify changes comply with constitution principles
- Check TypeScript-First Development rules (no `any` types, explicit typing)
- Check Component-Driven Architecture rules
- Check Test-Driven Development rules
- Check Security-First Design rules
- Check Database Integrity rules
- Verify AI-First Development Model compliance

#### Pass #3: Bug Detection
- Shallow scan for obvious bugs
- Focus only on the changes themselves (not pre-existing code)
- Flag large bugs only; avoid nitpicks
- Ignore likely false positives
- Check for:
  - Null/undefined handling issues
  - Async/await missing
  - Type safety violations
  - Off-by-one errors
  - Resource leaks

#### Pass #4: Git History Analysis
- Read git blame and history of modified code
- Identify bugs in light of historical context
- Check if changes break patterns established by previous commits
- Look for related previous changes that might be affected

#### Pass #5: Code Comments Compliance
- Read code comments in modified files
- Ensure changes comply with guidance in comments (TODOs, FIXMEs, implementation notes)
- Verify JSDoc comments are accurate for modified functions

Each pass returns: list of issues + reason each was flagged (CLAUDE.md, constitution, bug, historical context, etc.)

### Step 5: Issue Confidence Scoring

For each issue found in Step 4, score confidence (0-100):

**Scoring Rubric**:
- **0-20**: Not confident. Likely false positive or pre-existing issue
- **25-40**: Somewhat confident. Might be real but unverified; stylistic issues not explicitly in CLAUDE.md or constitution
- **50-60**: Moderately confident. Verified as real but may be nitpick; not critical relative to PR
- **75-85**: Highly confident. Verified as real issue likely hit in practice; explicitly mentioned in CLAUDE.md/constitution or directly impacts functionality
- **90-100**: Absolutely certain. Confirmed as definite issue with direct evidence

### Step 6: Filter Issues

Remove any issues with confidence score < 80. If no issues remain, report "No significant issues found."

### Step 7: Comment on PR

Post results back to the PR using `gh pr comment`. Keep output brief and cite relevant code, files, and URLs.

## False Positive Examples

The following should NOT be flagged:
- Pre-existing issues (code that was there before the PR)
- Things that look like bugs but aren't (intentional design decisions)
- Pedantic nitpicks a senior engineer wouldn't call out
- Issues caught by linters, typecheckers, or compilers (missing imports, type errors, broken tests, formatting, style)
- General code quality issues (test coverage, security, documentation) unless explicitly required by CLAUDE.md or constitution
- Issues called out in CLAUDE.md/constitution but silenced in code (lint ignore comments)
- Intentional functionality changes related to broader PR scope
- Real issues on lines the PR didn't modify

## Important Notes

- Do NOT check build signals or attempt to build/typecheck (verify workflow handles this)
- Use `gh` commands to interact with GitHub
- Make a todo list first to track progress
- MUST cite and link each issue found
- Use full git SHA in links: `https://github.com/owner/repo/blob/[FULL_SHA]/file#L[start]-L[end]`
- Read BOTH CLAUDE.md AND constitution.md for comprehensive compliance checking

## Output Format

### If Issues Found (confidence >= 80)

```markdown
### Code Review

Found [N] issues:

1. **[file:line]** [Issue description]
   - Source: [CLAUDE.md | constitution | bug detection | historical context]
   - Evidence: "[Quote from CLAUDE.md/constitution or bug description]"
   - Confidence: [score]%

2. ...

---
Generated by [AI-BOARD](https://github.com/bfernandez31/ai-board) code review

- If this review was helpful, react with a thumbs up
- If it flagged false positives, react with a thumbs down
```

### If No Issues Found

```markdown
### Code Review

No significant issues found (confidence >= 80%).

**Checked for**:
- CLAUDE.md compliance (tech stack, testing patterns, component architecture)
- Constitution compliance (TypeScript-first, security, database integrity)
- Bug detection (null handling, async issues, type safety)
- Historical context (git blame, related PRs)
- Code comment compliance

---
Generated by [AI-BOARD](https://github.com/bfernandez31/ai-board) code review
```

## Integration with Verify Workflow

This command is invoked by the verify workflow after PR creation. It provides an automated code review before the PR is marked ready for human review.
