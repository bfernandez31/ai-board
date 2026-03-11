# Implementation Plan: Legal Pages - Terms of Service & Privacy Policy

**Branch**: `AIB-255-copy-of-legal` | **Date**: 2026-03-11 | **Spec**: `specs/AIB-255-copy-of-legal/spec.md`
**Input**: Feature specification from `/specs/AIB-255-copy-of-legal/spec.md`

## Summary

Add mandatory legal pages (Terms of Service and Privacy Policy) as static Server Components at `/legal/terms` and `/legal/privacy`. Create a global Footer component rendered on all pages with links to both legal pages. Add a consent notice on the sign-in page. No database changes, no new API endpoints, no new dependencies.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, TailwindCSS 3.4, shadcn/ui
**Storage**: N/A (no database changes)
**Testing**: Vitest (unit + integration), no E2E needed
**Target Platform**: Web (Vercel deployment)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Legal pages load within 2 seconds (SC-001) — trivially met since pages are static Server Components with no data fetching
**Constraints**: Pages must be public (no auth required), responsive on all devices, content in English
**Scale/Scope**: 2 new pages, 1 new component, 2 modified files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new files use TypeScript with explicit types |
| II. Component-Driven Architecture | PASS | Footer in `/components/layout/`, pages in `/app/legal/`, uses shadcn/ui components |
| III. Test-Driven Development | PASS | Integration tests for page accessibility + content, component test for Footer |
| IV. Security-First | PASS | No user input, no API endpoints, no secrets — purely static content |
| V. Database Integrity | PASS | No database changes |
| V. Spec Clarification Guardrails | PASS | All auto-resolved decisions documented in spec with trade-offs |
| VI. AI-First Development | PASS | No README/tutorial files created; all artifacts in `specs/` directory |

**Gate Result**: ALL PASS — proceed with implementation.

## Project Structure

### Documentation (this feature)

```
specs/AIB-255-copy-of-legal/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: Research findings
├── data-model.md        # Phase 1: Data model (no DB changes)
├── quickstart.md        # Phase 1: Implementation quickstart
├── contracts/           # Phase 1: Page route contracts
│   └── pages.md
└── tasks.md             # Phase 2 output (created by /ai-board.tasks)
```

### Source Code (repository root)

```
app/
├── layout.tsx                  # MODIFY: Add <Footer /> component
├── legal/
│   ├── terms/
│   │   └── page.tsx            # CREATE: Terms of Service page (Server Component)
│   └── privacy/
│       └── page.tsx            # CREATE: Privacy Policy page (Server Component)
└── auth/
    └── signin/
        └── page.tsx            # MODIFY: Add consent notice with legal links

components/
└── layout/
    └── footer.tsx              # CREATE: Global Footer component

tests/
├── unit/
│   └── components/
│       └── footer.test.tsx     # CREATE: Footer component test
└── integration/
    └── legal/
        └── pages.test.ts       # CREATE: Legal page integration tests
```

**Structure Decision**: Follows existing Next.js App Router conventions. Legal pages grouped under `/app/legal/` namespace. Footer placed in `/components/layout/` alongside existing Header. Tests follow Testing Trophy strategy — integration for page content verification, component test for Footer UI.

## Complexity Tracking

No constitution violations. No complexity justifications needed.

## Implementation Notes

### Footer Component (`/components/layout/footer.tsx`)
- Client Component (needs `Link` from `next/link` for client-side navigation)
- Minimal design: copyright + legal links
- Uses existing color palette: `text-[hsl(var(--ctp-subtext-0))]` for muted text, `hover:text-[#8B5CF6]` for link hover
- Responsive: stack vertically on mobile, horizontal on desktop
- Render in root layout after `{children}`

### Legal Pages (`/app/legal/terms/page.tsx`, `/app/legal/privacy/page.tsx`)
- Server Components (no interactivity, no client-side state)
- Static content structured with semantic HTML headings
- `max-w-3xl mx-auto` container for readable line length
- Effective date displayed at top of each page
- Next.js metadata exports for page titles

### Sign-In Page Consent Notice
- Add below OAuth buttons in the existing Card component
- Text: "By signing in, you agree to our Terms of Service and Privacy Policy"
- Links styled with `text-[#8B5CF6]` to match existing accent color
- `text-sm text-[hsl(var(--ctp-subtext-0))]` for the surrounding text

### Testing Strategy
- **Integration tests**: Fetch `/legal/terms` and `/legal/privacy`, verify 200 status and required content sections
- **Component test**: Render Footer, verify both legal links present with correct hrefs
- **No E2E tests**: No browser-required functionality (no OAuth, no drag-drop, no viewport-specific behavior)
