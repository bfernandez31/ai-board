<!--
Sync Impact Report
===================
Version Change: 1.3.0 → 1.4.0
Rationale: Migrate to Testing Trophy architecture (Kent C. Dodds) - Vitest for integration tests, Playwright for browser-only E2E

Modified Principles:
- UPDATED: Principle III - Test-Driven Development (Testing Trophy replaces hybrid strategy)
- UPDATED: Technology Standards - Testing section (Vitest for unit + integration)
- UPDATED: Development Workflow - Code Organization (updated test directory descriptions)
- UPDATED: Development Workflow - Testing Workflow (new test commands)
- UPDATED: AI Agent Implementation Guidelines (Testing Trophy strategy)

Added Rules:
- API tests use Vitest, NOT Playwright (10-20x faster)
- E2E tests are for browser-required features ONLY (OAuth, drag-drop, keyboard navigation)
- Tests organized by domain (tickets, projects, jobs), NOT by spec document
- Test Selection Decision Tree for choosing test type

Removed Rules:
- Playwright for integration tests (replaced by Vitest)
- Component integration tests in Playwright (moved to Vitest)

Templates Requiring Updates:
✅ CLAUDE.md: Updated with Testing Trophy architecture
✅ vitest.config.mts: Added integration test mode
✅ playwright.config.ts: Restricted to tests/e2e only
✅ package.json: Added test:integration script

Follow-up TODOs:
- None (Testing Trophy migration complete)

Previous Version History:
===================
Version Change: 1.2.0 → 1.3.0
Rationale: Add hybrid testing strategy (Vitest + Playwright) for optimal speed and coverage

Modified Principles:
- UPDATED: Principle III - Test-Driven Development (added hybrid testing strategy)

Previous Version History:
===================
Version Change: 1.1.0 → 1.2.0
Rationale: Add clarification guardrails so AUTO never produces low-quality PRAGMATIC outcomes

Modified Principles:
- ADDED: Specification Clarification Guardrails (new Principle V)

Added Rules:
- AUTO policy must fall back to CONSERVATIVE when confidence is low or risk signals conflict
- PRAGMATIC policies retain security, data integrity, and testing obligations
- Auto-Resolved Decisions summary documents trade-offs for human review
- Ticket overrides supersede project defaults when present

Templates Requiring Updates:
✅ spec-template.md: Auto-Resolved Decisions section stub added for policy transparency
✅ plan-template.md: No changes required (guardrails are policy-level)
✅ tasks-template.md: No changes required (tasks already reference constitution principles)

Follow-up TODOs:
- None (AUTO confidence scoring defined in specs/vision/auto-resolution-clarifications.md)
-->

# AI Board Constitution

## Core Principles

### I. TypeScript-First Development
All code MUST be written in TypeScript strict mode with explicit type annotations. The TypeScript compiler is the first line of defense against bugs.

**Non-Negotiable Rules**:
- `strict: true` in tsconfig.json at all times
- No `any` types unless explicitly justified in code comments
- All function parameters and return types explicitly typed
- All API responses and database models have corresponding TypeScript interfaces

**Rationale**: Type safety catches bugs at compile time, improves IDE support, enables confident refactoring, and serves as living documentation. The `any` type defeats TypeScript's purpose and is prohibited except in rare adapter/interop scenarios that must be documented.

### II. Component-Driven Architecture
UI components follow shadcn/ui patterns; server logic follows Next.js conventions. Feature folders contain related components, hooks, and utilities together.

**Non-Negotiable Rules**:
- Use shadcn/ui components exclusively for UI primitives (buttons, forms, dialogs, etc.)
- No custom component styling from scratch—compose shadcn/ui components instead
- Server Components by default; Client Components only when interactivity requires it (`"use client"` directive)
- Feature-based folder structure: `/components/[feature]/[component].tsx`
- API routes in `/app/api/[resource]/route.ts` with standard HTTP methods
- Shared utilities in `/lib/[utility].ts` with single responsibility

**Rationale**: Shadcn/ui provides accessible, tested, customizable components reducing maintenance burden. Feature folders improve discoverability and reduce cognitive load. Server Components improve performance by default. Explicit Client Component boundaries make hydration intentional.

### III. Test-Driven Development (NON-NEGOTIABLE)
Tests verify behavior from specs. Testing Trophy architecture prioritizes fast integration tests over slow E2E tests.

**Testing Trophy Strategy** (MANDATORY):

| Layer | Tool | Location | Speed | Use For |
|-------|------|----------|-------|---------|
| Static | TypeScript + ESLint | - | Instant | Type/syntax errors |
| Unit | Vitest | `tests/unit/` | ~1ms | Pure functions, utilities, hooks |
| Integration | Vitest + Prisma + fetch | `tests/integration/` | ~50ms | API endpoints, database, state machines |
| E2E | Playwright | `tests/e2e/` | ~5s | Browser-required only (auth, drag-drop, keyboard) |

**Non-Negotiable Rules**:
- **API tests use Vitest, NOT Playwright** - 10-20x faster execution
- **E2E tests are for browser-required features ONLY**: OAuth flow, drag-drop (DnD Kit), keyboard navigation, viewport testing
- Tests organized by domain (tickets, projects, jobs), NOT by spec document
- Tests verify behavior, not implementation details
- **ALWAYS search for existing tests FIRST** before creating new test files
- Update and extend existing test files rather than creating duplicates
- Unit tests in `/tests/unit/[feature].test.ts` using Vitest
- Integration tests in `/tests/integration/[domain]/[feature].test.ts` using Vitest
- E2E tests in `/tests/e2e/[feature].spec.ts` using Playwright
- No feature is complete without passing tests

**Test Selection Decision Tree**:
1. Is it a pure function with no side effects? → **Vitest unit test**
2. Does it involve API calls or database operations? → **Vitest integration test**
3. Does it REQUIRE a browser (OAuth, drag-drop, viewport)? → **Playwright E2E test**
4. If unsure, default to **Vitest integration test** (faster feedback)

**Test Commands**:
- `bun run test:unit` - Fast unit tests (~1ms each)
- `bun run test:integration` - API/DB tests (~50ms each, requires dev server)
- `bun run test:e2e` - Browser tests (~5s each)
- `bun run test` - All tests

**Rationale**: Testing Trophy architecture (Kent C. Dodds) provides optimal ROI. Integration tests offer high confidence with fast feedback. E2E tests are expensive and should be minimized to browser-required features. Spec-first AI development means tests verify specs are correctly implemented.

### IV. Security-First Design
Security is not an afterthought. Input validation, secure database queries, and secret management are required at every layer.

**Non-Negotiable Rules**:
- Validate ALL user inputs before processing (use Zod schemas for validation)
- Use Prisma parameterized queries exclusively—no raw SQL except for complex migrations
- Never expose sensitive data (API keys, passwords, internal IDs) in API responses
- All secrets in environment variables, never committed to git
- `.env` and `.env.local` files in `.gitignore` at all times
- Authentication middleware on protected routes (NextAuth.js when implemented)

**Rationale**: Input validation prevents injection attacks and data corruption. Prisma's type-safe queries prevent SQL injection. Environment variables enable per-environment configuration and secret rotation. Security breaches are expensive and damage trust.

### V. Database Integrity
All database changes go through Prisma migrations. Transactions protect multi-step operations. Soft deletes preserve audit trails.

**Non-Negotiable Rules**:
- All schema changes via `prisma migrate dev` or `prisma migrate deploy`
- Never manually alter production database schema
- Use Prisma transactions for operations affecting multiple tables
- Soft deletes (via `deletedAt` field) for user-generated content
- Database constraints (unique, foreign keys) enforced at schema level
- No optional fields without default values or explicit null handling

**Rationale**: Migrations provide version control for schema changes and enable safe rollback. Transactions ensure consistency (ACID properties). Soft deletes support audit trails and undo functionality. Schema-level constraints prevent invalid data at the source.

## Technology Standards

**Mandatory Stack**:
- **Frontend**: Next.js 16 (App Router), React 18, TypeScript, TailwindCSS
- **UI Components**: shadcn/ui exclusively for primitives
- **State Management**: TanStack Query v5 (React Query) for server state
- **Drag & Drop**: @dnd-kit/core and @dnd-kit/sortable
- **Backend**: Next.js API Routes (App Router conventions)
- **Database**: PostgreSQL 14+ via Prisma ORM
- **AI Integration**: Anthropic Claude API (Sonnet 4.5)
- **GitHub Integration**: GitHub CLI (`gh` command) for repository operations
- **Spec-kit**: GitHub spec-kit for specification-driven workflows
- **Testing**: Vitest (unit + integration tests), Playwright (E2E browser tests only)
- **Hosting**: Vercel (optimized for Next.js)

**Future Additions** (not yet implemented):
- Authentication: NextAuth.js

**Forbidden Dependencies**:
- No UI libraries besides shadcn/ui and Radix UI (shadcn's foundation)
- No ORMs besides Prisma
- No state management libraries (Redux, MobX, Zustand, etc.) for client state—use React hooks
- TanStack Query is the ONLY allowed library for server state management

## Development Workflow

**Code Organization**:
- `/app`: Next.js App Router pages and layouts
- `/app/api`: API route handlers
- `/components`: Reusable React components (feature-based folders)
- `/lib`: Shared utilities and helper functions
- `/prisma`: Database schema and migrations
- `/tests/unit`: Vitest unit tests for pure functions
- `/tests/integration`: Vitest integration tests for API/database
- `/tests/e2e`: Playwright E2E tests (browser-required only)
- `/public`: Static assets

**Code Quality Standards**:
- ESLint and Prettier configured and enforced
- Descriptive variable names (no single-letter variables except loop indices)
- JSDoc comments for exported functions with complex logic
- Functional components with hooks (no class components)
- Prefer `const` over `let`, avoid `var` entirely

**State Management**:
- Local state: `useState`
- Shared state within component tree: `useContext`
- Complex state logic: `useReducer`
- Server state: TanStack Query v5 (React Query) for data fetching, caching, and mutations
- Optimistic updates required for all mutations (create, update, delete operations)

**Error Handling**:
- Every API route MUST have try-catch blocks
- Return structured error responses: `{ error: string, code?: string }`
- Log errors with context (request ID, user ID if applicable)
- User-facing error messages must be clear and actionable

**GitHub Workflow**:
- Feature branches: `ai-board/[feature-name]`
- Use GitHub CLI (`gh`) for repository operations from backend
- Pull requests auto-created with descriptive titles and bodies
- Main branch auto-deploys to Vercel production
- Preview deployments for all pull requests

**Database Workflow**:
- Local development: `prisma migrate dev`
- Production: `prisma migrate deploy` (automated in CI/CD)
- Always run migrations before deploying code that depends on schema changes
- Use `prisma studio` for local database inspection

**Testing Workflow**:
- Write unit tests (Vitest) for pure utility functions
- Write integration tests (Vitest) for API endpoints and database operations
- Write E2E tests (Playwright) ONLY for browser-required features
- Verify tests fail (Red), implement to pass (Green), refactor
- Run `bun run test:unit` for unit tests (fast feedback, ~1ms each)
- Run `bun run test:integration` for API/DB tests (~50ms each, requires dev server)
- Run `bun run test:e2e` for browser tests (~5s each)
- Run `bun run test` to execute full test suite

**AI Agent Implementation Guidelines**:
When implementing features, AI agents (Claude Code, GitHub Copilot, etc.) MUST:
1. Read `specs/[feature]/spec.md` for requirements
2. **Search for existing tests** using Grep/Glob before writing any tests
3. **Update existing tests** if found, or create new tests only if none exist
4. Follow existing code patterns (review similar components/routes)
5. Use shadcn/ui components (never create UI primitives from scratch)
6. Match existing folder structure conventions
7. **Write tests following Testing Trophy strategy**:
   - Vitest unit tests for pure functions (`tests/unit/[feature].test.ts`)
   - Vitest integration tests for API/DB (`tests/integration/[domain]/[feature].test.ts`)
   - Playwright E2E ONLY if browser-required (`tests/e2e/[feature].spec.ts`)
8. Add TypeScript types explicitly (no implicit `any`)
9. Handle errors gracefully with try-catch and user-friendly messages
10. Verify all tests pass before considering feature complete

**Test File Management**:
- Tests organized by domain (tickets, projects, jobs), NOT by spec document
- Extend existing test suites rather than creating parallel test files
- Group related tests in the same file (e.g., all ticket API tests in `tests/integration/tickets/crud.test.ts`)
- Only create new test files when testing genuinely new functionality with no existing coverage

### V. Specification Clarification Guardrails
Auto-resolved specification decisions MUST preserve quality while avoiding unnecessary over-engineering. Mode selection prioritizes risk management without sacrificing baseline safeguards.

**Non-Negotiable Rules**:
- Clarification policies follow `ticket` override → `project` default → system fallback ordering. Overrides MUST be documented in the generated spec.
- `AUTO` mode MUST default to `CONSERVATIVE` whenever heuristics confidence is low, risk signals conflict, or sensitive keywords appear without explicit overrides.
- `PRAGMATIC` mode MUST retain security controls, data integrity requirements, and test commitments defined elsewhere in this constitution; it only trims polish, not safeguards.
- Every auto-resolved spec MUST include an `Auto-Resolved Decisions` summary that lists applied policies and trade-offs for human review before implementation.

**Rationale**: These guardrails let automation accelerate routine clarifications while guaranteeing that critical protections (security, data quality, verified tests) remain intact. Teams gain speed from PRAGMATIC choices when appropriate, but AUTO cannot degrade quality silently and CONSERVATIVE remains the safe default for uncertain work.

## Governance

**Authority**: This constitution supersedes all other development practices, coding guidelines, and architectural decisions. When conflicts arise, constitution principles take precedence.

**Amendments**:
- Constitution changes require explicit approval from project maintainer
- Amendment proposals must include rationale and migration plan for affected code
- Version bumping follows semantic versioning:
  - **MAJOR**: Breaking changes to core principles (e.g., removing principle, changing tech stack)
  - **MINOR**: New principles added or existing principles expanded
  - **PATCH**: Clarifications, wording improvements, typo fixes

**Compliance**:
- All pull requests MUST verify compliance with constitution principles
- Code reviews MUST reject PRs that violate non-negotiable rules
- Complexity exceptions (e.g., justified `any` types) must be documented inline

**Enforcement**:
- ESLint rules enforce TypeScript strict mode and code quality
- Prisma validates database schema integrity
- Playwright tests validate critical user flows
- Vercel deployment checks enforce build success

**Guidance Files**:
- AI agents use agent-specific instruction files (e.g., `CLAUDE.md`, `.github/copilot-instructions.md`) for runtime development guidance
- Agent instruction files MUST NOT contradict constitution principles
- Agent instruction files provide tactical guidance; constitution provides strategic rules

**Version**: 1.4.0 | **Ratified**: 2025-09-30 | **Last Amended**: 2025-12-25
