---
command: "/code-review"
description: "Review PR changes against CLAUDE.md and constitution guidelines"
model: "opus"
allowed-tools: ["Read", "Glob", "Grep", "Bash", "WebFetch"]
---

# /code-review - PR Code Review Command

> **Model**: Opus (deep analysis required)
> **Thinking**: Ultrathink (comprehensive code review)

Automated code review analyzing PR changes against project guidelines and constitution principles.

## Input Payload

`$ARGUMENTS` contains required parameters:
```
--pr-number <number>  # Pull Request number to review
```

## Context Discovery

1. **CLAUDE.md** (auto-loaded) → Project stack, conventions, coding standards
2. **Read `.specify/memory/constitution.md`** → Project principles (reference only, not specification extraction)
3. **Get PR changes** → Use `gh pr diff <PR_NUMBER>` to get changed files

## Workflow

### Phase 1: Gather Context

1. Get PR information:
   ```bash
   gh pr view <PR_NUMBER> --json number,title,body,changedFiles,additions,deletions
   ```

2. Get PR diff:
   ```bash
   gh pr diff <PR_NUMBER>
   ```

3. Read changed files in full for context:
   - Parse diff to identify modified files
   - Read each modified file to understand context

4. Load review criteria:
   - CLAUDE.md conventions (auto-loaded)
   - Constitution principles (`.specify/memory/constitution.md`)

### Phase 2: Review

For each changed file, analyze against:

**CLAUDE.md Conventions**:
- TypeScript strict mode compliance
- Naming conventions (files, functions, variables)
- API route patterns
- Test organization
- State management patterns
- Error handling patterns

**Constitution Principles** (reference only):
- I. TypeScript-First Development
- II. Component-Driven Architecture
- III. Test-Driven Development
- IV. Security-First Design
- V. Database Integrity
- VI. AI-First Development Model

**For each potential issue**:
1. Identify the specific concern
2. Reference the guideline/principle being checked
3. Assess severity (Critical/High/Medium)
4. Assign confidence score (0-100)

### Phase 3: Report

**Filter issues**: Only report issues with confidence >= 80

**Post comment to PR**:
```bash
gh pr comment <PR_NUMBER> --body "<formatted-review>"
```

**Comment Format**:
```markdown
## Code Review Summary

### Issues Found (Confidence >= 80)

| File | Line | Issue | Severity | Confidence |
|------|------|-------|----------|------------|
| path/to/file.ts | 42 | Description of issue | Critical | 95 |

### Constitution Compliance

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | Compliant | - |
| II. Component-Driven | Compliant | - |

### CLAUDE.md Alignment

| Convention | Status |
|------------|--------|
| API route patterns | Compliant |
| Error handling | Compliant |

---
:robot: Automated code review by ai-board
```

## Scoring

**Confidence Score Guidelines**:

| Score | Classification | Action |
|-------|---------------|--------|
| 90-100 | Critical | Definite violation, must be addressed |
| 80-89 | High | Likely violation, should be reported |
| 70-79 | Medium | Potential issue, below reporting threshold |
| < 70 | Low | Uncertain, do not report |

**Factors that INCREASE confidence**:
- Clear violation of explicit rule in CLAUDE.md
- Violation of "Non-Negotiable Rules" in constitution
- Pattern that contradicts established codebase conventions
- Security concern (input validation, SQL injection, XSS)
- Type safety violation (`any` type without justification)

**Factors that DECREASE confidence**:
- Edge case or unusual but valid pattern
- Code that may be intentionally different for performance
- New pattern that could be an improvement
- Subjective style preference not in guidelines

## Error Handling

- If PR not found: Log "PR #<number> not found" and exit gracefully
- If no changed files: Log "No changed files to review" and exit
- If constitution file missing: Continue with CLAUDE.md only (graceful fallback)
- If posting comment fails: Log warning but don't fail workflow

## No Issues Found

If no issues with confidence >= 80:
```markdown
## Code Review Summary

:white_check_mark: **No issues found**

The code changes appear to comply with project guidelines and constitution principles.

### Constitution Compliance
All applicable principles verified.

### CLAUDE.md Alignment
All conventions followed.

---
:robot: Automated code review by ai-board
```

## Safety Rules

**NEVER**:
- Report issues with confidence < 80 (to minimize false positives)
- Fail the workflow based on review findings (review is informational)
- Make changes to code (this is read-only analysis)
- Extract or generate specifications from constitution (reference only)

**ALWAYS**:
- Read `.specify/memory/constitution.md` for project principles
- Reference specific guidelines when reporting issues
- Include confidence scores for transparency
- Post review comment to PR

---

**Philosophy**: This command provides quality feedback without blocking merges. High confidence threshold (80) reduces false positives to meet <20% target. Reviews are informational, not gatekeeping. Constitution is used as reference for principles, not specification extraction.
