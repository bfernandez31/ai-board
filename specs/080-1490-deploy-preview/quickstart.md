# Quickstart: Manual Vercel Deploy Preview

**Feature**: Manual Vercel Deploy Preview
**Last Updated**: 2025-11-03
**Estimated Setup Time**: 15 minutes

## Overview

This guide helps developers set up and test the manual Vercel deploy preview feature locally and in production. You'll configure Vercel credentials, test the deployment workflow, and verify the feature end-to-end.

## Prerequisites

- Node.js 22.20.0 LTS installed
- PostgreSQL 14+ running locally
- Vercel account with project created
- GitHub repository with Actions enabled
- Admin access to repository secrets

---

## 1. Database Setup

### Apply Migration

Add the `previewUrl` field to the Ticket table:

```bash
# Development environment
npx prisma migrate dev --name add_ticket_preview_url

# Generate Prisma Client
npx prisma generate
```

**Verify Migration**:
```bash
# Check schema
npx prisma studio

# Inspect Ticket table - should have new "previewUrl" column (nullable)
```

---

## 2. Vercel Configuration

### Create Vercel Project

If not already created:

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Link project (run from repository root)
vercel link

# Note: Select existing project or create new one
```

### Retrieve Vercel Credentials

```bash
# Get Vercel Project ID
vercel project ls

# Get Vercel Organization ID
vercel teams ls

# Create Vercel Token
# Visit: https://vercel.com/account/tokens
# Create token with deployment permissions
```

**Save these values** - you'll need them for secrets configuration.

---

## 3. GitHub Secrets Configuration

### Required Secrets

Add the following secrets to your GitHub repository:

**Path**: Repository → Settings → Secrets and variables → Actions → New repository secret

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `VERCEL_TOKEN` | Vercel project token | Created at https://vercel.com/account/tokens |
| `VERCEL_ORG_ID` | Vercel organization ID | Run `vercel teams ls` |
| `VERCEL_PROJECT_ID` | Vercel project ID | Run `vercel project ls` |
| `WORKFLOW_API_TOKEN` | GitHub PAT for API calls | Existing secret (reused from AI assist feature) |

### Create Secrets via CLI (Optional)

```bash
# Install GitHub CLI
brew install gh  # macOS
# or: sudo apt install gh  # Linux

# Login
gh auth login

# Add secrets
gh secret set VERCEL_TOKEN --body "your_vercel_token_here"
gh secret set VERCEL_ORG_ID --body "your_org_id_here"
gh secret set VERCEL_PROJECT_ID --body "your_project_id_here"

# Verify secrets
gh secret list
```

---

## 4. Local Development Setup

### Environment Variables

Create or update `.env.local` (for local testing):

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/ai_board_dev"

# GitHub (for workflow dispatch testing)
WORKFLOW_API_TOKEN="ghp_your_github_pat_here"

# Vercel (for local CLI testing - optional)
VERCEL_TOKEN="your_vercel_token"
VERCEL_ORG_ID="your_org_id"
VERCEL_PROJECT_ID="your_project_id"
```

**Note**: `.env.local` is gitignored - never commit this file.

### Install Dependencies

```bash
# Install all dependencies
npm install

# Verify Vercel CLI (optional, for manual testing)
npm install -g vercel
```

---

## 5. Testing the Feature

### Unit Tests (Vitest)

Test deployment eligibility logic:

```bash
# Run unit tests
npm run test:unit tests/unit/deploy-preview-eligibility.test.ts

# Expected output: All tests pass (6 scenarios)
```

### Integration Tests (Playwright)

Test UI components and API endpoints:

```bash
# Run integration tests
npm run test:e2e tests/integration/deploy-preview/

# Tests include:
# - Deploy icon rendering
# - Confirmation modal behavior
# - Preview icon click handling
```

### E2E Tests (Playwright)

Test full deployment workflow (with mocked Vercel CLI):

```bash
# Run E2E tests
npm run test:e2e tests/e2e/deploy-preview-workflow.spec.ts

# Tests full flow:
# - User clicks deploy icon
# - Confirmation modal appears
# - Job created with PENDING status
# - Workflow dispatched (mocked)
# - Job status updated to COMPLETED (mocked)
# - Preview icon appears with clickable URL
```

**Note**: E2E tests mock the Vercel deployment to avoid rate limits and reduce test duration. Manual testing required for full integration.

---

## 6. Manual Testing (Local)

### Create Test Ticket

1. Start development server:
   ```bash
   npm run dev
   ```

2. Navigate to project board: `http://localhost:3000/projects/3/board`

3. Create a test ticket:
   - Title: "[test] Deploy Preview Feature Test"
   - Stage: VERIFY
   - Ensure ticket has a branch (e.g., "080-1490-deploy-preview")

4. Create a COMPLETED job for the ticket (via database or API):
   ```bash
   # Using Prisma Studio
   npx prisma studio

   # Or via API (POST /api/projects/3/tickets/{id}/transition)
   ```

### Test Deploy Icon

1. Refresh board - deploy icon should appear on ticket card
2. Click deploy icon - confirmation modal should appear
3. Modal should show warning: "No existing preview" (first deployment)
4. Click "Confirm" - API call triggers workflow dispatch

### Test Job Polling

1. Job should appear with PENDING status
2. Status indicator should show on ticket card (loading spinner)
3. After ~3-5 minutes (real deployment), status should update to COMPLETED
4. Preview icon should appear (clickable link)

### Test Preview Icon

1. Click preview icon - new tab should open with Vercel preview URL
2. Verify deployed application loads correctly
3. Check URL format: `https://{project-name}-{hash}.vercel.app`

### Test Single-Preview Constraint

1. Create a second test ticket in VERIFY stage with COMPLETED job
2. Click deploy icon on second ticket
3. Confirmation modal should warn: "Existing preview will be replaced"
4. Confirm deployment
5. First ticket's preview icon should disappear (previewUrl cleared)
6. Second ticket's preview icon should appear after deployment completes

---

## 7. Production Deployment

### Pre-Deployment Checklist

- [ ] All tests passing (unit + integration + E2E)
- [ ] Vercel secrets configured in GitHub repository
- [ ] Database migration applied to production
- [ ] Workflow file exists: `.github/workflows/deploy-preview.yml`
- [ ] API endpoints deployed and accessible

### Deploy to Production

```bash
# Merge feature branch to main
git checkout main
git merge 080-1490-deploy-preview
git push origin main

# Vercel auto-deploys main branch to production
```

### Apply Production Migration

```bash
# Production migration (automated in CI/CD)
npx prisma migrate deploy
```

### Verify Production Deployment

1. Navigate to production board: `https://ai-board.vercel.app/projects/{id}/board`
2. Create a production test ticket (use `[prod-test]` prefix)
3. Trigger deployment
4. Verify workflow runs successfully in GitHub Actions
5. Verify preview URL appears and is accessible
6. Clean up test ticket after verification

---

## 8. Troubleshooting

### Deploy Icon Not Appearing

**Possible Causes**:
- Ticket not in VERIFY stage
- No COMPLETED job for ticket
- Ticket has no associated branch

**Fix**:
1. Check ticket stage: Must be VERIFY
2. Check latest job status: Must be COMPLETED
3. Check ticket.branch field: Must not be null

### Workflow Dispatch Fails

**Possible Causes**:
- `WORKFLOW_API_TOKEN` missing or invalid
- GitHub API rate limit exceeded
- Workflow file not found in repository

**Fix**:
1. Verify secret exists: `gh secret list`
2. Check GitHub API rate limits: `gh api rate_limit`
3. Verify workflow file: `.github/workflows/deploy-preview.yml`

### Deployment Fails (Job Status = FAILED)

**Possible Causes**:
- Vercel secrets missing or invalid
- Branch does not exist in repository
- Build errors in application code
- Vercel API rate limit exceeded

**Fix**:
1. Check GitHub Actions logs for error details
2. Verify Vercel secrets are correct
3. Verify branch exists: `git branch -r | grep {branch-name}`
4. Fix build errors and retry deployment

### Preview URL Not Updating

**Possible Causes**:
- Workflow failed before updating preview URL
- `WORKFLOW_API_TOKEN` lacks permissions to update ticket
- API endpoint unreachable from GitHub Actions runner

**Fix**:
1. Check workflow logs for API call errors
2. Verify token has `repo` scope: `gh auth status`
3. Test API endpoint manually:
   ```bash
   curl -X PATCH \
     -H "Authorization: Bearer $WORKFLOW_API_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"previewUrl": "https://test.vercel.app"}' \
     https://ai-board.vercel.app/api/projects/1/tickets/42/preview-url
   ```

### Job Polling Not Updating UI

**Possible Causes**:
- Job polling hook disabled or not running
- Job status not updating in database
- Frontend cache stale

**Fix**:
1. Check browser console for polling errors
2. Verify job status in database: `npx prisma studio`
3. Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)

---

## 9. Rollback Procedure

If deployment causes issues in production:

### Rollback Database Migration

```bash
# Revert migration (manual SQL)
npx prisma migrate resolve --rolled-back [timestamp]_add_ticket_preview_url

# Drop column manually if needed
psql $DATABASE_URL -c "ALTER TABLE \"Ticket\" DROP COLUMN \"previewUrl\";"
```

### Rollback Code Changes

```bash
# Revert merge commit
git revert {merge-commit-hash}
git push origin main

# Vercel auto-deploys reverted code
```

### Clean Up Active Previews

```bash
# Clear all preview URLs (if needed)
psql $DATABASE_URL -c "UPDATE \"Ticket\" SET \"previewUrl\" = NULL;"
```

---

## 10. Monitoring & Observability

### Key Metrics to Monitor

- **Deployment Success Rate**: % of jobs reaching COMPLETED status
- **Deployment Duration**: Time from PENDING to COMPLETED (target: <5min)
- **Workflow Failures**: Count of FAILED jobs per day
- **API Errors**: 4xx/5xx responses on deploy endpoints

### Logging

**Backend Logs** (Vercel):
- API endpoint calls: POST /api/projects/.../deploy
- Workflow dispatch results: Success/failure
- Job status updates: PENDING → RUNNING → COMPLETED/FAILED

**GitHub Actions Logs**:
- Workflow execution steps
- Vercel CLI output
- API call responses

### Alerts (Future Enhancement)

Set up alerts for:
- Deployment failure rate >10%
- Workflow timeout frequency
- Vercel API rate limit approaching
- Job status update failures

---

## 11. Next Steps

After successful setup:

1. **Test edge cases**:
   - Deploy with no existing previews
   - Deploy when another preview is active
   - Cancel deployment mid-workflow (if possible)
   - Retry failed deployment

2. **Document workflows** for team:
   - When to use deploy preview (VERIFY stage only)
   - Single-preview constraint explanation
   - How to interpret job status indicators

3. **Consider enhancements** (out of MVP scope):
   - Preview URL verification (health check)
   - Manual preview deletion button
   - Deployment history tracking
   - Multi-preview support with environment labels

---

## 12. Additional Resources

- **Vercel CLI Docs**: https://vercel.com/docs/cli
- **GitHub Actions Docs**: https://docs.github.com/en/actions
- **Prisma Migrations**: https://www.prisma.io/docs/concepts/components/prisma-migrate
- **TanStack Query (React Query)**: https://tanstack.com/query/latest/docs/framework/react/overview
- **Project Constitution**: `/CLAUDE.md` (development guidelines)

---

## Support

For issues or questions:
- **GitHub Issues**: https://github.com/bfernandez31/ai-board/issues
- **Internal Docs**: `/specs/080-1490-deploy-preview/`
- **Team Chat**: [Your team's communication channel]
