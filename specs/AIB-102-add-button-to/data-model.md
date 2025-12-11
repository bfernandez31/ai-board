# Data Model: Add Button to Consult Summary

**Feature Branch**: `AIB-102-add-button-to`
**Date**: 2025-12-11

## Entity Changes

### No Database Schema Changes Required

This feature extends existing patterns without requiring new database entities or fields.

## Type Definition Changes

### DocumentType (lib/validations/documentation.ts)

**Current**:
```typescript
export const DocumentTypeSchema = z.enum(['spec', 'plan', 'tasks']);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;
```

**Updated**:
```typescript
export const DocumentTypeSchema = z.enum(['spec', 'plan', 'tasks', 'summary']);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;
```

### DocumentTypeLabels (components/board/documentation-viewer.tsx)

**Current**:
```typescript
const DocumentTypeLabels: Record<DocumentType, string> = {
  spec: 'Specification',
  plan: 'Implementation Plan',
  tasks: 'Task Breakdown',
};
```

**Updated**:
```typescript
const DocumentTypeLabels: Record<DocumentType, string> = {
  spec: 'Specification',
  plan: 'Implementation Plan',
  tasks: 'Task Breakdown',
  summary: 'Implementation Summary',
};
```

## File Location Patterns

### Summary File Path

```
specs/{branch-name}/summary.md
```

**Examples**:
- `specs/AIB-102-add-button-to/summary.md`
- `specs/123-user-auth/summary.md`

### Branch Resolution

| Stage | Source Branch |
|-------|---------------|
| BUILD | Feature branch (`ticket.branch`) |
| VERIFY | Feature branch (`ticket.branch`) |
| SHIP | Main branch ('main') |

## Validation Rules

### Summary Content Validation (inherits from DocumentContentSchema)

```typescript
{
  content: z.string().min(1).max(1048576),  // Max 1MB
  metadata: {
    ticketId: z.number().int().positive(),
    branch: z.string().min(1).max(200),
    projectId: z.number().int().positive(),
    docType: z.literal('summary'),
    fileName: z.literal('summary.md'),
    filePath: z.string().regex(/^specs\/[^/]+\/summary\.md$/),
    fetchedAt: z.string().datetime(),
  }
}
```

## Job Command Mapping

| Document | Required Job Command | Required Job Status |
|----------|---------------------|---------------------|
| spec | 'specify' | 'COMPLETED' |
| plan | 'plan' | 'COMPLETED' |
| tasks | 'plan' | 'COMPLETED' |
| **summary** | **'implement'** | **'COMPLETED'** |

## State Transitions

### Button Visibility State Machine

```
INBOX (no button)
  ↓ drag to SPECIFY
SPECIFY (job running → job complete)
  ↓ drag to PLAN
PLAN (job running → job complete)
  ↓ drag to BUILD
BUILD (implement job running → implement job complete → SUMMARY BUTTON VISIBLE)
  ↓ drag to VERIFY
VERIFY (SUMMARY BUTTON VISIBLE)
  ↓ drag to SHIP
SHIP (SUMMARY BUTTON VISIBLE, fetches from main branch)
```

## Relationships

```
Project (1) ←→ (N) Ticket
Ticket (1) ←→ (N) Job
Job.command = 'implement' ←→ Summary visibility
Ticket.workflowType = 'FULL' ←→ Summary visibility
```

## Constraints

1. **Workflow Type**: Summary button only appears for `workflowType === 'FULL'`
2. **Job Completion**: Requires `implement` job with `status === 'COMPLETED'`
3. **Branch Assignment**: Requires `ticket.branch` to be non-null
4. **Read-Only**: Summary documents cannot be edited (not in EDIT_PERMISSIONS)
