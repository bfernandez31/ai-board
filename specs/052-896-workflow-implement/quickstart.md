# Quickstart: Enhanced Implementation Workflow

**Feature**: Database Setup and Selective Testing for `/speckit.implement` Command
**Date**: 2025-10-25
**Branch**: 052-896-workflow-implement

---

## Overview

This guide explains how to use the enhanced `/speckit.implement` workflow with automatic database and Playwright setup, and selective test execution.

**Key Enhancements**:
- 🗄️ **PostgreSQL Auto-Setup**: Database service configured automatically in CI
- 🎭 **Playwright Auto-Install**: Browser dependencies cached and installed
- 🧪 **Selective Testing**: Claude runs only impacted tests (50%+ time savings)
- 🤖 **Zero User Input**: Fully autonomous implementation execution

---

## Prerequisites

### Repository Setup (One-Time)

**Required Secrets** (already configured):
```bash
CLAUDE_CODE_OAUTH_TOKEN  # Claude Code CLI authentication
WORKFLOW_API_TOKEN       # API access for job status updates
```

**Required Variables** (already configured):
```bash
APP_URL                  # Application URL (e.g., http://localhost:3000)
```

### Local Development

**No Local Changes Required**: This feature is workflow-only, affects GitHub Actions execution.

---

## Quick Start (5-Minute Guide)

### Step 1: Create Feature Ticket

1. Navigate to project board: http://localhost:3000/projects/1/board
2. Click "Add Ticket" in INBOX column
3. Fill in ticket details:
   - **Title**: "Add ticket priority field"
   - **Description**: "Add priority field (low/medium/high/urgent) to tickets for better task management"

### Step 2: Trigger Workflow (INBOX → BUILD)

**Option A: Via UI** (Normal Workflow)
1. Drag ticket from INBOX → SPECIFY (generates spec)
2. Wait for Job completion (~2 minutes)
3. Drag ticket from SPECIFY → PLAN (generates plan + tasks)
4. Wait for Job completion (~3 minutes)
5. Drag ticket from PLAN → BUILD (triggers implementation)
   - **NEW**: Database + Playwright automatically configured
   - **NEW**: Claude runs only impacted tests

**Option B: Via UI** (Quick Implementation)
1. Drag ticket from INBOX → BUILD (skips spec/plan)
2. Confirm quick-impl modal (green warning)
   - **NEW**: Database + Playwright automatically configured
   - **NEW**: Claude runs only impacted tests

**Option C: Via API** (Manual Dispatch)
```bash
curl -X POST "https://api.github.com/repos/OWNER/REPO/actions/workflows/speckit.yml/dispatches" \
  -H "Authorization: token ${GITHUB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "ref": "main",
    "inputs": {
      "ticket_id": "123",
      "command": "implement",
      "branch": "123-ticket-priority"
    }
  }'
```

### Step 3: Monitor Workflow Progress

**GitHub Actions UI**:
1. Go to repository → Actions tab
2. Find workflow run: "Spec-Kit Workflow Execution"
3. Click run to see live logs

**Expected Steps** (implement command):
```
✅ Checkout repository
✅ Setup Bun/Node/Python
✅ Install Claude Code CLI
✅ Cache Bun dependencies (10s)
✅ Install dependencies (cached)
✅ Setup PostgreSQL service (30s)
✅ Cache Playwright browsers (hit: 45s, miss: 3.5min)
✅ Install Playwright
✅ Generate Prisma Client (30s)
✅ Apply database migrations (1min)
✅ Seed test database (30s)
✅ Execute /speckit.implement with selective testing (5-10min)
✅ Commit and push changes
✅ Update job status to COMPLETED
```

**Total Time**:
- Cold start (no cache): ~15-20 minutes
- Warm start (with cache): ~10-15 minutes

### Step 4: Review Implementation

**Check Feature Branch**:
```bash
git fetch origin
git checkout 123-ticket-priority
git log -1 --stat  # See what Claude implemented
```

**Check Selective Tests**:
```bash
# Review workflow logs for test execution
# Look for "Test Selection Summary" in Claude's output
# Verify only impacted tests ran (not full suite)
```

**Verify Job Status**:
- Ticket card shows "✅ COMPLETED" badge
- Job polling updates board in real-time

---

## Workflow Trigger Scenarios

### Scenario 1: Feature with Database Changes

**Ticket**: "Add priority field to tickets"

**Expected Workflow**:
1. PostgreSQL service starts
2. Migrations applied (including new priority field migration)
3. Database seeded with test fixtures
4. Claude implements feature (API + UI)
5. **Selective Tests Run**:
   - `tests/api/tickets.spec.ts` (API contract tests)
   - `tests/e2e/board-ticket-display.spec.ts` (UI integration)

**Test Selection Rationale**:
- Database schema change affects ticket API and display
- No need to run unrelated tests (board drag-drop, job polling, etc.)

---

### Scenario 2: UI-Only Component Change

**Ticket**: "Add hover effect to ticket cards"

**Expected Workflow**:
1. PostgreSQL service starts (required for E2E tests)
2. Migrations applied
3. Database seeded
4. Claude implements CSS changes
5. **Selective Tests Run**:
   - `tests/e2e/board-ticket-display.spec.ts` (UI visual tests)

**Test Selection Rationale**:
- No API changes → skip API tests
- No database changes → skip migration tests
- Only visual component change → run E2E tests for ticket cards

---

### Scenario 3: Utility Function Addition

**Ticket**: "Add date formatting helper function"

**Expected Workflow**:
1. PostgreSQL service starts (for integration tests)
2. Claude implements utility function in `lib/utils/date-format.ts`
3. Claude writes unit tests in `tests/unit/date-format.test.ts`
4. **Selective Tests Run**:
   - `bun run test:unit tests/unit/date-format.test.ts` (Vitest ~1ms/test)
   - `tests/integration/ticket-display.spec.ts` (if tickets use date formatting)

**Test Selection Rationale**:
- Pure utility function → unit tests (fast feedback)
- Integration tests only if utility used in existing features

---

## Debugging Common Issues

### Issue 1: PostgreSQL Service Fails to Start

**Symptoms**:
```
❌ PostgreSQL service failed to start
Error: pg_isready command failed
```

**Diagnosis**:
1. Check workflow logs for PostgreSQL service health checks
2. Verify service container configuration in `.github/workflows/speckit.yml`

**Resolution**:
```yaml
# Ensure service container has correct image and health checks
services:
  postgres:
    image: postgres:14  # ← Version 14 or higher
    options: >-
      --health-cmd pg_isready  # ← Health check command
      --health-retries 5       # ← Retry count
```

**Workaround**: Increase health check retries to 10 (slower startup on GitHub runners)

---

### Issue 2: Playwright Installation Timeout

**Symptoms**:
```
❌ Error: Playwright installation timed out after 10 minutes
```

**Diagnosis**:
1. Check if cache was used (cache hit logs)
2. Verify Playwright version extraction step succeeded

**Resolution**:
```yaml
# Split browser installation from OS dependencies
- name: Install Playwright browsers
  if: steps.playwright-cache.outputs.cache-hit != 'true'
  run: npx playwright install chromium  # ← Install only Chromium (faster)

- name: Install Playwright OS dependencies
  run: npx playwright install-deps chromium
```

**Workaround**: Use Playwright Docker image (faster but loses CLI tools)

---

### Issue 3: Migrations Fail to Apply

**Symptoms**:
```
❌ Error: Migration failed
Migration 'add_priority_field' failed: column "priority" already exists
```

**Diagnosis**:
1. Check if database was cleaned between runs
2. Verify migration files are in correct order

**Resolution**:
```bash
# Database is ephemeral in CI, should always be clean
# If migration fails, check migration SQL for errors

# Locally test migration:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_board_test" \
  npx prisma migrate deploy
```

**Workaround**: Reset migrations locally and regenerate

---

### Issue 4: Full Test Suite Runs (Not Selective)

**Symptoms**:
```
🧪 Running all tests...
$ bun run test  # ← Should not happen
```

**Diagnosis**:
1. Check Claude instruction in workflow logs
2. Verify instruction includes "only impacted tests"

**Resolution**:
```yaml
# Ensure enhanced instruction is passed correctly
- name: Execute Spec-Kit Command
  run: |
    case "${{ inputs.command }}" in
      implement)
        claude --dangerously-skip-permissions "/speckit.implement IMPORTANT: never prompt me; you must do the full implementation, never run the full test suite, only impacted tests"
        ;;
    esac
```

**Workaround**: Manually trigger workflow with correct instruction

---

### Issue 5: Test Fixtures Missing

**Symptoms**:
```
❌ Error: User test@e2e.local not found
❌ Error: Project 1 not found
```

**Diagnosis**:
1. Check if seeding step completed successfully
2. Verify `tests/global-setup.ts` is called

**Resolution**:
```yaml
# Ensure seeding step runs after migrations
- name: Seed test database
  if: ${{ inputs.command == 'implement' }}
  run: npx tsx tests/global-setup.ts
  env:
    DATABASE_URL: ${{ env.DATABASE_URL }}
```

**Workaround**: Add explicit fixture creation in workflow step

---

## Performance Optimization Tips

### Tip 1: Maximize Cache Hits

**Cache Keys**:
- Bun dependencies: `${{ runner.os }}-bun-${{ hashFiles('bun.lockb') }}`
- Playwright browsers: `${{ runner.os }}-playwright-${{ steps.playwright-version.outputs.version }}`

**Best Practices**:
- Don't update dependencies unnecessarily (invalidates cache)
- Pin Playwright version in package.json (stable cache key)
- Run workflows frequently to keep cache warm (7-day expiration)

**Expected Cache Hit Rates**:
- Bun dependencies: 95%+ (lockfile rarely changes)
- Playwright browsers: 90%+ (version pinned)

---

### Tip 2: Reduce Database Seeding Time

**Current Seeding Time**: ~30 seconds

**Optimization**:
```typescript
// In tests/global-setup.ts
// Only create minimal fixtures (test user + projects 1-2)
// Avoid creating unnecessary test data (tickets, jobs)
```

**Why Minimal Fixtures**:
- Faster seeding → faster workflow
- Tests create own data as needed (better isolation)

---

### Tip 3: Selective Test Execution

**Current Test Suite**:
- Full suite: ~10 minutes (50+ tests)
- Selective: ~2-3 minutes (5-10 tests)

**Best Practices for Claude**:
- Identify changed files explicitly
- Map files to test files using heuristics
- Run unit tests before E2E (faster feedback)
- Log test selection rationale

**Example Log**:
```
🧪 Changed Files:
   - app/api/tickets/route.ts
   - lib/schemas/ticket.ts

🧪 Selected Tests:
   - tests/api/tickets.spec.ts

🧪 Rationale: API changes require contract validation

✅ 12 tests passed (1.2s)
```

---

## Advanced Usage

### Manual Workflow Dispatch (CLI)

**Using GitHub CLI**:
```bash
gh workflow run speckit.yml \
  -f ticket_id=123 \
  -f command=implement \
  -f branch=123-ticket-priority \
  -f job_id=456
```

**Using curl**:
```bash
curl -X POST \
  -H "Authorization: token ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/OWNER/REPO/actions/workflows/speckit.yml/dispatches \
  -d '{
    "ref": "main",
    "inputs": {
      "ticket_id": "123",
      "command": "implement",
      "branch": "123-ticket-priority",
      "job_id": "456"
    }
  }'
```

---

### Environment Variable Overrides

**Disable Selective Testing** (debug):
```yaml
# In workflow file (temporary debugging only)
env:
  FORCE_FULL_TEST_SUITE: true  # Claude instruction ignores this, manual override needed
```

**Custom Database Name**:
```yaml
# Default: ai_board_test
# Override in service container:
services:
  postgres:
    env:
      POSTGRES_DB: custom_test_db
```

---

### Local Testing (Before Pushing)

**Simulate Workflow Environment**:
```bash
# Start PostgreSQL locally
docker run -d --name test-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ai_board_test \
  -p 5432:5432 \
  postgres:14

# Set DATABASE_URL
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_board_test"

# Run migrations
npx prisma migrate deploy

# Seed database
npx tsx tests/global-setup.ts

# Run selective tests
bun run test:e2e tests/api/tickets.spec.ts
```

---

## Workflow Monitoring

### Real-Time Status Updates

**Job Polling**:
- Frontend polls `/api/projects/:projectId/jobs/status` every 2 seconds
- Job status updates: PENDING → RUNNING → COMPLETED/FAILED
- Ticket card shows live status badge

**Workflow Logs**:
- GitHub Actions UI shows live logs during execution
- Search logs for "🧪 Test Selection Summary" to see which tests ran

---

### Success Metrics

**Workflow Execution**:
- ✅ Total time <10 minutes (infrastructure only, excluding Claude)
- ✅ Cache hit rate >80% (Bun + Playwright)
- ✅ Selective tests reduce execution time by 50%+

**Implementation Quality**:
- ✅ All selective tests pass before commit
- ✅ No user prompts during execution
- ✅ Feature branch committed and pushed

**Test Coverage**:
- ✅ Impacted tests identified correctly
- ✅ No critical regressions escape selective testing
- ✅ Full test suite runs on PR validation (safety net)

---

## Next Steps

### After Implementation Completes

1. **Review Feature Branch**:
   ```bash
   git checkout 123-ticket-priority
   git log --oneline -5  # See Claude's commits
   ```

2. **Verify Tests Locally**:
   ```bash
   bun run test:e2e tests/api/tickets.spec.ts
   ```

3. **Create Pull Request**:
   ```bash
   gh pr create --title "Add ticket priority field" --body "Implemented via /speckit.implement workflow"
   ```

4. **Validate with Full Test Suite**:
   - PR triggers full test suite in CI
   - Ensures no regressions from selective testing

5. **Merge to Main**:
   - After PR approval and full test suite passes
   - Deploys to production via Vercel

---

## Troubleshooting Resources

### Documentation
- Feature Spec: `specs/052-896-workflow-implement/spec.md`
- Research Notes: `specs/052-896-workflow-implement/research.md`
- Data Model: `specs/052-896-workflow-implement/data-model.md`
- Contracts: `specs/052-896-workflow-implement/contracts/`

### Support Channels
- GitHub Issues: https://github.com/OWNER/REPO/issues
- Workflow Runs: https://github.com/OWNER/REPO/actions
- Project Board: http://localhost:3000/projects/1/board

---

**Quickstart Version**: 1.0
**Last Updated**: 2025-10-25
**Maintainer**: AI Board Development Team
