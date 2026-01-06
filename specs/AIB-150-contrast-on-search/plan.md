# Implementation Plan: Contrast on Search Closed Ticket

**Branch**: `AIB-150-contrast-on-search` | **Date**: 2026-01-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-150-contrast-on-search/spec.md`

## Summary

Fix two issues with closed tickets in search:
1. **Contrast Issue**: Improve text contrast for closed tickets when selected/highlighted in the search dropdown to meet WCAG AA standards (4.5:1 ratio)
2. **Modal Access Issue**: When clicking a closed ticket from search, the modal doesn't open because closed tickets aren't included in the board's `allTickets` data

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16, React 18, TailwindCSS 3.4, shadcn/ui, TanStack Query v5
**Storage**: PostgreSQL 14+ via Prisma 6.x
**Testing**: Vitest (unit + integration), Playwright (E2E browser tests)
**Target Platform**: Web (modern browsers)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: No performance impact (CSS-only contrast fix, minor data fetching adjustment)
**Constraints**: Must maintain existing board UX - closed tickets remain hidden from board columns
**Scale/Scope**: Small UI fix affecting search component and data layer

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All changes will use TypeScript strict mode |
| II. Component-Driven | PASS | Using existing shadcn/ui Popover; editing existing SearchResults component |
| III. Test-Driven | PASS | Will add Vitest component tests for contrast states |
| IV. Security-First | PASS | No security implications for CSS styling |
| V. Database Integrity | PASS | No schema changes; read-only query modification |
| VI. AI-First Development | PASS | No documentation files created |

## Project Structure

### Documentation (this feature)

```
specs/AIB-150-contrast-on-search/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (empty - no API changes)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
components/
├── search/
│   └── search-results.tsx          # Main fix: contrast styling for selected closed tickets
├── board/
│   └── board.tsx                   # Fix: keep CLOSED tickets in cache (line ~923)

tests/
├── unit/
│   └── components/
│       └── search-results.test.tsx # New: RTL component tests for contrast states
```

**Structure Decision**: Minimal changes to existing files. No new production code files.

## Complexity Tracking

*No violations - straightforward UI fix with cache management adjustment*

| Aspect | Approach | Justification |
|--------|----------|---------------|
| Contrast fix | Conditional CSS classes in search-results.tsx | Selected closed tickets use `bg-muted` instead of `bg-primary opacity-60` |
| Modal access | Update cache instead of removing | Change `filter()` to `map()` at board.tsx:923 |

## Root Cause Analysis (from research.md)

### Contrast Issue
- **Location**: `components/search/search-results.tsx:63`
- **Problem**: `opacity-60` + `bg-primary text-primary-foreground` = 3.2:1 contrast (FAILS AA)
- **Fix**: Use `bg-muted text-foreground` for selected closed tickets = 8.4:1 contrast (PASSES AAA)

### Modal Access Issue
- **Location**: `components/board/board.tsx:923-928`
- **Problem**: When ticket is closed, `filter(t => t.id !== ticket.id)` removes it from cache
- **Fix**: Change to `map(t => t.id === ticket.id ? {...t, stage: CLOSED} : t)` to keep in cache
- **Note**: Board columns already filter out CLOSED at line 1074

## Constitution Check (Post-Design)

*Re-evaluated after Phase 1 design - all principles still pass*

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| I. TypeScript-First | PASS | Stage enum properly typed, no `any` types |
| II. Component-Driven | PASS | Editing existing SearchResults, no new components |
| III. Test-Driven | PASS | RTL component tests for contrast states |
| IV. Security-First | PASS | CSS-only change, no security implications |
| V. Database Integrity | PASS | No schema or API changes |
| VI. AI-First Development | PASS | No documentation files in project root |
