---
command: '/code-review'
category: 'Code Quality'
purpose: 'Automated code review for pull requests with confidence scoring'
wave-enabled: false
performance-profile: 'complex'
---

# /code-review - Pull Request Code Review Command

Conducts automated code review on pull requests using GitHub CLI. Reviews changes for bugs, CLAUDE.md compliance, constitution compliance, and code quality issues.

## Context Discovery

**CRITICAL**: Before reviewing any code, you MUST read project guidelines:

1. **CLAUDE.md** (auto-loaded) → Project stack, commands, conventions
2. **Read `.specify/memory/constitution.md`** → Project principles, non-negotiable rules

These files define the standards against which code will be reviewed.

## Input

`$ARGUMENTS` contains the PR number to review (optional). If not provided, reviews the current branch's PR.

```bash
/code-review 123        # Review PR #123
/code-review            # Review current branch's PR
```

## Review Process

### Step 1: Eligibility Check

First, determine if the PR should be reviewed:

```bash
# Get PR info
gh pr view --json state,isDraft,reviews
```

**Skip review if**:

- PR is closed
- PR is a draft
- PR already has a review from this agent
- PR is obviously correct (e.g., automated dependency updates)

### Step 2: Gather Project Guidelines

Read the project standards that code must comply with:

1. **CLAUDE.md** (auto-loaded) → Tech stack, commands, conventions
2. **`.specify/memory/constitution.md`** → Non-negotiable rules, principles
3. **CLAUDE.md files in modified directories** (if they exist)

### Step 3: Get PR Context

```bash
# Get PR diff
gh pr diff

# Get PR details
gh pr view --json title,body,files

# Get commit messages
gh pr view --json commits
```

### Step 4: Review Categories

Review the changes across these categories:

#### Category 1: CLAUDE.md Compliance

Audit changes against CLAUDE.md guidance:

- Are coding conventions followed?
- Are project patterns used correctly?
- Are proper tools/libraries used (shadcn/ui, Prisma, etc.)?

#### Category 2: Constitution Compliance

Check against `.specify/memory/constitution.md`:

- TypeScript strict mode compliance
- Component architecture patterns
- Testing requirements (Testing Trophy)
- Security-first design
- Database integrity rules

#### Category 3: Bug Detection

Shallow scan for obvious bugs:

- Logic errors
- Missing null checks
- Incorrect type usage
- Race conditions
- Resource leaks

#### Category 4: Historical Context

Review git blame and history:

```bash
# Check what was changed and why
git log --oneline -10 -- <modified-files>
```

- Are there patterns from previous fixes being violated?
- Are there comments explaining why code was written a certain way?

#### Category 5: Code Quality

General code quality checks:

- Clear naming
- Appropriate abstraction level
- No code duplication
- Proper error handling
- Consistent formatting

### Step 5: Confidence Scoring

For each issue found, assign a confidence score (0-100):

| Score | Meaning |
|-------|---------|
| **0-25** | Not confident. Likely false positive, pre-existing issue, or stylistic preference |
| **26-50** | Somewhat confident. Might be real but could be nitpick or false positive |
| **51-75** | Moderately confident. Real issue but may be low priority |
| **76-90** | Highly confident. Verified real issue, important to fix |
| **91-100** | Absolutely certain. Definite bug, security issue, or constitution violation |

### Step 6: Filter Results

**Remove all issues with confidence score < 80.**

Issues must be:

- Real problems in the changed code (not pre-existing)
- Actionable by the developer
- Backed by evidence (CLAUDE.md, constitution, or clear bug)

### Step 7: Post Review

Use `gh pr comment` to post the review:

```bash
gh pr comment <PR_NUMBER> --body "$(cat <<'EOF'
### Code review

Found X issues:

1. **[Issue Title]** (confidence: XX%)
   [Link to code](https://github.com/owner/repo/blob/[FULL_SHA]/path/to/file#L[start]-L[end])

   [Description of issue]

   Referenced by: [CLAUDE.md|constitution|best practice]

2. ...

---
🤖 Generated with Claude Code

- If this code review was useful, please react with 👍. Otherwise, react with 👎.
EOF
)"
```

## False Positives to Avoid

**Do NOT flag**:

- Pre-existing issues (issues in code not modified by this PR)
- Code that looks wrong but isn't (intentional patterns)
- Pedantic nitpicks senior engineers wouldn't call out
- Issues linters/typecheckers already catch (imports, types, formatting)
- General code quality issues unless explicitly mentioned in CLAUDE.md or constitution
- Issues explicitly silenced in code (lint ignores, type assertions with comments)
- Intentional functionality changes documented in the PR
- Issues on lines the user didn't modify
- Build signal or type-checking failures (CI handles these)

## Output Format

### If Issues Found

```markdown
### Code review

Found 3 issues:

1. **Missing type annotation** (confidence: 85%)
   https://github.com/owner/repo/blob/abc123/src/utils.ts#L42-L44

   Function `processData` is missing return type annotation.

   Constitution says: "All function parameters and return types explicitly typed"

2. **Potential null pointer** (confidence: 92%)
   https://github.com/owner/repo/blob/abc123/src/api/handler.ts#L18

   Accessing `user.name` without null check after optional chain.

   ```typescript
   // Line 17-19
   const user = await getUser(id);
   const name = user?.profile.name;  // profile could be undefined
   ```

3. **Using any type** (confidence: 95%)
   https://github.com/owner/repo/blob/abc123/src/types.ts#L5

   Implicit `any` type without justification comment.

   Constitution says: "No any types unless explicitly justified in code comments"

---
🤖 Generated with Claude Code

- If this code review was useful, please react with 👍. Otherwise, react with 👎.
```

### If No Issues Found

```markdown
### Code review

No issues found. Checked for:
- CLAUDE.md compliance
- Constitution compliance
- Common bugs
- Code quality

All changes look good! ✅

---
🤖 Generated with Claude Code
```

## Safety Rules

**NEVER**:

- Flag issues outside the PR's changed lines
- Post duplicate reviews
- Flag stylistic issues not in CLAUDE.md or constitution
- Block PRs for minor issues (use discretion)

**ALWAYS**:

- Read constitution and CLAUDE.md before reviewing
- Include full SHA in GitHub links
- Provide specific line numbers
- Cite the guideline being violated
- Use `gh` CLI for all GitHub operations

## Workflow Integration

This command is designed to run after PR creation in the verify workflow:

1. Tests pass → PR created
2. Code review runs → Comments posted
3. Developer addresses feedback → Merges

---

**Philosophy**: Code review should catch real issues that automated tools miss. Focus on CLAUDE.md and constitution violations, which define this project's specific standards. Avoid false positives that waste developer time.
