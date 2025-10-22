# Implementation Plan: Marketing Landing Page

**Branch**: `040-landing-page-marketing` | **Date**: 2025-10-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/040-landing-page-marketing/spec.md`

## Summary

Create a Vercel-style marketing landing page for unauthenticated visitors with dark theme design. The page features hero section with gradient typography, 6-card feature grid, workflow visualization, and strategic CTAs to drive sign-ups. Authenticated users are automatically redirected to their projects workspace. The landing page uses existing Catppuccin Mocha theme and shadcn/ui components for consistency.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS, Next.js 15 (App Router), React 18
**Primary Dependencies**:
- UI: shadcn/ui (Radix UI primitives), TailwindCSS 3.4, lucide-react (icons)
- Auth: NextAuth.js (session-based)
- State: TanStack Query v5.90.5 (server state caching)
- Existing: All required dependencies already installed

**Storage**: N/A (static page, no data persistence)
**Testing**: Playwright with MCP support for E2E tests
**Target Platform**: Web (Next.js SSR + client hydration), responsive mobile/tablet/desktop
**Project Type**: Web application (Next.js App Router)
**Performance Goals**:
- First Contentful Paint < 1.5s
- Lighthouse score > 90
- Cumulative Layout Shift < 0.1

**Constraints**:
- Must use existing Catppuccin Mocha theme colors
- Must not create new UI primitives (use shadcn/ui only)
- Must leverage Server Components by default
- Must handle authentication state check without flash

**Scale/Scope**: Single landing page, 4 major sections (Hero, Features, Workflow, Final CTA), ~10 components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development ✅
- **Status**: PASS
- **Verification**: All components will use TypeScript strict mode with explicit types
- **Note**: No `any` types needed; all props/state fully typed

### II. Component-Driven Architecture ✅
- **Status**: PASS
- **Verification**:
  - Using shadcn/ui Button, no custom buttons
  - Server Components by default (landing page, sections)
  - Client Components only for interactivity (header with auth check, scroll navigation)
  - Feature-based structure: `/components/landing/[component].tsx`
- **Note**: Follows established patterns from `/components/board/` and `/components/projects/`

### III. Test-Driven Development ✅
- **Status**: PASS - Will search existing tests first
- **Verification**:
  - Search for existing landing/auth redirect tests before creating new files
  - E2E tests for: unauthenticated visitor flow, CTA clicks, authenticated redirect, responsive layout
  - Tests written before implementation (Red-Green-Refactor)
- **Test Discovery Actions**:
  1. `grep -r "describe.*landing" tests/` - check for existing landing tests
  2. `grep -r "describe.*authentication.*redirect" tests/` - check for auth redirect tests
  3. `glob "tests/**/*landing*.spec.ts"` - find landing-related test files
  4. Extend existing files or create new only if no coverage exists

### IV. Security-First Design ✅
- **Status**: PASS
- **Verification**:
  - No user input collection (no forms, only navigation)
  - No sensitive data exposure (public marketing content only)
  - Auth state check uses NextAuth.js session (already implemented)
  - No new secrets or env vars required
- **Note**: Minimal security surface; inherits auth from existing system

### V. Database Integrity ✅
- **Status**: PASS (N/A)
- **Verification**: No database changes required
- **Note**: Feature is presentation-only, no data model changes

### Constitution-Specific Requirements
- **shadcn/ui Usage**: Button, Card components (already exist)
- **TanStack Query**: Not needed (no server data fetching on landing page)
- **State Management**: Only local state for scroll position, session check via NextAuth hook
- **Error Handling**: Graceful fallback if screenshot asset missing
- **Testing**: Playwright E2E for critical conversion paths

**Overall Gate Status**: ✅ **PASS** - No constitution violations, no complexity exceptions needed

## Project Structure

### Documentation (this feature)

```
specs/040-landing-page-marketing/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (technology decisions and patterns)
├── data-model.md        # Phase 1 output (N/A for this feature)
├── quickstart.md        # Phase 1 output (developer setup and testing guide)
├── contracts/           # Phase 1 output (N/A - no APIs)
├── checklists/          # Quality validation checklists
│   └── requirements.md  # Spec quality checklist (completed)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created yet)
```

### Source Code (repository root)

```
app/
├── page.tsx                         # [MODIFY] Root route: conditional redirect vs landing
└── landing/
    └── page.tsx                     # [CREATE] Landing page Server Component

components/
├── landing/                         # [CREATE] Landing page components
│   ├── hero-section.tsx            # Hero with gradient title, CTAs, screenshot
│   ├── features-grid.tsx           # 6-card grid with icons
│   ├── feature-card.tsx            # Reusable card component
│   ├── workflow-section.tsx        # 5-step timeline visualization
│   ├── workflow-step.tsx           # Individual workflow step component
│   └── cta-section.tsx             # Final call-to-action
│
├── layout/
│   └── header.tsx                  # [MODIFY] Add marketing variant logic
│
└── ui/                              # [EXISTING] shadcn/ui components (no changes)
    └── button.tsx                   # Used for CTAs

lib/
└── hooks/
    └── use-scroll-to-section.ts    # [CREATE] Smooth scroll navigation hook

tests/
├── e2e/
│   └── landing-page.spec.ts        # [CREATE] E2E tests for landing page flows
└── api/
    └── (no new API tests needed)
```

**Structure Decision**: Web application structure (Option 2). Landing page follows Next.js App Router conventions with Server Components by default. Client Components used only for authentication check (header) and scroll behavior (navigation links). All components under `/components/landing/` for feature isolation. No backend changes required.

## Complexity Tracking

*No constitution violations - this section intentionally left empty.*

## Phase 0: Research & Technology Decisions

### Research Tasks

1. **Next.js App Router SSR with Auth Check**
   - **Question**: How to check authentication on Server Component without flash?
   - **Research**: Next.js `redirect()` in Server Component, `getServerSession()` pattern
   - **Decision**: Use `getServerSession()` in root `page.tsx` Server Component to check auth before rendering

2. **Smooth Scroll Navigation Pattern**
   - **Question**: How to implement smooth scroll to sections without page reload?
   - **Research**: CSS `scroll-behavior: smooth`, JS `scrollIntoView()`, React hooks for scroll
   - **Decision**: CSS-first with JS fallback for better performance and progressive enhancement

3. **Responsive Gradient Typography**
   - **Question**: How to implement text gradient that works across breakpoints?
   - **Research**: Tailwind `bg-gradient-to-r` + `bg-clip-text`, responsive font sizing
   - **Decision**: Use Tailwind utility classes with responsive modifiers (`text-6xl md:text-7xl lg:text-8xl`)

4. **Image Optimization for Hero Screenshot**
   - **Question**: How to optimize large hero screenshot for performance?
   - **Research**: Next.js `<Image>` component, WebP format, lazy loading, placeholder
   - **Decision**: Use Next.js `<Image>` with priority loading for above-the-fold, WebP + PNG fallback

5. **Component Reusability Strategy**
   - **Question**: How to structure feature cards for maximum reusability?
   - **Research**: Component composition patterns, icon prop typing with lucide-react
   - **Decision**: Single `FeatureCard` component with icon/title/description props, typed icon using `LucideIcon` type

### Decisions Summary

All research tasks will be completed in **research.md** with detailed findings, alternatives considered, and final technology choices aligned with constitution requirements.

## Phase 1: Design & Contracts

### Data Model

**Status**: N/A - This feature has no data persistence requirements. Landing page is presentation-only with existing authentication state checks.

**Note**: See **data-model.md** for formal documentation (will note N/A status).

### API Contracts

**Status**: N/A - This feature has no new API endpoints. Uses existing NextAuth.js session API (`/api/auth/session`).

**Note**: `/contracts/` directory not needed for this feature.

### Component Contracts

**Interfaces** (to be defined in research.md and quickstart.md):

```typescript
// components/landing/feature-card.tsx
interface FeatureCardProps {
  icon: LucideIcon;
  iconColor: string;
  title: string;
  description: string;
}

// components/landing/workflow-step.tsx
interface WorkflowStepProps {
  stage: 'INBOX' | 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY';
  title: string;
  description: string;
  isLast?: boolean;
}
```

### Quick Start Guide

**quickstart.md** will include:
- Local development setup (no new dependencies)
- How to test landing page (visit `/` logged out)
- How to test auth redirect (visit `/` logged in)
- How to modify content (marketing copy, colors)
- How to replace screenshot placeholder
- Playwright test commands

## Phase 2: Task Breakdown

**Note**: Task breakdown will be generated by `/speckit.tasks` command after Phase 1 completion. Not included in this plan document.

**Expected Task Categories**:
1. Phase 1: Core routing and authentication logic
2. Phase 2: Hero section and CTA components
3. Phase 3: Features grid and cards
4. Phase 4: Workflow visualization
5. Phase 5: Header modifications
6. Phase 6: E2E tests and accessibility
7. Phase 7: Performance optimization

---

**Next Steps**:
1. Complete Phase 0 research (generate **research.md**)
2. Complete Phase 1 contracts (generate **quickstart.md**, **data-model.md** [N/A])
3. Run `/speckit.tasks` to generate **tasks.md** with implementation checklist
