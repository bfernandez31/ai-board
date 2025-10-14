<!--
Sync Impact Report
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
⚠ spec-template.md: Add Auto-Resolved Decisions summary section once automation ships
✅ plan-template.md: No changes required (guardrails are policy-level)
✅ tasks-template.md: No changes required (tasks already reference constitution principles)

Follow-up TODOs:
- Define AUTO confidence scoring mechanics to operationalize fallback trigger
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
Tests must be written BEFORE implementation. Red-Green-Refactor cycle is mandatory for all critical user flows.

**Non-Negotiable Rules**:
- **ALWAYS search for existing tests FIRST** before creating new test files
- Use `Grep` or `Glob` tools to find existing tests for the feature/component/API being modified
- Update and extend existing test files rather than creating duplicates
- Critical user flows require Playwright E2E tests before implementation
- Tests must fail initially (Red), then implementation makes them pass (Green)
- E2E tests in `/tests/[feature].spec.ts` using Playwright with MCP support
- Test names describe user actions: `test("user can create board and add card")`
- No feature is complete without passing tests

**Test Discovery Workflow** (MANDATORY before writing tests):
1. **Search by feature**: `npx grep -r "describe.*[feature-name]" tests/`
2. **Search by file path**: `npx glob "tests/**/*[feature-keyword]*.spec.ts"`
3. **Search by API route**: `npx grep -r "/api/[route-path]" tests/`
4. **Check test structure**: Read existing test file to understand patterns
5. **Extend or create**: Add tests to existing file OR create new file if truly needed

**Rationale**: TDD ensures requirements are testable, catches integration issues early, and provides regression protection. Writing tests first forces clear thinking about user value before implementation details. Searching for existing tests prevents duplication, maintains consistency, and leverages established test patterns. Playwright with MCP integration enables reliable cross-browser testing.

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
- **Frontend**: Next.js 15 (App Router), React 18, TypeScript, TailwindCSS
- **UI Components**: shadcn/ui exclusively for primitives
- **Drag & Drop**: @dnd-kit/core and @dnd-kit/sortable
- **Backend**: Next.js API Routes (App Router conventions)
- **Database**: PostgreSQL 14+ via Prisma ORM
- **AI Integration**: Anthropic Claude API (Sonnet 4.5)
- **GitHub Integration**: GitHub CLI (`gh` command) for repository operations
- **Spec-kit**: GitHub spec-kit for specification-driven workflows
- **Testing**: Playwright with MCP support
- **Hosting**: Vercel (optimized for Next.js)

**Future Additions** (not yet implemented):
- Authentication: NextAuth.js

**Forbidden Dependencies**:
- No UI libraries besides shadcn/ui and Radix UI (shadcn's foundation)
- No ORMs besides Prisma
- No state management libraries (Redux, MobX, etc.)—use React hooks only

## Development Workflow

**Code Organization**:
- `/app`: Next.js App Router pages and layouts
- `/app/api`: API route handlers
- `/components`: Reusable React components (feature-based folders)
- `/lib`: Shared utilities and helper functions
- `/prisma`: Database schema and migrations
- `/tests`: Playwright E2E tests
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
- Server state: React Server Components or SWR/React Query (when needed)

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
- Write E2E test for critical user flow
- Verify test fails (Red)
- Implement feature to make test pass (Green)
- Refactor if needed while keeping test green
- Run `npx playwright test` before pushing

**AI Agent Implementation Guidelines**:
When implementing features, AI agents (Claude Code, GitHub Copilot, etc.) MUST:
1. Read `specs/[feature]/spec.md` for requirements
2. **Search for existing tests** using Grep/Glob before writing any tests
3. **Update existing tests** if found, or create new tests only if none exist
4. Follow existing code patterns (review similar components/routes)
5. Use shadcn/ui components (never create UI primitives from scratch)
6. Match existing folder structure conventions
7. Write Playwright tests for critical paths before implementation (following Test Discovery Workflow)
8. Add TypeScript types explicitly (no implicit `any`)
9. Handle errors gracefully with try-catch and user-friendly messages
10. Verify all tests pass before considering feature complete

**Test File Management**:
- Before creating `tests/[new-feature].spec.ts`, search for existing test files that cover the same area
- Extend existing test suites rather than creating parallel test files
- Group related tests in the same file (e.g., all `/api/tickets` tests in one file)
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

**Version**: 1.2.0 | **Ratified**: 2025-09-30 | **Last Amended**: 2025-10-14
