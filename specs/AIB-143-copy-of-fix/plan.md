# Implementation Plan: Fix Command Autocomplete Behavior and Dropdown Positioning

**Branch**: `AIB-143-copy-of-fix` | **Date**: 2026-01-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-143-copy-of-fix/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Fix command autocomplete behavior to properly close after selection and when space is typed after the trigger. Additionally, implement viewport-aware dropdown positioning to prevent autocomplete dropdowns from overflowing modal edges.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), React 18, TailwindCSS 3.4, shadcn/ui
**Storage**: N/A (client-side UI fix only)
**Testing**: Vitest (unit + RTL component tests)
**Target Platform**: Web (modern browsers)
**Project Type**: Web application (Next.js monolith)
**Performance Goals**: Autocomplete dismissal within 50ms (per SC-002)
**Constraints**: Dropdowns must remain visible within 320px of modal edges (per SC-003)
**Scale/Scope**: Single component enhancement in `components/comments/mention-input.tsx`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development ✅
- All changes will be in TypeScript strict mode
- No `any` types required - existing types (`AutocompletePosition`, `TriggerPosition`) are sufficient
- Function parameters and return types explicitly typed

### II. Component-Driven Architecture ✅
- Modifying existing shadcn/ui-based components
- Client component (`"use client"` directive already present)
- Following existing feature-based folder structure: `components/comments/`

### III. Test-Driven Development ✅
- Existing RTL component tests in `tests/unit/components/command-autocomplete.test.tsx`
- Will extend existing test suite rather than creating new files
- Tests will verify behavior per Testing Trophy strategy (component tests for UI interactions)

### IV. Security-First Design ✅
- No user input validation changes (UI-only fix)
- No API or database interactions
- No secrets or sensitive data involved

### V. Database Integrity ✅
- N/A - No database changes required

### VI. Specification Clarification Guardrails ✅
- Auto-resolved decisions documented in spec.md
- CONSERVATIVE policy applied with high confidence (0.9)
- Trade-offs documented for human review

**Gate Status: PASSED** - No violations detected

## Project Structure

### Documentation (this feature)

```
specs/AIB-143-copy-of-fix/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
components/
└── comments/
    ├── mention-input.tsx        # Primary file to modify (autocomplete logic)
    ├── command-autocomplete.tsx # Command dropdown component
    ├── user-autocomplete.tsx    # User mention dropdown (affected by positioning fix)
    └── ticket-autocomplete.tsx  # Ticket reference dropdown (affected by positioning fix)

tests/
└── unit/
    └── components/
        ├── command-autocomplete.test.tsx  # Existing tests to extend
        └── mention-input.test.tsx         # May need tests for positioning
```

**Structure Decision**: Next.js App Router monolith with feature-based component folders. All changes scoped to `components/comments/` directory with corresponding tests in `tests/unit/components/`.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No violations detected. All changes follow existing patterns in the codebase.

## Post-Design Constitution Re-Check ✅

After completing Phase 1 design artifacts, all constitution principles remain satisfied:

### I. TypeScript-First Development ✅
- New state `completedCommandPosition: number | null` uses primitive types
- `calculateViewportAwarePosition` function fully typed with explicit parameters and return type
- No `any` types introduced

### II. Component-Driven Architecture ✅
- Changes confined to existing `MentionInput` component
- No new UI primitives created - uses existing shadcn/ui Textarea
- Follows established component patterns in codebase

### III. Test-Driven Development ✅
- Test strategy defined in research.md
- Tests will extend existing `command-autocomplete.test.tsx`
- RTL component tests for user interactions (correct layer per Testing Trophy)

### IV. Security-First Design ✅
- No new attack surface - client-side positioning only
- No DOM injection risks - uses React state for positioning
- No external data handling changes

### V. Database Integrity ✅
- N/A - Confirmed no database changes

### VI. Specification Clarification Guardrails ✅
- Decisions align with AUTO/CONSERVATIVE policy from spec
- All clarifications resolved in research.md

**Final Gate Status: PASSED** - Ready for task generation
