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
Tests verify behavior from specs. Testing Trophy architecture prioritizes fast integration tests over slow E2E tests. See CLAUDE.md for test commands, locations, and layer details.

**Non-Negotiable Rules**:
- Tests verify behavior, not implementation details
- No feature is complete without passing tests

**Test Selection Decision Tree**:
1. Is it a pure function with no side effects? → **Vitest unit test**
2. Is it a React component with user interactions (forms, modals, buttons)? → **Vitest + RTL component test**
3. Does it involve API calls or database operations? → **Vitest integration test**
4. Does it REQUIRE a browser (OAuth, drag-drop, viewport)? → **Playwright E2E test**
5. If unsure, default to **Vitest integration test** (faster feedback)

**RTL Component Testing Guidelines**:
- **Query Priority** (accessibility-first): `getByRole` > `getByLabelText` > `getByText` > `getByTestId` (last resort)
- **User Interactions**: Use `userEvent` over `fireEvent` for realistic event simulation
- **Test Behavior**: Focus on user-visible behavior, not implementation details
- **Provider Setup**: Use `renderWithProviders()` from `tests/utils/component-test-utils.tsx`

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

## Development Standards

See CLAUDE.md for the full tech stack and forbidden dependencies. The constitution enforces the following additional standards:

**Code Quality**:
- Descriptive variable names (no single-letter variables except loop indices)
- JSDoc comments for exported functions with complex logic
- Functional components with hooks (no class components)
- Prefer `const` over `let`, avoid `var` entirely

**State Management**:
- Local state: `useState`; shared state: `useContext`; complex logic: `useReducer`
- Server state: TanStack Query v5 for data fetching, caching, and mutations
- Optimistic updates required for all mutations (create, update, delete operations)

**Error Handling**:
- Every API route MUST have try-catch blocks
- Return structured error responses: `{ error: string, code?: string }`
- Log errors with context (request ID, user ID if applicable)
- User-facing error messages must be clear and actionable

### V. Specification Clarification Guardrails
Auto-resolved specification decisions MUST preserve quality while avoiding unnecessary over-engineering. Mode selection prioritizes risk management without sacrificing baseline safeguards.

**Non-Negotiable Rules**:
- Clarification policies follow `ticket` override → `project` default → system fallback ordering. Overrides MUST be documented in the generated spec.
- `AUTO` mode MUST default to `CONSERVATIVE` whenever heuristics confidence is low, risk signals conflict, or sensitive keywords appear without explicit overrides.
- `PRAGMATIC` mode MUST retain security controls, data integrity requirements, and test commitments defined elsewhere in this constitution; it only trims polish, not safeguards.
- Every auto-resolved spec MUST include an `Auto-Resolved Decisions` summary that lists applied policies and trade-offs for human review before implementation.

**Rationale**: These guardrails let automation accelerate routine clarifications while guaranteeing that critical protections (security, data quality, verified tests) remain intact. Teams gain speed from PRAGMATIC choices when appropriate, but AUTO cannot degrade quality silently and CONSERVATIVE remains the safe default for uncertain work.

### VI. AI-First Development Model
This project is developed **100% via ai-board automated workflows**. See CLAUDE.md for operational details.

**Non-Negotiable Rules**:
- NO README, GUIDE, or educational documentation files at project root (except CLAUDE.md/AGENTS.md)
- NO "example" files, "quickstart" tutorials, or "how-to" guides — exception: `specs/[ticket-key]/` directories are workflow artifacts
- All AI guidance MUST be in constitution.md, CLAUDE.md, or `.claude/skills/`

**Rationale**: All code is generated by AI agents following the constitution and CLAUDE.md. Human-oriented documentation is unnecessary overhead.

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

**Version**: 1.6.0 | **Ratified**: 2025-09-30 | **Last Amended**: 2026-03-16
