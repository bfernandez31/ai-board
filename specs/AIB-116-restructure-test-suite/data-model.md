# Data Model: Testing Trophy Infrastructure

**Feature**: AIB-116-restructure-test-suite
**Date**: 2025-12-24

## Entities

This feature introduces no new database entities. The test infrastructure operates on existing entities (Project, Ticket, User, Job, Comment) without schema changes.

### Test Infrastructure Entities (Non-Persisted)

#### TestWorker

Represents a parallel test worker with isolated project scope.

| Field | Type | Description |
|-------|------|-------------|
| workerId | number | 0-based worker index from Vitest pool |
| projectId | number | Mapped project ID [1, 2, 4, 5, 6, 7] |
| testUserId | string | Default: 'test-user-id' |

**Mapping Logic**:
```typescript
const PROJECT_MAPPING = [1, 2, 4, 5, 6, 7]; // Skip 3 (development)
const projectId = PROJECT_MAPPING[workerId] ?? PROJECT_MAPPING[0];
```

#### APIClient

Represents the test HTTP client with authentication.

| Field | Type | Description |
|-------|------|-------------|
| baseUrl | string | Default: 'http://localhost:3000' |
| testUserId | string | User ID for x-test-user-id header |
| defaultHeaders | Record<string, string> | Merged into all requests |

**Methods**:
- `get(path)` - GET request with auth
- `post(path, body)` - POST with JSON body
- `patch(path, body)` - PATCH with JSON body
- `delete(path)` - DELETE request

#### TestContext

Represents the per-test execution context.

| Field | Type | Description |
|-------|------|-------------|
| projectId | number | Isolated project for this worker |
| api | APIClient | Pre-configured API client |
| cleanup | () => Promise<void> | Database cleanup function |

---

## Relationships

```
TestWorker (runtime)
    │
    ├── has one → Project (database)
    │               │
    │               └── has many → Ticket, Job, Comment
    │
    └── creates → APIClient (runtime)
                    │
                    └── authenticated as → User (database)
```

---

## State Transitions

No new state machines. Existing ticket/job states remain unchanged.

---

## Validation Rules

### Worker Isolation Rules

1. **Worker Count Limit**: Maximum 6 workers (matches PROJECT_MAPPING length)
2. **Project Exclusion**: Project ID 3 never used for tests (development reserved)
3. **Cleanup Requirement**: Each test must clean up its project before/after execution

### Test File Naming Rules

1. **Integration Tests**: `tests/integration/**/*.test.ts` (Vitest)
2. **E2E Tests**: `tests/e2e/**/*.spec.ts` (Playwright)
3. **Unit Tests**: `tests/unit/**/*.test.ts` (Vitest)

### Test Data Naming Rules

1. **Prefix Requirement**: All test data must use `[e2e]` prefix
2. **Cleanup Safety**: Only entities with `[e2e]` prefix are deleted in cleanup

---

## Migration Notes

### Existing Test Files Affected

| Source | Destination | Count |
|--------|-------------|-------|
| `tests/api/**/*.spec.ts` | `tests/integration/**/*.test.ts` | 26 files |
| `tests/database/**/*.spec.ts` | `tests/integration/**/*.test.ts` | 3 files |
| `tests/integration/**/*.spec.ts` | `tests/integration/**/*.test.ts` | ~10 files |
| `tests/e2e/**/*.spec.ts` | `tests/e2e/**/*.spec.ts` (keep) | ~47 files |
| `tests/e2e/**/*.spec.ts` | DELETE (covered by integration) | ~45 files |

### Domain Organization

| Domain | Integration Tests |
|--------|-------------------|
| projects | CRUD, settings, members, cleanup triggers |
| tickets | CRUD, transitions, workflows, quick-impl |
| comments | CRUD, mentions, notifications |
| jobs | Status polling, workflow dispatch |
| cleanup | Analysis, lock management |
| auth | API auth headers (not OAuth flows) |
