# Quickstart Guide: GitHub Actions Spec-Kit Workflow

**Feature**: 016-create-github-actions
**Date**: 2025-10-09
**Purpose**: Manual testing and validation procedures for the spec-kit workflow

## Prerequisites

### Required Secrets
Before running the workflow, ensure these GitHub Secrets are configured:

1. **ANTHROPIC_API_KEY** (required)
   - Navigate to: Repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `ANTHROPIC_API_KEY`
   - Value: Your Anthropic API key from https://console.anthropic.com

2. **GITHUB_TOKEN** (automatic)
   - Automatically provided by GitHub Actions
   - No setup required

### Verify Workflow File Exists
Check that `.github/workflows/speckit.yml` exists in the repository.

---

## Testing Workflow: Complete Cycle

### Test 1: Specify Command (New Feature)

**Objective**: Create a new feature specification

**Steps**:
1. Navigate to: **Actions** tab → **Spec-Kit Workflow Execution** → **Run workflow**
2. Fill in inputs:
   - **ticket_id**: `TEST-001`
   - **ticketTitle**: `Test Authentication Feature`
   - **ticketDescription**: `Add user authentication with email and password. Include login, logout, and password reset functionality.`
   - **branch**: (leave empty)
   - **command**: `specify`
   - **answers_json**: (leave empty)
3. Click **Run workflow**

**Expected Results**:
- ✅ Workflow completes successfully
- ✅ New branch created: `TEST-001-test-authentication` (or similar)
- ✅ File created: `specs/TEST-001-*/spec.md`
- ✅ Commit author: `ai-board[bot] <bot@ai-board.app>`
- ✅ Commit message: `feat(ticket-TEST-001): specify - automated spec-kit execution`
- ✅ Log shows: `✅ Spec-kit command 'specify' completed successfully`

**Verification**:
```bash
# Check branch was created
git fetch
git branch -r | grep TEST-001

# Check commit author
git log origin/TEST-001-* -1 --format='%an %ae'
# Expected: ai-board[bot] bot@ai-board.app

# Check file exists
ls specs/TEST-001-*/spec.md
```

---

### Test 2: Plan Command (Existing Feature)

**Objective**: Generate implementation plan for existing specification

**Prerequisites**: Test 1 completed successfully

**Steps**:
1. Navigate to: **Actions** tab → **Spec-Kit Workflow Execution** → **Run workflow**
2. Fill in inputs:
   - **ticket_id**: `TEST-001`
   - **ticketTitle**: `Test Authentication Feature`
   - **ticketDescription**: `Add user authentication with email and password.`
   - **branch**: `TEST-001-test-authentication` (from Test 1)
   - **command**: `plan`
   - **answers_json**: (leave empty)
3. Click **Run workflow**

**Expected Results**:
- ✅ Workflow completes successfully
- ✅ Files created in `specs/TEST-001-*/`:
  - `plan.md`
  - `research.md`
  - `data-model.md`
  - `quickstart.md`
  - `contracts/*.yml`
- ✅ Commit message: `feat(ticket-TEST-001): plan - automated spec-kit execution`
- ✅ All files committed to existing branch

**Verification**:
```bash
# Check all plan artifacts exist
ls specs/TEST-001-*/{plan,research,data-model,quickstart}.md
ls specs/TEST-001-*/contracts/

# Check commit count (should be 2: specify + plan)
git log origin/TEST-001-* --oneline | wc -l
```

---

### Test 3: Task Command (Task Generation)

**Objective**: Generate tasks from implementation plan

**Prerequisites**: Test 2 completed successfully

**Steps**:
1. Navigate to: **Actions** tab → **Spec-Kit Workflow Execution** → **Run workflow**
2. Fill in inputs:
   - **ticket_id**: `TEST-001`
   - **branch**: `TEST-001-test-authentication`
   - **command**: `task`
3. Click **Run workflow**

**Expected Results**:
- ✅ Workflow completes successfully
- ✅ File created: `specs/TEST-001-*/tasks.md`
- ✅ Commit message: `feat(ticket-TEST-001): task - automated spec-kit execution`
- ✅ Tasks numbered and ordered correctly

**Verification**:
```bash
# Check tasks.md exists
cat specs/TEST-001-*/tasks.md

# Verify task structure (numbered list)
grep -E "^T[0-9]+" specs/TEST-001-*/tasks.md
```

---

### Test 4: Implement Command (Code Generation)

**Objective**: Execute implementation tasks

**Prerequisites**: Test 3 completed successfully

**Steps**:
1. Navigate to: **Actions** tab → **Spec-Kit Workflow Execution** → **Run workflow**
2. Fill in inputs:
   - **ticket_id**: `TEST-001`
   - **branch**: `TEST-001-test-authentication`
   - **command**: `implement`
3. Click **Run workflow**

**Expected Results**:
- ✅ Workflow completes successfully
- ✅ Implementation files created (location varies by project)
- ✅ Commit message: `feat(ticket-TEST-001): implement - automated spec-kit execution`

**Verification**:
```bash
# Check for implementation files (examples)
ls app/api/auth/
ls lib/auth/
ls components/auth/

# Check commit diff
git diff origin/TEST-001-*~1 origin/TEST-001-*
```

---

### Test 5: Clarify Command (Specification Update)

**Objective**: Update specification with clarifications

**Prerequisites**: Test 1 completed (can run before or after plan)

**Steps**:
1. Navigate to: **Actions** tab → **Spec-Kit Workflow Execution** → **Run workflow**
2. Fill in inputs:
   - **ticket_id**: `TEST-001`
   - **branch**: `TEST-001-test-authentication`
   - **command**: `clarify`
   - **answers_json**:
     ```json
     {
       "auth_method": "email/password with bcrypt hashing",
       "session_duration": "7 days",
       "password_requirements": "min 8 chars, 1 uppercase, 1 number"
     }
     ```
3. Click **Run workflow**

**Expected Results**:
- ✅ Workflow completes successfully
- ✅ Files created/updated:
  - `clarifications.json` (new)
  - `specs/TEST-001-*/spec.md` (updated with clarifications)
- ✅ Commit message: `feat(ticket-TEST-001): clarify - automated spec-kit execution`

**Verification**:
```bash
# Check clarifications.json exists
cat clarifications.json

# Check spec.md updated
git diff origin/TEST-001-*~1:specs/TEST-001-*/spec.md origin/TEST-001-*:specs/TEST-001-*/spec.md
```

---

## Error Scenario Testing

### Test 6: Missing Branch Error

**Objective**: Verify error handling when branch not provided for non-specify command

**Steps**:
1. Run workflow with:
   - **command**: `plan`
   - **branch**: (leave empty)
2. Click **Run workflow**

**Expected Results**:
- ❌ Workflow fails
- ❌ Exit code: 1
- ❌ Log shows: Branch-related error message

---

### Test 7: Invalid API Key Error

**Objective**: Verify error handling for missing/invalid ANTHROPIC_API_KEY

**Steps**:
1. Temporarily remove or rename `ANTHROPIC_API_KEY` secret
2. Run workflow with any command
3. Click **Run workflow**

**Expected Results**:
- ❌ Workflow fails
- ❌ Exit code: 1
- ❌ Log shows: Authentication error
- ❌ Secret value NOT exposed in logs

**Cleanup**: Restore ANTHROPIC_API_KEY secret

---

### Test 8: No Changes Scenario

**Objective**: Verify workflow handles re-running same command without changes

**Steps**:
1. Run `plan` command twice on same branch without modifications
2. Second run should detect no changes

**Expected Results**:
- ✅ Workflow completes successfully
- ✅ Exit code: 0
- ✅ No new commit created
- ✅ Log shows: `✅ No changes to commit`

**Verification**:
```bash
# Commit count should be unchanged
git log origin/TEST-001-* --oneline | wc -l
```

---

### Test 9: Git Push Conflict Error

**Objective**: Verify error handling for diverged branches

**Steps**:
1. Locally modify and push to feature branch
2. Trigger workflow on same branch (creates conflict)

**Expected Results**:
- ❌ Workflow fails during push step
- ❌ Exit code: 1
- ❌ Log shows: Git push conflict error

**Resolution**: User must pull changes and re-run workflow

---

## Validation Checklist

After completing all tests, verify:

- [ ] All 5 commands (specify, plan, task, implement, clarify) execute successfully
- [ ] Commits have correct author: `ai-board[bot] <bot@ai-board.app>`
- [ ] Commit messages follow conventional format: `feat(ticket-<id>): <command> - automated spec-kit execution`
- [ ] Secrets not exposed in any workflow logs
- [ ] Error scenarios produce clear, actionable error messages
- [ ] No empty commits created when no changes exist
- [ ] Branch creation works correctly for specify command
- [ ] File artifacts generated in correct locations
- [ ] GitHub Actions logs visible and readable
- [ ] Workflow timeout set to 120 minutes

---

## Troubleshooting

### Workflow Not Visible in Actions Tab

**Problem**: Workflow doesn't appear in GitHub Actions

**Solution**:
1. Check `.github/workflows/speckit.yml` exists in main branch
2. Ensure YAML syntax is valid (use YAML linter)
3. Verify workflow has `workflow_dispatch` trigger
4. Push workflow file to main branch

---

### Secret Not Found Error

**Problem**: ANTHROPIC_API_KEY not recognized

**Solution**:
1. Navigate to: Settings → Secrets and variables → Actions
2. Verify secret name is exactly `ANTHROPIC_API_KEY` (case-sensitive)
3. Click "Update" to re-enter secret value
4. Re-run workflow

---

### Branch Not Found Error

**Problem**: `git checkout` fails for non-specify commands

**Solution**:
1. Verify branch exists: `git branch -r | grep <branch-name>`
2. Run `specify` command first to create branch
3. Use exact branch name from specify output
4. Check for typos in branch input field

---

### Claude CLI Command Fails

**Problem**: `claude` command not found or fails

**Solution**:
1. Check Node.js setup step succeeded
2. Verify npm install command ran: `npm install -g @anthropic-ai/claude-code`
3. Check ANTHROPIC_API_KEY is valid
4. Review Claude CLI logs in workflow output

---

### No Changes to Commit (Unexpected)

**Problem**: Expected changes but workflow reports "no changes"

**Solution**:
1. Check Claude CLI actually generated files (review logs)
2. Verify files written to repository, not temp directory
3. Check `.gitignore` not excluding generated files
4. Review `git status` output in workflow logs

---

## Performance Benchmarks

**Expected Execution Times**:
- **specify**: 2-5 minutes (includes branch creation)
- **plan**: 5-10 minutes (multiple artifact generation)
- **task**: 3-7 minutes (task breakdown)
- **implement**: 10-30 minutes (depends on complexity)
- **clarify**: 2-5 minutes (spec update)

**Timeout Threshold**: 120 minutes (2 hours)

---

## Cleanup

After testing, clean up test artifacts:

```bash
# Delete test branch
git push origin --delete TEST-001-test-authentication

# Remove local test branch
git branch -D TEST-001-test-authentication

# Remove test spec files (optional)
rm -rf specs/TEST-001-*
```

---

## Next Steps

After successful testing:

1. **Create Real Tickets**: Use workflow with actual project tickets
2. **Monitor Usage**: Track workflow execution metrics in Actions tab
3. **Refine Inputs**: Adjust ticket descriptions for better spec quality
4. **Iterate**: Use clarify command to refine specifications
5. **Automate**: Consider triggering workflow from external systems (future)

---

**Status**: Quickstart guide complete, ready for manual testing
