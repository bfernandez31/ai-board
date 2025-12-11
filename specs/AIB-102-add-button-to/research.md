# Research: Add Button to Consult Summary

**Feature Branch**: `AIB-102-add-button-to`
**Date**: 2025-12-11

## Research Tasks

### 1. Existing Documentation Button Patterns

**Context**: Need to understand how existing Spec, Plan, Tasks buttons work to maintain consistency.

**Findings**:

#### Button Rendering Location
- **File**: `components/board/ticket-detail-modal.tsx` (lines 1017-1062)
- **Container**: Details Tab footer section in TicketDetailModal
- **Layout**: Horizontal flex container with `gap-2` and `flex-wrap`
- **Conditional wrapper**: Only renders when `hasCompletedSpecifyJob` is true

#### Button Styling Pattern
```typescript
<Button
  onClick={() => {
    setDocViewerType('spec');  // or 'plan' or 'tasks'
    setDocViewerOpen(true);
  }}
  variant="outline"
  className="h-8 px-3 text-xs ..."
>
  <IconComponent className="w-3.5 h-3.5" />
  Label
</Button>
```

#### Visibility Logic (from lines 265-284)
| Button | Condition |
|--------|-----------|
| Spec | `hasCompletedSpecifyJob` (job.command='specify', status='COMPLETED') |
| Plan | `workflowType === 'FULL' && hasCompletedPlanJob` |
| Tasks | Same as Plan (created by plan job) |
| **Summary** | `workflowType === 'FULL' && hasCompletedImplementJob` |

**Decision**: Summary button follows Tasks button pattern but checks for 'implement' job instead of 'plan' job.

**Rationale**: Summary.md is generated during implement step, not plan step.

**Alternatives considered**:
- Check for summary file existence via API - rejected due to unnecessary API call
- Always show button - rejected as file may not exist

---

### 2. DocumentType Extension Pattern

**Context**: DocumentType is defined in `lib/validations/documentation.ts` and used throughout the codebase.

**Findings**:

#### Current Definition (line 13)
```typescript
export const DocumentTypeSchema = z.enum(['spec', 'plan', 'tasks']);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;
```

#### Usage Locations
1. `use-documentation.ts` - TanStack Query hook
2. `use-documentation-history.ts` - Commit history hook
3. `documentation-viewer.tsx` - DocumentTypeLabels mapping
4. All API routes (`/api/projects/[projectId]/tickets/[id]/[docType]`)

#### DocumentTypeLabels Mapping (documentation-viewer.tsx:29-33)
```typescript
const DocumentTypeLabels: Record<DocumentType, string> = {
  spec: 'Specification',
  plan: 'Implementation Plan',
  tasks: 'Task Breakdown',
};
```

**Decision**: Add 'summary' to DocumentTypeSchema enum and DocumentTypeLabels.

**Rationale**: Single source of truth for valid document types.

**Alternatives considered**:
- Create separate SummaryType - rejected for inconsistency

---

### 3. API Route Pattern for Documentation

**Context**: Need to create GET endpoint for summary content.

**Findings**:

#### Existing Pattern (spec/route.ts)
1. Validate projectId and ticketId params
2. Verify project exists
3. Query ticket with project-scoped validation
4. Include jobs with specific command filter
5. Check branch assigned
6. Check completed job exists
7. Determine branch (SHIP → main, else → feature branch)
8. Fetch from GitHub via `fetchDocumentContent()`
9. Return `{ content, metadata }` response

#### Job Command Mapping
| DocType | Job Command |
|---------|-------------|
| spec | 'specify' |
| plan | 'plan' |
| tasks | 'plan' (created by plan job) |
| **summary** | 'implement' |

#### Error Codes Used
- `VALIDATION_ERROR` (400)
- `PROJECT_NOT_FOUND` (404)
- `TICKET_NOT_FOUND` (404)
- `WRONG_PROJECT` (403)
- `BRANCH_NOT_ASSIGNED` / `SPEC_NOT_AVAILABLE` (404)
- `RATE_LIMIT` (429)
- `FILE_NOT_FOUND` (404)
- `GITHUB_API_ERROR` (500)

**Decision**: Create `summary/route.ts` following exact same pattern as spec/route.ts but with 'implement' job check.

**Rationale**: Consistency with existing patterns ensures predictable behavior.

**Alternatives considered**: None - pattern is well-established.

---

### 4. Icon Selection

**Context**: Need visually distinct icon for Summary button.

**Findings**:

#### Current Icons (from lucide-react)
| Button | Icon |
|--------|------|
| Spec | `FileText` |
| Plan | `Settings2` |
| Tasks | `CheckSquare` |

#### Candidate Icons for Summary
1. `FileOutput` - Suggested in spec, represents output/generated content
2. `ClipboardList` - Alternative, represents summary/report
3. `FileCode` - Code-related but less descriptive
4. `ScrollText` - Document/summary connotation

**Decision**: Use `FileOutput` icon.

**Rationale**:
- Visually distinct from `FileText` (Spec)
- Semantically appropriate (summary is output from implement)
- Consistent icon family (lucide-react File* icons)
- Already specified in feature spec

**Alternatives considered**:
- `ClipboardList` - rejected, less distinct from CheckSquare
- `ScrollText` - rejected, not in current icon family used

---

### 5. Read-Only Enforcement

**Context**: Summary must be read-only (no edit functionality).

**Findings**:

#### Current Permission System (edit-permission-guard.tsx)
```typescript
const EDIT_PERMISSIONS: EditPermission[] = [
  { stage: 'INBOX', allowedDocTypes: ['images'] },
  { stage: 'SPECIFY', allowedDocTypes: ['spec'] },
  { stage: 'PLAN', allowedDocTypes: ['plan', 'tasks'] },
];
```

#### DocumentationViewer Edit Logic (line 109)
```typescript
const userCanEdit = canEdit(ticketStage, docType);
// ...
{userCanEdit && (
  <Button onClick={() => setIsEditing(true)}>Edit</Button>
)}
```

**Decision**: Do NOT add 'summary' to EDIT_PERMISSIONS array.

**Rationale**:
- `canEdit()` returns `false` for any docType not in EDIT_PERMISSIONS
- Summary will automatically be read-only without explicit rejection
- No code change needed in edit-permission-guard.tsx

**Alternatives considered**:
- Explicit read-only flag - rejected, existing pattern handles it
- Special handling in DocumentationViewer - rejected, unnecessary complexity

---

### 6. useDocumentation Hook Compatibility

**Context**: Verify existing hook works with new 'summary' type.

**Findings**:

#### Hook Implementation (use-documentation.ts:43-58)
```typescript
async function fetchDocumentation(
  projectId: number,
  ticketId: number,
  docType: DocumentType
): Promise<DocumentContent> {
  const res = await fetch(
    `/api/projects/${projectId}/tickets/${ticketId}/${docType}`
  );
  // ...
}
```

**Decision**: No changes needed to useDocumentation hook.

**Rationale**:
- Hook uses dynamic URL construction with docType
- Adding 'summary' to DocumentType enum automatically enables the hook
- Query keys will be correct: `['documentation', projectId, ticketId, 'summary']`

**Alternatives considered**: None - hook is already generic.

---

## Summary of Required Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `lib/validations/documentation.ts` | MODIFY | Add 'summary' to DocumentTypeSchema enum |
| `components/board/documentation-viewer.tsx` | MODIFY | Add 'summary' to DocumentTypeLabels |
| `components/board/ticket-detail-modal.tsx` | MODIFY | Add Summary button with visibility logic |
| `app/api/projects/[projectId]/tickets/[id]/summary/route.ts` | NEW | GET endpoint for summary content |
| `tests/e2e/summary-button.spec.ts` | NEW | E2E tests for summary button |

## No Changes Required

| File | Reason |
|------|--------|
| `lib/hooks/use-documentation.ts` | Generic hook works with any DocumentType |
| `lib/hooks/use-documentation-history.ts` | Generic hook works with any DocumentType |
| `components/ticket/edit-permission-guard.tsx` | Summary excluded = read-only by default |
| Database schema | No new entities or fields needed |
