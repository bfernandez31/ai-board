# AI Board - Development Guide

## Quick Start

### Development Environment Setup

1. **Create the development project (one-time setup):**
   ```bash
   npx tsx scripts/create-dev-project.ts
   ```

   This creates Project 3 with:
   - Name: "AI Board Development"
   - GitHub: `bfernandez31/ai-board`
   - Persistent data (not affected by test cleanup)

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Access your development board:**
   ```
   http://localhost:3000/projects/3/board
   ```

   **⚠️ Important:** Always use **Project 3** for development, not projects 1-2 (reserved for tests).

4. **Create tickets and test features:**
   - All tickets created in Project 3 will be saved permanently
   - GitHub Actions workflows will dispatch to `bfernandez31/ai-board`
   - Your data won't be affected by test runs

## Project Structure

### Database Projects

| Project ID | Name | Purpose | Data Persistence |
|------------|------|---------|-----------------|
| 1 | [e2e] Test Project | E2E tests | ❌ Auto-cleaned |
| 2 | [e2e] Test Project 2 | Cross-project tests | ❌ Auto-cleaned |
| 3 | AI Board Development | **Your development** | ✅ Persistent |
| 4+ | Available | Future use | ✅ Persistent |

### Test vs Development

#### Test Environment (Projects 1-2)
- **Purpose:** E2E automated testing
- **GitHub:** `test/test` (placeholder)
- **Cleanup:** All data deleted before each test run
- **Usage:** Never use manually

#### Development Environment (Project 3+)
- **Purpose:** Manual development and testing
- **GitHub:** `bfernandez31/ai-board` (your real repo)
- **Cleanup:** Data is preserved
- **Usage:** Default for all development work

## Common Tasks

### Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test drag-drop

# Run tests in UI mode (visual debugging)
npm run test:e2e:ui
```

**Note:** Tests use projects 1-2 automatically and won't affect your dev data in project 3.

### Database Management

```bash
# Create/update development project
npx tsx scripts/create-dev-project.ts

# Open Prisma Studio (database GUI)
npx prisma studio

# Reset database (⚠️ deletes all data)
npx prisma migrate reset

# Run migrations
npx prisma migrate dev
```

### GitHub Actions Integration

When you drag a ticket from INBOX → SPECIFY in Project 3:

1. ✅ Creates Job with PENDING status
2. ✅ Dispatches GitHub Actions workflow to `bfernandez31/ai-board`
3. ✅ Workflow runs `/specify` command
4. ✅ Updates ticket branch field with created branch
5. ✅ SSE broadcasts job status in real-time

**Prerequisites:**
- `GITHUB_TOKEN` environment variable set in `.env`
- Valid GitHub token with `workflow` permissions
- Repository has `.github/workflows/speckit.yml` workflow file

## Troubleshooting

### Issue: "Ticket moved back to INBOX after drag"

**Cause:** GitHub workflow dispatch failed (404 error)

**Solutions:**
1. Check `GITHUB_TOKEN` is set in `.env`:
   ```bash
   GITHUB_TOKEN=ghp_your_token_here
   ```

2. Verify token has `workflow` scope:
   - Go to GitHub → Settings → Developer settings → Personal access tokens
   - Token should have `workflow` permission checked

3. Ensure `speckit.yml` workflow exists in `.github/workflows/`

4. **For testing without GitHub:** Set placeholder token:
   ```bash
   GITHUB_TOKEN=test_placeholder_token
   ```
   This will skip GitHub API calls but still create Jobs.

### Issue: "Test data disappeared"

**Cause:** Using projects 1-2 instead of project 3

**Solution:** Always use `http://localhost:3000/projects/3/board` for development

### Issue: "Project 3 doesn't exist / 404 error"

**Cause:** Development project was never created or database was reset

**Solution:** Run the create-dev-project script:
```bash
npx tsx scripts/create-dev-project.ts
```

This is a one-time setup that persists across test runs.

### Issue: "SSE connection timeout in tests"

**Cause:** SSE endpoint not mocked in test

**Solution:** Already fixed in drag-drop tests. For new tests, add:
```typescript
test.beforeEach(async ({ page }) => {
  await page.route('**/api/sse**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: '',
    });
  });
});
```

## Environment Variables

Required `.env` file:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/aiboard"

# GitHub Integration (optional for testing)
GITHUB_TOKEN="ghp_your_token_here"

# Test Mode (set to disable GitHub API calls)
NODE_ENV="development"  # or "test"
```

## Best Practices

1. ✅ **Always use Project 3** for development
2. ✅ **Prefix test data** with `[e2e]` if creating in other projects
3. ✅ **Run tests before commits** to ensure no regressions
4. ✅ **Use real GitHub token** for workflow testing
5. ❌ **Never manually modify** projects 1-2
6. ❌ **Never commit** `.env` file with real tokens

## Architecture Notes

### Real-Time Updates (SSE)

- Board establishes SSE connection on load
- Job status updates broadcast to all connected clients
- Updates appear within 200ms (target)
- EventSource handles reconnection automatically

### Optimistic Updates

- Drag operations update UI immediately
- Server validates and may rollback on conflict
- Version field prevents concurrent update issues
- First-write-wins conflict resolution

### GitHub Workflow Integration

- Transition to automated stages (SPECIFY, PLAN, BUILD) creates Job
- Job dispatch happens asynchronously
- Workflow updates ticket via API when complete
- Branch name stored in ticket for tracking

## Additional Resources

- [E2E Test Guidelines](CLAUDE.md#e2e-test-data-isolation)
- [Scripts Documentation](scripts/README.md)
- [Data Model Notes](CLAUDE.md#data-model-notes)
