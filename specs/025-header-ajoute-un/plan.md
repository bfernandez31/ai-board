# Implementation Plan: Application Header

**Branch**: `025-header-ajoute-un` | **Date**: 2025-10-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/025-header-ajoute-un/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✅ Spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✅ Project Type: Web application (Next.js 15 App Router)
   → ✅ Structure Decision: Next.js App Router with feature-based component organization
3. Fill the Constitution Check section
   → ✅ Constitution v1.0.0 principles reviewed
4. Evaluate Constitution Check section
   → ✅ No violations - UI-only feature with shadcn/ui components
   → ✅ Progress Tracking: Initial Constitution Check PASS
5. Execute Phase 0 → research.md
   → ✅ No NEEDS CLARIFICATION remain (deferred items acceptable for implementation)
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → ✅ No API contracts needed (client-side only component)
   → ✅ No data model needed (stateless UI component)
   → ✅ Component contracts and prop interfaces defined
7. Re-evaluate Constitution Check section
   → ✅ No new violations - design uses shadcn/ui toast and responsive patterns
   → ✅ Progress Tracking: Post-Design Constitution Check PASS
8. Plan Phase 2 → Describe task generation approach
   → ✅ TDD approach with E2E tests before implementation
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Create a site-wide application header component following Vercel's design pattern with AI-BOARD branding. The header will be fixed at the top of all pages, displaying the logo, site title, and three placeholder action buttons ("Log In", "Contact", "Sign Up") that show toast notifications when clicked. Mobile viewports will collapse buttons into a hamburger menu. The implementation follows the constitutional requirements for shadcn/ui component usage, TypeScript strict mode, and Catppuccin Mocha theme integration.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, shadcn/ui (@radix-ui/react-toast), TailwindCSS 3.4, lucide-react (icons)
**Storage**: N/A (stateless UI component)
**Testing**: Playwright E2E tests (minimal coverage per user request - comprehensive tests deferred)
**Target Platform**: Web (desktop + mobile responsive)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: <100ms render time, <50KB bundle size for header component
**Constraints**: Fixed/sticky positioning (always visible), Catppuccin Mocha color palette mandatory, shadcn/ui components only
**Scale/Scope**: Single reusable component, site-wide usage across all pages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development
- [x] **strict: true** - Project already configured with TypeScript strict mode
- [x] **No any types** - Component props and handlers will use explicit types
- [x] **Explicit typing** - All function parameters and return types will be typed
- [x] **Interface definitions** - HeaderProps interface for component configuration

**Status**: ✅ PASS - Standard React component with TypeScript interfaces

### II. Component-Driven Architecture
- [x] **shadcn/ui components** - Will use shadcn/ui Toast component (already in dependencies)
- [x] **No custom styling from scratch** - Compose from shadcn/ui Button, Toast primitives
- [x] **Server Components by default** - Header can be Server Component; buttons require "use client" for interactivity
- [x] **Feature-based folder** - Component in `/components/layout/header.tsx` (cross-cutting UI element)
- [x] **Shared utilities** - Use existing `/lib/utils.ts` for cn() className merging

**Status**: ✅ PASS - Follows shadcn/ui patterns and Next.js App Router conventions

### III. Test-Driven Development
- [x] **E2E tests before implementation** - Playwright test for header visibility and button interactions
- [x] **Red-Green-Refactor** - Test will fail initially, then implementation makes it pass
- [x] **Test naming** - "user can see header on all pages and interact with placeholder buttons"
- [x] **Minimal coverage** - Per user request: basic visibility + toast interaction only (no TDD deep dive)

**Status**: ✅ PASS - Minimal E2E test as specified in requirements (comprehensive tests deferred)

**Note**: User explicitly requested minimal testing ("Fait le minimum de test possible pas besoin de faire de tdd ou tester que les bouton affiche bien un toaster"). This deviation from normal TDD rigor is documented and accepted for this feature.

### IV. Security-First Design
- [x] **Input validation** - N/A (no user inputs processed)
- [x] **No sensitive data exposure** - Component renders static content only
- [x] **Environment variables** - N/A (no secrets used)

**Status**: ✅ PASS - No security concerns for static UI component

### V. Database Integrity
- [x] **No database changes** - UI-only feature, no schema modifications

**Status**: ✅ PASS - N/A for this feature

### Initial Constitution Check: ✅ PASS

## Project Structure

### Documentation (this feature)
```
specs/025-header-ajoute-un/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   └── header-props.ts  # TypeScript interface definitions
├── quickstart.md        # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

**Structure Decision**: Next.js App Router web application with feature-based component organization. This is a layout component (cross-cutting concern) so it goes in `/components/layout/` rather than a feature-specific folder.

```
app/
├── layout.tsx                    # ✏️ MODIFIED - Import and render Header component
└── globals.css                   # ✅ EXISTS - Catppuccin Mocha palette (no changes)

components/
├── layout/                       # 🆕 NEW DIRECTORY
│   ├── header.tsx                # 🆕 NEW - Main Header component (Client Component)
│   └── mobile-menu.tsx           # 🆕 NEW - Mobile hamburger menu (Client Component)
└── ui/
    ├── button.tsx                # ✅ EXISTS - shadcn/ui Button component
    └── toast.tsx                 # ✅ EXISTS - shadcn/ui Toast component (@radix-ui/react-toast)

lib/
└── utils.ts                      # ✅ EXISTS - cn() utility for className merging

public/
└── (logo will be copied from specs/vision/logo/29-final-clean.svg)

tests/e2e/
└── header.spec.ts                # 🆕 NEW - Minimal E2E test (visibility + toast interaction)
```

**Key Files**:
- **app/layout.tsx**: Root layout modified to include `<Header />` component
- **components/layout/header.tsx**: Main header component with logo, title, desktop buttons
- **components/layout/mobile-menu.tsx**: Mobile hamburger menu with collapsible button list
- **tests/e2e/header.spec.ts**: Playwright E2E test for header visibility and interactions

## Phase 0: Outline & Research

### Research Topics

1. **shadcn/ui Toast Component Integration**
   - Decision: Use existing `@radix-ui/react-toast` (already in dependencies)
   - Rationale: Project already has shadcn/ui Toast installed; follows constitutional requirement
   - Alternatives considered: Custom toast library (rejected - violates constitution)

2. **Mobile Hamburger Menu Pattern**
   - Decision: Use shadcn/ui Sheet component for slide-out menu
   - Rationale: Sheet provides accessible, animated drawer pattern; Radix UI primitives ensure WCAG compliance
   - Alternatives considered: Custom dropdown (rejected - shadcn/ui preferred), Popover (rejected - Sheet better for mobile)

3. **Fixed/Sticky Header Implementation**
   - Decision: CSS `position: sticky` with `top: 0` and `z-index: 50`
   - Rationale: Better performance than `position: fixed`; respects document flow; Next.js optimizations work naturally
   - Alternatives considered: `position: fixed` (rejected - scroll issues with modals), JavaScript scroll listener (rejected - performance)

4. **Logo SVG Integration**
   - Decision: Copy `specs/vision/logo/29-final-clean.svg` to `public/logo.svg`; use Next.js `<Image>` component with SVG support
   - Rationale: Next.js Image component optimizes even SVGs; public folder for static assets per Next.js conventions
   - Alternatives considered: Inline SVG (rejected - harder to maintain), external URL (rejected - external dependency)
   - **Color Handling** (deferred clarification): Use SVG as-is; if color adjustment needed, apply CSS `filter` or modify SVG `fill` during implementation

5. **Responsive Breakpoint Strategy**
   - Decision: TailwindCSS `md:` breakpoint (768px) for desktop/mobile toggle
   - Rationale: Standard breakpoint for header layouts; matches project's existing responsive patterns
   - Alternatives considered: `sm:` 640px (rejected - too early for mobile menu), `lg:` 1024px (rejected - too late, wasted space)

6. **Toast Behavior on Rapid Clicks** (deferred clarification)
   - Decision: Use default shadcn/ui Toast behavior (stacked toasts with auto-dismiss)
   - Rationale: Standard library behavior; acceptable per spec deferral; can be adjusted later if needed
   - Alternatives considered: Single toast replacement (considered during implementation if UX issues arise)

7. **Logo Fallback Strategy** (deferred clarification)
   - Decision: Show "AI-BOARD" text-only if logo fails to load
   - Rationale: Maintains branding; graceful degradation; simple implementation with `onError` handler
   - Alternatives considered: Generic icon (rejected - less recognizable), empty space (rejected - poor UX)

### Research Findings Consolidated in research.md

**Output**: research.md with all technical decisions documented

## Phase 1: Design & Contracts

*Prerequisites: research.md complete*

### 1. Data Model

**No data model needed** - This is a stateless UI component with no database interactions.

### 2. Component Contracts (TypeScript Interfaces)

Created in `/specs/025-header-ajoute-un/contracts/header-props.ts`:

```typescript
/**
 * Header component props interface
 * Stateless component - no runtime configuration needed for v1
 */
export interface HeaderProps {
  // V1: No props needed (static content)
  // Future: Add props for dynamic user state, active page, etc.
}

/**
 * Header button configuration
 * Used internally for button rendering
 */
interface HeaderButton {
  label: 'Log In' | 'Contact' | 'Sign Up';
  onClick: () => void;
  variant?: 'default' | 'ghost' | 'outline';
}

/**
 * Mobile menu props
 */
export interface MobileMenuProps {
  buttons: HeaderButton[];
  isOpen: boolean;
  onToggle: () => void;
}
```

### 3. Component Structure

**Header Component** (`components/layout/header.tsx`):
- **Purpose**: Site-wide navigation header with branding and action buttons
- **Type**: Client Component (`"use client"` - requires interactivity for toast and mobile menu)
- **Styling**: Catppuccin Mocha colors (`bg-ctp-mantle`, `text-ctp-text`, etc.)
- **Layout**: Flexbox with `justify-between` (logo/title left, buttons right)
- **Positioning**: `sticky top-0 z-50` for fixed visibility
- **Responsive**: Desktop buttons visible on `md:` breakpoint, mobile menu below

**Mobile Menu Component** (`components/layout/mobile-menu.tsx`):
- **Purpose**: Collapsible hamburger menu for mobile viewports
- **Type**: Client Component (interactive state for open/closed)
- **Behavior**: Sheet component slides in from right with button list
- **Trigger**: Hamburger icon (lucide-react `Menu` icon) visible below `md:` breakpoint

### 4. Integration Points

**app/layout.tsx** modifications:
```typescript
import { Header } from '@/components/layout/header'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Header /> {/* Add header at top of layout */}
        <main>{children}</main>
        <Toaster /> {/* shadcn/ui Toast container (may already exist) */}
      </body>
    </html>
  )
}
```

### 5. Quickstart Scenario

Created in `/specs/025-header-ajoute-un/quickstart.md`:

```markdown
# Header Feature Quickstart

## User Scenario: View Header and Test Placeholder Buttons

1. **Start dev server**: `npm run dev`
2. **Navigate to any page**: http://localhost:3000/ (or any route)
3. **Verify header appearance**:
   - Header visible at top (fixed position)
   - AI-BOARD logo and title on left
   - Three buttons on right (desktop): "Log In", "Contact", "Sign Up"
4. **Test desktop button interaction**:
   - Click "Log In" → Toast appears: "This feature is not yet implemented"
   - Click "Contact" → Same toast
   - Click "Sign Up" → Same toast
5. **Test mobile responsive behavior** (resize browser < 768px):
   - Buttons hidden
   - Hamburger menu icon visible
   - Click hamburger → Menu slides in with three buttons
   - Click button in menu → Toast appears → Menu closes
6. **Test scroll behavior**:
   - Scroll down page → Header remains visible at top (sticky)
   - Scroll back up → Header still present

## Expected Outcomes
- Header renders on all pages (site-wide)
- Fixed positioning works correctly
- Buttons trigger toast notifications
- Mobile menu collapses properly
- Catppuccin Mocha colors applied consistently
```

### 6. Update CLAUDE.md

Run script to update agent context file:

```bash
.specify/scripts/bash/update-agent-context.sh claude
```

This will add:
- **Active Technologies**: TypeScript 5.6 + Next.js 15 (App Router) + React 18 + shadcn/ui + TailwindCSS 3.4 + lucide-react
- **Recent Changes**: Header component with Catppuccin Mocha theme, fixed positioning, mobile responsive hamburger menu

**Output**: contracts/header-props.ts, quickstart.md, CLAUDE.md updated

### Post-Design Constitution Check: ✅ PASS

**Review**:
- [x] shadcn/ui Toast component used (constitutional requirement met)
- [x] shadcn/ui Sheet component for mobile menu (constitutional requirement met)
- [x] TypeScript interfaces defined in contracts/ (constitutional requirement met)
- [x] Client Component boundaries explicit ("use client" directives) (constitutional requirement met)
- [x] Feature-based component organization (layout/ directory) (constitutional requirement met)

No violations introduced during design phase.

## Phase 2: Task Planning Approach

*This section describes what the /tasks command will do - DO NOT execute during /plan*

### Task Generation Strategy

The `/tasks` command will generate tasks following TDD principles with minimal coverage (per user request):

1. **Setup Tasks**:
   - [P] Copy logo SVG from `specs/vision/logo/29-final-clean.svg` to `public/logo.svg`
   - [P] Verify shadcn/ui Toast and Sheet components installed (should exist)

2. **Test Tasks** (TDD - Tests First):
   - Write E2E test in `tests/e2e/header.spec.ts`:
     - Test: Header visible on all pages
     - Test: Desktop buttons visible and trigger toast
     - Test: Mobile menu collapses and expands
     - Verify test fails (Red)

3. **Implementation Tasks** (Make Tests Pass):
   - Create `components/layout/header.tsx`:
     - Logo + title layout
     - Desktop button rendering
     - Toast integration
   - Create `components/layout/mobile-menu.tsx`:
     - Sheet component integration
     - Hamburger icon
     - Button list rendering
   - Modify `app/layout.tsx`:
     - Import and render Header component
     - Ensure Toaster component present

4. **Refinement Tasks**:
   - Apply Catppuccin Mocha colors
   - Test responsive breakpoints (manual browser resize)
   - Verify sticky positioning behavior
   - Run E2E test (should pass - Green)

### Ordering Strategy

- **TDD Order**: E2E test → Implementation → Refinement → Validation
- **Dependency Order**: Setup (logo, dependencies) → Tests → Header component → Mobile menu → Layout integration
- **Parallel Markers** [P]: Setup tasks can run in parallel (logo copy, dependency check)

### Estimated Output

**15-20 numbered tasks** in tasks.md:

1. [P] Copy logo SVG to public folder
2. [P] Verify shadcn/ui dependencies
3. Write E2E test for header (Red phase)
4. Create header component structure
5. Implement logo and title rendering
6. Implement desktop buttons with toast
7. Create mobile menu component
8. Integrate Sheet component for mobile
9. Add hamburger icon toggle logic
10. Update root layout with Header
11. Apply Catppuccin Mocha styling
12. Test responsive behavior manually
13. Verify sticky positioning
14. Run E2E test (Green phase)
15. Manual QA on all pages

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run Playwright tests, manual QA, responsive testing)

## Complexity Tracking

*No violations - table not needed*

This feature has zero constitutional violations:
- Uses shadcn/ui components exclusively (Toast, Sheet, Button)
- TypeScript strict mode with explicit interfaces
- Minimal testing per user request (documented deviation)
- No database, security, or complexity concerns

## Progress Tracking

*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (3 low-impact items deferred to implementation)
- [x] Complexity deviations documented (none - zero violations)

---

*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
