# Quick Implementation: #906 Empty project
Use the Empty component from shadcn when there are no projects on the Projects page, instead of showing the "Create" and "Import Project" buttons.
This component should appear under the Projects title, where the list of projects normally is.
If there are projects, keep the "Import" and "Create" buttons just above the list.
Adapt the component to the Projects page with the correct button colors.
 IMPORTANT: never prompt me; you must do the full implementation, never run the full test suite, only impacted tests

**Feature Branch**: `058-906-empty-project`
**Created**: 2025-10-26
**Mode**: Quick Implementation (bypassing formal specification)

## Description

#906 Empty project
Use the Empty component from shadcn when there are no projects on the Projects page, instead of showing the "Create" and "Import Project" buttons.
This component should appear under the Projects title, where the list of projects normally is.
If there are projects, keep the "Import" and "Create" buttons just above the list.
Adapt the component to the Projects page with the correct button colors.
 IMPORTANT: never prompt me; you must do the full implementation, never run the full test suite, only impacted tests

## Implementation Notes

This feature is being implemented via quick-impl workflow, bypassing formal specification and planning phases.

**Quick-impl is suitable for**:
- Bug fixes (typos, minor logic corrections)
- UI tweaks (colors, spacing, text changes)
- Simple refactoring (renaming, file organization)
- Documentation updates

**For complex features**, use the full workflow: INBOX → SPECIFY → PLAN → BUILD

## Implementation

### Summary

Successfully implemented shadcn Empty component for the Projects page empty state.

### Changes Made

1. **Installed shadcn Empty component** (`components/ui/empty.tsx`)
   - Composable component with EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent
   - Follows shadcn's new-york style with proper spacing and typography

2. **Updated EmptyProjectsState component** (`components/projects/empty-projects-state.tsx`)
   - Replaced custom empty state with shadcn Empty component
   - Added FolderOpen icon from lucide-react
   - Moved Create/Import buttons into empty state content
   - Improved messaging: "No projects yet" with helpful description

3. **Updated Projects page** (`app/projects/page.tsx`)
   - Conditionally render header buttons only when projects exist
   - When no projects: buttons appear in empty state instead of header
   - Maintains consistent button styling and disabled state

4. **Added E2E test** (`tests/e2e/projects-list.spec.ts`)
   - Test validates empty state displays correctly
   - Verifies buttons are in empty content (not header)
   - Ensures proper cleanup and restoration of test fixtures

### Validation

- ✅ Type check passed (`bun run type-check`)
- ✅ Linter passed (`bun run lint`)
- ✅ E2E test for empty state passes
- ✅ All existing projects list tests pass (except 1 pre-existing failure)

### Files Modified

- `app/projects/page.tsx` - Conditional button rendering
- `components/projects/empty-projects-state.tsx` - Empty component integration
- `components/ui/empty.tsx` - New shadcn component
- `tests/e2e/projects-list.spec.ts` - Added empty state test
- `specs/058-906-empty-project/spec.md` - This file

### Visual Changes

**Before:**
- Empty state: Plain centered text with "No projects available"
- Buttons always visible in header

**After:**
- Empty state: Styled Empty component with icon, title, description, and action buttons
- Buttons in empty state when no projects, in header when projects exist
- Consistent with shadcn design system (border-dashed, proper spacing)
