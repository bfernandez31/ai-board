# Implementation Plan: Sign-In Page Redesign

**Branch**: `041-sign-in-page` | **Date**: 2025-10-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/041-sign-in-page/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Redesign the sign-in page to match the site's dark theme (#1e1e2e background, #8B5CF6 violet accents), display the application header component, and show three OAuth provider options (GitHub active, GitLab/BitBucket disabled with "Coming soon" indicators). The implementation will modify the existing `/auth/signin/page.tsx` to add disabled provider buttons, update the auth layout to show the header, and ensure full visual consistency with the rest of the application using shadcn/ui components and the Catppuccin Mocha color scheme.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, NextAuth.js v5, shadcn/ui, TailwindCSS 3.4, lucide-react
**Storage**: N/A (no data persistence for this feature - UI redesign only)
**Testing**: Playwright for E2E testing of OAuth flows and visual consistency
**Target Platform**: Web (Next.js SSR, browsers: Chrome, Firefox, Safari, Edge)
**Project Type**: Web application (Next.js App Router structure)
**Performance Goals**: <2s page load, <10s OAuth flow completion, <500ms authenticated user redirect
**Constraints**: WCAG 2.1 AA accessibility compliance, responsive design (mobile/tablet/desktop), dark theme consistency
**Scale/Scope**: Single page redesign affecting 3 files (page.tsx, layout.tsx, header.tsx), 3 OAuth provider buttons, visual theme matching

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development ✅
- **Status**: PASS
- **Evidence**: Existing codebase uses TypeScript 5.6 strict mode (tsconfig.json)
- **This feature**: Will modify existing .tsx files with strict typing
- **No violations**: All code will have explicit types, no `any` types

### II. Component-Driven Architecture ✅
- **Status**: PASS
- **Evidence**: Project uses shadcn/ui components and Next.js 15 App Router conventions
- **This feature**: Will use existing shadcn/ui Button and Card components, modify existing page components
- **No violations**: No custom UI primitives, follows feature-based folder structure

### III. Test-Driven Development (NON-NEGOTIABLE) ✅
- **Status**: PASS (with action required)
- **Evidence**: Project has Playwright E2E tests in `/tests/` directory
- **This feature**: Requires E2E tests for OAuth flow and visual consistency before implementation
- **Action**: Search for existing auth/signin tests, extend or create new test file
- **Test workflow**: Red (fail) → Green (pass) → Refactor

### IV. Security-First Design ✅
- **Status**: PASS
- **Evidence**: NextAuth.js already configured with GitHub provider, Zod schemas for validation
- **This feature**: No new inputs to validate (uses existing signIn server action), no secrets exposed
- **No violations**: CallbackUrl validation handled by NextAuth.js, no raw SQL

### V. Database Integrity ✅
- **Status**: PASS (N/A for this feature)
- **Evidence**: No database changes required
- **This feature**: UI redesign only, no schema migrations
- **No violations**: N/A

### VI. Specification Clarification Guardrails ✅
- **Status**: PASS
- **Evidence**: Spec.md includes Auto-Resolved Decisions section with PRAGMATIC policy applied
- **This feature**: Documented trade-offs for disabled providers and header behavior
- **No violations**: Security controls maintained, testing requirements documented

**GATE VERDICT**: ✅ PASS - All constitution principles satisfied. Proceed to Phase 0.

---

### Post-Design Re-Evaluation (After Phase 1)

**Re-evaluation Date**: 2025-10-22 (after research.md, data-model.md, contracts, quickstart.md generated)

#### I. TypeScript-First Development ✅
- **Status**: PASS (re-confirmed)
- **Evidence**: quickstart.md shows all code with explicit TypeScript types
- **Implementation**: No `any` types, strict mode maintained

#### II. Component-Driven Architecture ✅
- **Status**: PASS (re-confirmed)
- **Evidence**: Implementation uses shadcn/ui Button and Card exclusively
- **Implementation**: No custom UI primitives created, follows Next.js App Router structure

#### III. Test-Driven Development ✅
- **Status**: PASS (re-confirmed)
- **Evidence**: quickstart.md includes comprehensive E2E test suite BEFORE code implementation
- **Implementation**: TDD approach documented (Red → Green → Refactor)
- **Test Coverage**: 8 E2E tests covering visual consistency, accessibility, responsive design, OAuth flow

#### IV. Security-First Design ✅
- **Status**: PASS (re-confirmed)
- **Evidence**: No new security risks introduced, relies on NextAuth.js validation
- **Implementation**: CSRF protection, redirect URL validation, session security all handled by NextAuth.js

#### V. Database Integrity ✅
- **Status**: PASS (re-confirmed)
- **Evidence**: data-model.md confirms zero database changes
- **Implementation**: N/A - UI-only feature

#### VI. Specification Clarification Guardrails ✅
- **Status**: PASS (re-confirmed)
- **Evidence**: All auto-resolved decisions from spec.md remain valid after design phase
- **Implementation**: No new security or data integrity concerns discovered during research

**FINAL GATE VERDICT**: ✅ PASS - All constitution principles remain satisfied after design phase. No violations introduced. Ready to proceed to Phase 2 (tasks.md generation via /speckit.tasks).

## Project Structure

### Documentation (this feature)

```
specs/041-sign-in-page/
├── spec.md              # Feature specification (input)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
app/
├── auth/
│   ├── signin/
│   │   └── page.tsx          # MODIFY: Add GitLab/BitBucket disabled buttons, update styling
│   ├── layout.tsx            # MODIFY: Remove condition that hides header on auth pages
│   └── error/
│       └── page.tsx          # No changes
│
└── globals.css               # Reference for theme colors (no changes)

components/
├── layout/
│   └── header.tsx            # MODIFY: Update logic to show header on /auth/signin
├── ui/
│   ├── button.tsx            # USE: shadcn/ui Button component
│   └── card.tsx              # USE: shadcn/ui Card component
└── auth/
    └── user-menu.tsx         # No changes (not shown on sign-in page)

lib/
└── auth.ts                   # No changes (NextAuth.js configuration)

tests/
└── e2e/
    └── auth-signin.spec.ts   # CREATE: E2E tests for visual consistency and OAuth flow
```

**Structure Decision**: This is a web application using Next.js 15 App Router. The feature modifies existing auth page components and the shared header component. No new routes or API endpoints are required. Testing follows the existing Playwright E2E structure in `/tests/e2e/`.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations**: This feature fully complies with all constitution principles. No exceptions needed.
