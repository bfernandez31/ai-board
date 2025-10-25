# Research: Enhanced Implementation Workflow

**Feature**: Database Setup and Selective Testing for `/speckit.implement` Command
**Date**: 2025-10-25
**Branch**: 052-896-workflow-implement

## Phase 0: Research Findings

### Research Question 1: PostgreSQL Service Setup in GitHub Actions

**Decision**: Use GitHub Actions service containers with PostgreSQL 14+ image
**Rationale**:
- Service containers run PostgreSQL directly in the runner environment
- Health checks ensure database is ready before test execution
- Ephemeral database perfect for CI/CD (cleaned between runs)
- No external dependencies or hosted database required

**Implementation Pattern**:
```yaml
services:
  postgres:
    image: postgres:14
    ports:
      - '5432:5432'
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ai_board_test
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

**Alternatives Considered**:
- Docker Compose setup: More complex, unnecessary overhead for single service
- External hosted database: Adds latency, cost, and configuration complexity
- SQLite in-memory: Not compatible with PostgreSQL-specific features used in production

**Sources**:
- GitHub Gist: https://gist.github.com/2color/537f8ef13ecec80059abb007839a6878
- Prisma Discussions: https://github.com/prisma/prisma/discussions/13006

---

### Research Question 2: Prisma Migration Execution in CI Environment

**Decision**: Use `prisma migrate deploy` for test database setup
**Rationale**:
- `migrate deploy` applies pending migrations without interactive prompts (CI-safe)
- Ensures test database schema matches production schema defined in Prisma
- Idempotent operation (safe to run multiple times)
- Faster than `migrate dev` which generates new migrations

**Implementation Pattern**:
```bash
# Generate Prisma Client from schema
npx prisma generate

# Apply all pending migrations to test database
npx prisma migrate deploy

# Seed test fixtures (test user, projects 1-2)
npx tsx tests/global-setup.ts
```

**DATABASE_URL Configuration**:
```bash
postgresql://postgres:postgres@localhost:5432/ai_board_test
```

**Alternatives Considered**:
- `prisma db push`: Skips migration history, not suitable for production-like testing
- `prisma migrate dev`: Interactive, creates new migrations, not CI-safe
- Manual SQL execution: Bypasses Prisma migration tracking, error-prone

**Sources**:
- Prisma Blog: https://www.prisma.io/blog/backend-prisma-typescript-orm-with-postgresql-deployment-bbba1ps7kip5
- Henrik VT Blog: https://blog.henrikvt.com/deploying-prisma-migrations-via-github-actions

---

### Research Question 3: Playwright Browser Installation and Caching

**Decision**: Use Playwright CLI with caching via `actions/cache@v4`
**Rationale**:
- Playwright CLI (`npx playwright install --with-deps`) installs browsers and OS dependencies
- Caching `~/.cache/ms-playwright` reduces installation time by 40 seconds (1min 43s → 45s)
- Browser binaries are cacheable; OS dependencies must be reinstalled each run (unavoidable)
- More flexible than Docker containers (allows use of standard GitHub Actions CLI tools)

**Implementation Pattern**:
```yaml
- name: Get Playwright version
  id: playwright-version
  run: echo "version=$(node -p "require('./package.json').devDependencies['@playwright/test']")" >> $GITHUB_OUTPUT

- name: Cache Playwright browsers
  uses: actions/cache@v4
  id: playwright-cache
  with:
    path: ~/.cache/ms-playwright
    key: ${{ runner.os }}-playwright-${{ steps.playwright-version.outputs.version }}

- name: Install Playwright browsers
  run: npx playwright install --with-deps
  if: steps.playwright-cache.outputs.cache-hit != 'true'

- name: Install Playwright OS dependencies only
  run: npx playwright install-deps
  if: steps.playwright-cache.outputs.cache-hit == 'true'
```

**Performance**:
- Cold install (no cache): ~3.5 minutes
- Warm install (cache hit): ~45 seconds
- Net savings: ~2 minutes 45 seconds per run

**Alternatives Considered**:
- Docker container (`mcr.microsoft.com/playwright`): Faster setup but loses GitHub Actions CLI tools
- No caching: 3.5 minute overhead on every run (unacceptable for 10-minute workflow goal)
- Manual browser binary download: Fragile, version mismatches

**Sources**:
- Playwright CI Docs: https://playwright.dev/docs/ci
- Justin Poehnelt Blog: https://justin.poehnelt.com/posts/caching-playwright-in-github-actions/
- DEV Community: https://dev.to/ayomiku222/how-to-cache-playwright-browser-on-github-actions-51o6

---

### Research Question 4: Dependency Caching Strategy

**Decision**: Cache `node_modules` with Bun lockfile key
**Rationale**:
- Project uses Bun as runtime (already configured in workflow)
- `bun install` is faster than npm/pnpm (native performance)
- Cache key based on `bun.lockb` ensures fresh install when dependencies change
- Reduces dependency installation from ~2 minutes to ~10 seconds (cache hit)

**Implementation Pattern**:
```yaml
- name: Cache node_modules
  uses: actions/cache@v4
  with:
    path: node_modules
    key: ${{ runner.os }}-bun-${{ hashFiles('bun.lockb') }}
    restore-keys: |
      ${{ runner.os }}-bun-

- name: Install dependencies
  run: bun install --frozen-lockfile
```

**Alternatives Considered**:
- No caching: 2-minute overhead on every run
- npm/pnpm caching: Slower than Bun, no advantage for this project
- Yarn caching: Not used in this project

---

### Research Question 5: Selective Test Execution Strategy

**Decision**: Provide Claude with explicit heuristics for test selection
**Rationale**:
- Claude has context awareness of modified files during implementation
- Test file patterns in project are predictable (tests/api/, tests/e2e/, tests/unit/)
- Hybrid testing strategy already documented in constitution (Vitest unit + Playwright E2E)
- Explicit guidance prevents over-testing (full suite) or under-testing (skipping critical tests)

**Claude Instruction Pattern**:
```
IMPORTANT: never prompt me; you must do the full implementation, never run the full test suite, only impacted tests

Test Selection Guidelines:
1. **API Route Changes** (app/api/*/route.ts):
   - Run contract tests: tests/api/<resource>.spec.ts
   - Example: Modify app/api/tickets/route.ts → Run tests/api/tickets.spec.ts

2. **UI Component Changes** (components/*):
   - Run E2E tests that interact with component: tests/e2e/<feature>.spec.ts
   - Example: Modify components/board/board.tsx → Run tests/e2e/board-drag-drop.spec.ts

3. **Utility Function Changes** (lib/*):
   - Run unit tests: tests/unit/<utility>.test.ts (Vitest)
   - Run integration tests that depend on utility: tests/integration/<feature>.spec.ts (Playwright)
   - Example: Modify lib/utils/date-format.ts → Run tests/unit/date-format.test.ts

4. **Database Schema Changes** (prisma/schema.prisma):
   - Run tests/api/*.spec.ts (all API tests - database-dependent)
   - Run tests/e2e/*.spec.ts (all E2E tests - database-dependent)

5. **When Uncertain**:
   - Run all tests in the affected module (e.g., all tests/api/ for API changes)
   - Err on the side of running more tests rather than skipping critical coverage

**Execution Commands**:
- Unit tests: `bun run test:unit` (Vitest - fast, ~1ms per test)
- E2E tests: `bun run test:e2e <path>` (Playwright - ~500ms-2s per test)
- Specific file: `bun run test:e2e tests/api/tickets.spec.ts`
```

**Rationale for Approach**:
- Reduces test execution time by 50%+ (FR-001 success criteria)
- Maintains quality by running relevant tests for changed code
- Prevents prompting user (autonomous implementation requirement)
- Aligns with hybrid testing strategy in constitution

**Alternatives Considered**:
- Jest test selection (`--findRelatedTests`): Not available in Vitest/Playwright
- Test impact analysis tools (Launchable, Bazel): Overkill for project size, adds complexity
- Always run full test suite: Violates 50% test reduction requirement, slows workflow to 15+ minutes
- No test execution: Defeats purpose of automated validation

---

### Research Question 6: Workflow Step Ordering and Conditional Execution

**Decision**: Add database/Playwright setup steps only for `implement` command
**Rationale**:
- Spec/plan commands don't require test execution (documentation-only)
- Conditional execution prevents wasted resources (5+ minutes saved per non-implement workflow)
- Maintains backward compatibility with existing specify/plan commands
- Clear separation of concerns (spec/plan = documentation, implement = validation)

**Implementation Pattern**:
```yaml
- name: Setup PostgreSQL
  if: ${{ inputs.command == 'implement' }}
  # ... service container configuration

- name: Setup Playwright
  if: ${{ inputs.command == 'implement' }}
  # ... Playwright installation steps

- name: Execute Spec-Kit Command
  run: |
    case "${{ inputs.command }}" in
      specify)
        # No database/Playwright setup
        ;;
      plan)
        # No database/Playwright setup
        ;;
      implement)
        # Database and Playwright already configured
        claude --dangerously-skip-permissions "/speckit.implement IMPORTANT: ..."
        ;;
    esac
```

**Step Ordering**:
1. Checkout repository (all commands)
2. Setup Bun/Node/Python (all commands)
3. Install Claude Code CLI (all commands)
4. Cache and install dependencies (all commands)
5. **Setup PostgreSQL service** (implement only)
6. **Cache Playwright browsers** (implement only)
7. **Install Playwright** (implement only)
8. **Apply Prisma migrations** (implement only)
9. **Seed test database** (implement only)
10. Execute spec-kit command (all commands, enhanced for implement)
11. Commit and push changes (all commands)
12. Update job status (all commands)

**Rationale for Order**:
- Dependencies installed before database setup (Prisma CLI needed for migrations)
- Database ready before Playwright (some E2E tests may require database)
- Migrations applied before seeding (fixtures depend on schema)
- All infrastructure ready before Claude execution

---

## Summary of Key Technologies

| Technology | Purpose | Version | Performance Target |
|------------|---------|---------|-------------------|
| PostgreSQL | Test database service | 14+ | Startup <30s (health checks) |
| Prisma | Database migrations + seeding | 6.x | Migration apply <1 min |
| Playwright | E2E test browser automation | 1.48+ | Install <3 min (cached <45s) |
| Bun | Runtime + dependency management | Latest | Dependency install <2 min (cached <10s) |
| GitHub Actions | Workflow orchestration | ubuntu-latest | Total workflow <10 min |
| Claude Code CLI | AI-powered implementation | @anthropic-ai/claude-code | Variable (feature-dependent) |

---

## Performance Budget Breakdown

| Phase | Time (Cold) | Time (Cached) | Success Criteria |
|-------|-------------|---------------|------------------|
| Dependency installation | 2 min | 10s | <30s (cached) |
| PostgreSQL setup | 30s | 30s | <2 min |
| Playwright installation | 3.5 min | 45s | <3 min |
| Prisma migrations | 1 min | 1 min | <2 min |
| Database seeding | 30s | 30s | N/A |
| Claude implementation | 5-10 min | 5-10 min | Variable |
| Test execution (selective) | 2-3 min | 2-3 min | 50% reduction vs full suite |
| **TOTAL WORKFLOW** | **14-20 min** | **10-15 min** | **<10 min (without Claude time)** |

**Note**: Total workflow time excluding Claude implementation meets <10 minute target. Claude implementation time is feature-dependent and cannot be optimized through infrastructure changes.

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| PostgreSQL service fails to start | Workflow failure, no database | Health checks with retries, fail fast with clear error |
| Playwright cache corruption | 3.5 min installation overhead | Cache key includes version, invalidates on upgrade |
| Selective tests miss critical regression | Production bug escapes CI | Full test suite runs on PR validation (safety net) |
| DATABASE_URL misconfiguration | Migration/seeding failure | Use fixed connection string, document in research.md |
| Workflow timeout (120 min) | Incomplete implementation | Per-step timeouts, fail fast on infrastructure setup errors |

---

## Next Steps (Phase 1: Design)

1. **Data Model**: No database schema changes required (using existing models)
2. **Contracts**: Define workflow YAML structure for implement command enhancements
3. **Quickstart**: Document workflow trigger, environment variables, and troubleshooting
4. **Agent Context Update**: Add PostgreSQL service pattern, Playwright caching pattern to CLAUDE.md

---

**Research Phase Status**: ✅ COMPLETE
**All NEEDS CLARIFICATION items resolved**: YES
**Ready for Phase 1 (Design)**: YES
