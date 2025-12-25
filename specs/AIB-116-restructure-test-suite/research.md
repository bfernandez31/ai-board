# Research: Testing Trophy Migration

**Feature**: AIB-116-restructure-test-suite
**Date**: 2025-12-24

## Research Areas

### 1. VITEST_POOL_ID Availability

**Decision**: Use `globalSetup` function's `config.workerId` parameter and store in environment variable

**Rationale**:
- Vitest does NOT expose `VITEST_POOL_ID` as a standard environment variable like Playwright's `workerIndex`
- The `globalSetup` function receives `{ config, workerId }` as a parameter
- Each worker has a unique 0-based `workerId` that can be stored in `process.env`

**Alternatives Considered**:
1. **Custom reporter approach** - Rejected: More complex, requires custom reporter setup
2. **File-based storage (like Playwright's `.test-worker-id`)** - Viable fallback if env vars fail in thread pool
3. **`process.env.VITEST_WORKER_THREADS`** - Rejected: Not guaranteed to be set

**Implementation Pattern**:
```typescript
// In global setup (receives config.workerId):
export default async function setup({ workerId }) {
  const projectMapping = [1, 2, 4, 5, 6, 7];
  const projectId = projectMapping[workerId] ?? projectMapping[0];
  process.env.TEST_PROJECT_ID = String(projectId);
}
```

---

### 2. Vitest API Testing Patterns

**Decision**: Use native `fetch` with custom API client wrapper; reuse existing Next.js dev server

**Rationale**:
- Native `fetch` is lighter than `supertest` and requires no additional dependency
- Current Playwright tests already prove the `x-test-user-id` header pattern works
- Reusing the dev server eliminates ~120s startup overhead

**Alternatives Considered**:
1. **supertest** - Rejected: Additional dependency, no significant benefit over native fetch
2. **Start server in global setup** - Viable for CI: `child_process.spawn()` + health check
3. **next/experimental/testing** - Not mature enough for production use

**API Client Pattern**:
```typescript
// tests/fixtures/vitest/api-client.ts
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_USER_ID = process.env.TEST_USER_ID || 'test-user-id';

export async function apiRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-test-user-id': TEST_USER_ID,
      ...options.headers,
    },
  });
  return response;
}
```

---

### 3. Worker Isolation in Vitest

**Decision**: Mirror Playwright's mapping pattern using environment variable set in global setup

**Rationale**:
- Vitest runs tests in worker threads (similar to Playwright workers)
- The global setup function receives `workerId` (0-based index)
- Mapping to projects [1, 2, 4, 5, 6, 7] skips project 3 (reserved for development)

**Alternatives Considered**:
1. **File-based storage** - Viable fallback: Write `.test-worker-project-id` file per worker
2. **Global context injection** - Rejected: Vitest test context doesn't expose workerId directly
3. **Custom test fixture** - Possible but adds complexity vs simple env var

**Key Constraint**: Vitest worker threads share memory differently than Playwright. Environment variable approach is simpler but file-based fallback should be available if issues arise.

---

### 4. Vitest Configuration for Integration Tests

**Decision**: Single config file with environment-based profiles (Option A)

**Rationale**:
- Simpler maintenance with one config file
- `VITEST_INTEGRATION` env var toggles between unit and integration modes
- Different `environment` settings: `happy-dom` for unit, `node` for integration

**Alternatives Considered**:
1. **Separate config files** (vitest.config.unit.ts, vitest.config.integration.ts) - Rejected: Duplication, harder to maintain
2. **Workspace configuration** - Rejected: Overkill for two test types

**Configuration Pattern**:
```typescript
// vitest.config.mts
export default defineConfig({
  test: {
    globals: true,
    environment: process.env.VITEST_INTEGRATION ? 'node' : 'happy-dom',
    include: process.env.VITEST_INTEGRATION
      ? ['tests/integration/**/*.test.ts']
      : ['tests/unit/**/*.test.ts'],
    setupFiles: process.env.VITEST_INTEGRATION
      ? ['./tests/fixtures/vitest/setup.ts']
      : [],
    globalSetup: process.env.VITEST_INTEGRATION
      ? './tests/fixtures/vitest/global-setup.ts'
      : undefined,
  },
});
```

**Package.json Scripts**:
```json
{
  "test:unit": "vitest run",
  "test:integration": "VITEST_INTEGRATION=1 vitest run",
  "test": "bun run test:unit && bun run test:integration && bun run test:e2e"
}
```

---

### 5. E2E Test Retention Analysis

**Decision**: Keep only browser-required tests in Playwright E2E suite

**Browser-Required Categories** (KEEP in Playwright):
1. **OAuth flows** - Require browser for redirects and session cookies
2. **Drag-drop (DnD Kit)** - Require real DOM events and pointer interactions
3. **Viewport testing** - Require browser window sizing
4. **Keyboard navigation** - Require real focus management
5. **Visual state (cleanup banner)** - Require CSS rendering verification

**Migrate to Vitest Integration** (DELETE from Playwright):
1. **API contract tests** - Pure HTTP, no browser needed
2. **Database constraint tests** - Prisma-only, no HTTP/browser
3. **Job status polling** - API-based, no browser
4. **Comment CRUD** - API-based, no browser
5. **Ticket lifecycle** - API-based transitions

**Estimated Impact**:
- Current: ~92 Playwright spec files
- After: ~47 Playwright E2E + ~30 Vitest integration tests
- CI time reduction: 40%+ (majority of tests run at ~50ms instead of ~500ms)

---

### 6. Shared Test Infrastructure

**Decision**: Reuse existing helpers without modification

**Reusable Components**:
- `tests/helpers/worker-isolation.ts` - Core mapping logic (extract pure function)
- `tests/helpers/db-cleanup.ts` - Prisma-based cleanup (framework-agnostic)
- `tests/helpers/db-setup.ts` - Prisma-based fixtures (framework-agnostic)
- `tests/global-setup.ts` - Test user creation (can be called from Vitest setup)

**Create New**:
- `tests/fixtures/vitest/setup.ts` - Per-test setup importing from helpers
- `tests/fixtures/vitest/global-setup.ts` - One-time setup with workerId handling
- `tests/fixtures/vitest/api-client.ts` - Fetch wrapper with auth headers

---

## Summary: Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `vitest.config.mts` | MODIFY | Add integration profile with env var |
| `tests/fixtures/vitest/setup.ts` | CREATE | Per-test setup with worker isolation |
| `tests/fixtures/vitest/global-setup.ts` | CREATE | One-time setup, workerId→projectId |
| `tests/fixtures/vitest/api-client.ts` | CREATE | Fetch wrapper with auth |
| `package.json` | MODIFY | Add `test:integration` script |
| `.specify/memory/constitution.md` | MODIFY | Update Section III for Testing Trophy |
| `CLAUDE.md` | MODIFY | Update testing commands and strategy |

---

## Resolved Unknowns

All "NEEDS CLARIFICATION" items from Technical Context have been resolved:

| Unknown | Resolution |
|---------|------------|
| Worker ID availability | Use `globalSetup` function's `workerId` parameter |
| API testing approach | Native fetch with custom wrapper |
| Server startup | Reuse existing dev server; add health check for CI |
| Config strategy | Single file with environment-based profiles |
| Worker isolation | Environment variable set in global setup |
