# Implementation Plan: Fix Command Autocomplete Behavior and Dropdown Positioning

**Branch**: `AIB-144-fix-command-auto` | **Date**: 2026-01-05 | **Spec**: `/specs/AIB-144-fix-command-auto/spec.md`
**Input**: Feature specification from `/specs/AIB-144-fix-command-auto/spec.md`

## Summary

Fix command autocomplete behavior to close when space is typed (consistent with mention/ticket autocomplete) and prevent re-triggering after command selection. Additionally, implement viewport boundary detection for all autocomplete dropdowns to prevent overflow.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: React 18, Next.js 16 (App Router), shadcn/ui, TailwindCSS 3.4
**Storage**: N/A (UI-only changes)
**Testing**: Vitest + React Testing Library (component tests per constitution)
**Target Platform**: Web (modern browsers)
**Project Type**: Web application (Next.js)
**Performance Goals**: Dropdown position calculation under 16ms (frame budget)
**Constraints**: Dropdown must remain visible within modal bounds, no layout shifts
**Scale/Scope**: Single component (MentionInput) with 3 autocomplete types

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | All code in strict TypeScript, explicit types |
| II. Component-Driven | ✅ PASS | Using existing shadcn/ui components, modifying MentionInput |
| III. Test-Driven | ✅ PASS | Vitest + RTL component tests per Testing Trophy |
| IV. Security-First | ✅ PASS | No user input handling changes, UI-only |
| V. Database Integrity | ✅ N/A | No database changes |
| VI. AI-First Development | ✅ PASS | No documentation files being created |

**Testing Strategy Compliance**:
- Tests MUST use Vitest + RTL (not Playwright) per constitution III
- Existing test file: `tests/unit/components/command-autocomplete.test.tsx`
- Will extend existing tests rather than creating new files
- Tests verify behavior (space closes dropdown, boundary detection) not implementation

## Project Structure

### Documentation (this feature)

```
specs/AIB-144-fix-command-auto/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (existing files to modify)

```
components/comments/
├── mention-input.tsx           # Primary target - autocomplete logic & positioning
├── command-autocomplete.tsx    # Command dropdown (no changes needed)
├── user-autocomplete.tsx       # User dropdown (positioning changes shared)
└── ticket-autocomplete.tsx     # Ticket dropdown (positioning changes shared)

tests/unit/components/
├── command-autocomplete.test.tsx   # Extend with space-closes tests
├── ticket-autocomplete.test.tsx    # Existing - verify no regression
└── mention-input.test.tsx          # May need to create for positioning tests
```

**Structure Decision**: Web application using Next.js App Router. All changes are to existing components in `components/comments/`. Tests extend existing files in `tests/unit/components/`.

## Complexity Tracking

*No violations - all changes follow constitution principles.*
