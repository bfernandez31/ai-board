# Implementation Plan: Create Profile Settings Page

**Branch**: `AIB-465-create-profile-settings` | **Date**: 2026-04-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-465-create-profile-settings/spec.md`

## Summary

Add a read-only `/settings/profile` page that displays the authenticated user's account information sourced from GitHub OAuth data (avatar, name, email, GitHub username, registration date) and current subscription plan. The page is added as the first item in the settings navigation (user menu dropdown and mobile menu), following the existing settings page layout patterns with aurora theme styling.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), React 18, NextAuth.js, TanStack Query v5, shadcn/ui, lucide-react, Prisma 6.x
**Storage**: PostgreSQL 14+ via Prisma ORM (read-only queries — User, Account, Subscription models)
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Web (responsive: 320px–1920px)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Profile page renders within 2 seconds (SC-001)
**Constraints**: Read-only display only — no edit forms. Must use Tailwind semantic tokens (no hardcoded colors). Must use shadcn/ui components exclusively. WCAG AA 4.5:1 contrast.
**Scale/Scope**: Single new page + navigation updates in 2 existing components + 1 new API endpoint

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | All new code in strict TypeScript with explicit types |
| II. Component-Driven Architecture | ✅ PASS | shadcn/ui components, Server Component default, feature folder structure |
| III. Test-Driven Development | ✅ PASS | Integration tests for API, component tests for UI, no E2E needed (no browser-required features) |
| IV. Security-First Design | ✅ PASS | Auth check on page/API, no sensitive data exposure, Prisma parameterized queries |
| V. Database Integrity | ✅ PASS | Read-only queries, no schema changes required |
| V. Specification Guardrails | ✅ PASS | Auto-resolved decisions documented with policies and trade-offs |

**Gate Status**: ✅ PASS — All constitutional principles satisfied.

## Project Structure

### Documentation (this feature)

```
specs/AIB-465-create-profile-settings/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── profile-api.md   # GET /api/settings/profile contract
└── tasks.md             # Phase 2 output (NOT created by /plan)
```

### Source Code (repository root)

```
app/
├── settings/
│   └── profile/
│       └── page.tsx              # Profile settings page (client component)
├── api/
│   └── settings/
│       └── profile/
│           └── route.ts          # GET endpoint — returns profile data
components/
├── settings/
│   └── profile-info.tsx          # Profile display component (avatar, fields, plan badge)
├── auth/
│   └── user-menu.tsx             # MODIFY — add Profile link as first settings item
├── layout/
│   └── mobile-menu.tsx           # MODIFY — add Profile link as first settings item
tests/
├── unit/
│   └── components/
│       └── profile-info.test.tsx # Component test for ProfileInfo
├── integration/
│   └── settings/
│       └── profile.test.ts      # Integration test for GET /api/settings/profile
```

**Structure Decision**: Follows existing settings page pattern (`app/settings/[feature]/page.tsx`). Profile display logic extracted into a reusable component under `components/settings/`. API endpoint follows existing settings API pattern.

## Phase 0: Research

Research findings consolidated in [research.md](./research.md).

**Key decisions**:
1. GitHub username retrieval: Use `providerAccountId` (GitHub numeric ID) to construct profile URL via `https://github.com/` prefix, with the username fetched server-side from the Account record's access token
2. No schema changes needed — all data available from existing User, Account, and Subscription models
3. Page follows client component pattern (like billing page) with data fetched via TanStack Query from a dedicated API endpoint

**Output**: ✅ research.md created

## Phase 1: Design & Contracts

**Prerequisites**: ✅ research.md complete

### Data Model

Existing models used (no new models or migrations):
- **User**: `id`, `name`, `email`, `image`, `createdAt` — core profile fields
- **Account**: `provider`, `providerAccountId` — GitHub link (provider=github)
- **Subscription**: `plan`, `status` — current plan display

Full entity details in [data-model.md](./data-model.md).

### Contracts

- **GET /api/settings/profile** — Returns authenticated user's profile data including GitHub username resolved server-side. See [contracts/profile-api.md](./contracts/profile-api.md).

### Testing Strategy

| User Story | Test Type | Location | Rationale |
|------------|-----------|----------|-----------|
| US1: View Profile Information | Integration test | `tests/integration/settings/profile.test.ts` | API endpoint + DB query — no browser needed |
| US1: View Profile Information | Component test | `tests/unit/components/profile-info.test.tsx` | React component with user-visible content — RTL |
| US2: Navigate from Settings Menu | Component test | Extend existing user-menu tests | Verify Profile link presence and position |
| US3: Responsive Layout | No dedicated test | N/A | CSS-only responsiveness, verified visually; no drag-drop or viewport-dependent JS |
| Edge: Missing avatar | Component test | `tests/unit/components/profile-info.test.tsx` | Verify fallback initials render |
| Edge: Missing name | Component test | `tests/unit/components/profile-info.test.tsx` | Verify email shown when name is null |
| Edge: No subscription | Integration test | `tests/integration/settings/profile.test.ts` | Verify API returns FREE as default |

**Output**: ✅ data-model.md, contracts/profile-api.md, quickstart.md created

## Phase 2: Task Planning Approach

*Phase 2 is executed by `/ai-board.tasks`, not by `/ai-board.plan`.*

**Task generation strategy**: Linear dependency chain with parallel component work.

**Expected task categories**:
1. **API Layer**: Create `GET /api/settings/profile` endpoint with auth, Prisma query, GitHub username resolution
2. **UI Components**: Create `ProfileInfo` component with avatar, field rows, plan badge
3. **Page**: Create `app/settings/profile/page.tsx` wiring API data to component
4. **Navigation**: Update `user-menu.tsx` and `mobile-menu.tsx` to add Profile as first item
5. **Tests**: Integration test for API endpoint, component tests for ProfileInfo and navigation updates

**Ordering**: API → Component → Page → Navigation → Tests
**Parallelization**: [P] Component + API can be built in parallel; [P] Navigation updates are independent of page
**Estimated task count**: 7–9 tasks

## Complexity Tracking

*No constitutional violations. No complexity justifications needed.*

## Progress Tracking

- [x] Constitution Gate (pre-research) — ✅ PASS
- [x] Phase 0: Research — ✅ Complete
- [x] Phase 1: Design & Contracts — ✅ Complete
- [x] Constitution Gate (post-design) — ✅ PASS
- [ ] Phase 2: Task Generation — Pending (`/ai-board.tasks`)
- [ ] Phase 3+: Implementation — Pending (`/ai-board.implement`)
