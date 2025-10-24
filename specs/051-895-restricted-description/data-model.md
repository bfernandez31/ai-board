# Data Model: Stage-Based Ticket Editing Restrictions

**Feature**: Restricted Ticket Editing by Stage
**Date**: 2025-10-24
**Status**: Complete

## Overview

This feature does NOT require any database schema changes. It leverages existing Prisma schema fields with new validation logic enforced at the application layer (API routes and client components).

## Existing Entities

### Ticket

The core entity for work items in the AI Board system.

**Relevant Fields**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | Int | Primary Key, Auto-increment | Unique ticket identifier |
| `stage` | Stage (enum) | NOT NULL, default: INBOX | Current workflow stage (INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP) |
| `description` | String | NOT NULL, max 1000 chars | Ticket description - **EDITABLE ONLY IN INBOX** |
| `clarificationPolicy` | ClarificationPolicy (enum) | NULLABLE | Ticket-level policy override - **EDITABLE ONLY IN INBOX** |
| `version` | Int | NOT NULL, default: 1 | Optimistic concurrency control version |
| `projectId` | Int | Foreign Key (Project.id), NOT NULL | Project association |
| `title` | String | NOT NULL, max 100 chars | Ticket title (NOT restricted by this feature) |
| `branch` | String | NULLABLE, max 200 chars | Git branch name (NOT restricted by this feature) |
| `autoMode` | Boolean | NOT NULL, default: false | Auto-progression flag (NOT restricted by this feature) |
| `workflowType` | WorkflowType (enum) | NOT NULL, default: FULL | Workflow path indicator (NOT restricted by this feature) |
| `createdAt` | DateTime | NOT NULL, auto-generated | Creation timestamp |
| `updatedAt` | DateTime | NOT NULL, auto-updated | Last modification timestamp |

**Stage Enum Values**:
- `INBOX`: Initial stage, all fields editable
- `SPECIFY`: Specification stage, description/policy read-only
- `PLAN`: Planning stage, description/policy read-only
- `BUILD`: Implementation stage, description/policy read-only
- `VERIFY`: Verification stage, description/policy read-only
- `SHIP`: Shipped stage, description/policy read-only

**ClarificationPolicy Enum Values** (from `@prisma/client`):
- `AUTO`: Context-aware clarification mode
- `CONSERVATIVE`: Security-first clarification mode
- `PRAGMATIC`: Speed-first clarification mode
- `INTERACTIVE`: Manual clarification mode

### Project

Project entity that owns tickets and provides default clarification policy.

**Relevant Fields**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | Int | Primary Key, Auto-increment | Unique project identifier |
| `clarificationPolicy` | ClarificationPolicy (enum) | NOT NULL, default: AUTO | Project-wide default policy |
| `name` | String | NOT NULL | Project name |
| `githubOwner` | String | NOT NULL | GitHub repository owner |
| `githubRepo` | String | NOT NULL | GitHub repository name |

**Relationship**: Project → Tickets (one-to-many)

## Validation Logic (Application Layer)

### Stage-Based Edit Permissions

**Business Rule**: Ticket `description` and `clarificationPolicy` fields can only be updated when `stage = 'INBOX'`.

**Implementation**: No database constraints enforced at schema level. Validation enforced at two layers:

1. **Server-side** (API route handler):
   - PATCH `/api/projects/[projectId]/tickets/[id]` validates stage before accepting description/policy updates
   - Returns 400 error if stage is not INBOX and description/policy update attempted
   - Validation occurs before Prisma transaction, preventing invalid state

2. **Client-side** (UI components):
   - Conditional rendering hides/disables edit controls when stage is not INBOX
   - Policy edit button hidden entirely for non-INBOX stages
   - Description field rendered as read-only text for non-INBOX stages

### Validation Utility Function

**Function Signature** (to be implemented in `/app/lib/utils/stage-validation.ts`):

```typescript
/**
 * Determines if description and clarification policy can be edited based on ticket stage
 * @param stage - Current ticket stage
 * @returns true if stage is INBOX, false otherwise
 */
export function canEditDescriptionAndPolicy(stage: Stage): boolean {
  return stage === 'INBOX';
}
```

**Usage**:
- API validation: `if (!canEditDescriptionAndPolicy(currentTicket.stage)) { return 400 error }`
- UI rendering: `const isEditable = canEditDescriptionAndPolicy(ticket.stage)`

## State Transitions

### Editable → Read-Only Transition (INBOX → any other stage)

**Trigger**: User or system transitions ticket from INBOX to SPECIFY, PLAN, BUILD, VERIFY, or SHIP

**Effects**:
1. **Database**: `stage` field updated atomically
2. **Validation**: Future description/policy update attempts rejected by API
3. **UI**: Real-time polling (2s interval) detects stage change
4. **Rendering**: Description field switches to read-only display, policy button disappears

**Data Integrity**: Description and policy values remain unchanged during transition. Only edit permissions change.

### Read-Only → Editable Transition (non-INBOX → INBOX)

**Trigger**: User or system transitions ticket back to INBOX (e.g., SPECIFY → INBOX rollback)

**Effects**:
1. **Database**: `stage` field updated to INBOX
2. **Validation**: Description/policy update attempts now accepted by API
3. **UI**: Real-time polling detects stage change
4. **Rendering**: Description field switches to editable Textarea, policy button reappears

**Use Case**: Ticket needs requirement refinement after entering specification phase

## Version Control Integration

### Optimistic Concurrency Control

The `version` field provides conflict detection for concurrent edits:

**Current Behavior** (unchanged by this feature):
1. Client reads ticket with `version: N`
2. Client sends update with `version: N` in request body
3. API validates `currentTicket.version === requestVersion`
4. If match: Update applied with `version: N+1`
5. If mismatch: 409 Conflict error returned, update rejected

**Integration with Stage Validation**:
- Stage validation occurs **before** version check
- Invalid stage returns 400 (not 409)
- Version only incremented if stage validation passes

**Example Conflict Scenario**:
```
Time T0: User A fetches ticket (stage: INBOX, version: 1)
Time T1: User B transitions ticket to SPECIFY (stage: SPECIFY, version: 2)
Time T2: User A attempts description edit (version: 1)
Result: 400 Bad Request (stage validation fails before version check)
```

## Field Update Rules Summary

| Field | INBOX Stage | Non-INBOX Stages | Validation Layer |
|-------|-------------|------------------|------------------|
| `description` | ✅ Editable | ❌ Read-only | Server + Client |
| `clarificationPolicy` | ✅ Editable | ❌ Read-only | Server + Client |
| `title` | ✅ Editable | ✅ Editable | Client only (out of scope) |
| `stage` | ✅ Editable | ✅ Editable | Existing stage transition validation |
| `branch` | ✅ Editable | ✅ Editable | No restrictions (out of scope) |
| `autoMode` | ✅ Editable | ✅ Editable | No restrictions (out of scope) |

## Schema Stability

**No Migrations Required**: Feature implementation does not require any Prisma migrations.

**Backward Compatibility**: Existing API clients continue to work. Only change is new validation rule for description/policy updates in non-INBOX stages.

**Rollback Plan**: If feature needs rollback, simply remove validation logic from API route. No database state cleanup required.

## Query Patterns

### Existing Queries (unchanged)

**Fetch Ticket with Project** (used by PATCH endpoint):
```typescript
const ticket = await prisma.ticket.findFirst({
  where: {
    id: ticketId,
    projectId: projectId,
  },
  include: {
    project: {
      select: {
        id: true,
        name: true,
        clarificationPolicy: true,
      },
    },
  },
});
```

**Update Ticket with Version Control** (existing pattern):
```typescript
const updatedTicket = await prisma.ticket.update({
  where: {
    id: ticketId,
    version: requestVersion,
  },
  data: {
    description: newDescription,
    version: { increment: 1 },
    updatedAt: new Date(),
  },
});
```

**New Validation Logic** (before update):
```typescript
// Reject description/policy updates in non-INBOX stages
if ((description !== undefined || clarificationPolicy !== undefined)
    && currentTicket.stage !== 'INBOX') {
  return NextResponse.json(
    {
      error: 'Description and clarification policy can only be updated in INBOX stage',
      code: 'INVALID_STAGE_FOR_EDIT'
    },
    { status: 400 }
  );
}
```

## Performance Impact

**Database Impact**: None (no additional queries, no index changes)
**API Response Time**: +0.1-0.5ms for stage validation check (negligible)
**Client Rendering**: No measurable impact (simple conditional rendering)

## Security Considerations

**Data Integrity**: Server-side validation prevents unauthorized description/policy changes via API bypass
**Authorization**: Existing project ownership validation (via `verifyProjectOwnership()`) remains enforced
**Audit Trail**: `updatedAt` timestamp tracks when fields were last modified (before stage restriction enforcement)

## Conclusion

This feature implements stage-based editing restrictions purely at the application logic layer. No database schema changes required. Validation logic uses existing Prisma fields (`stage`, `description`, `clarificationPolicy`) with new conditional rules enforced in API routes and UI components. Version control integration ensures conflict detection works seamlessly with stage validation.
