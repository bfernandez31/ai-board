# Data Model: Documentation Edit Mode

**Feature**: 036-mode-to-update
**Date**: 2025-10-18

## Overview

This feature introduces minimal new data structures as it primarily operates on existing entities (Ticket, Project) and file system data (markdown documentation files).

## Client-Side State Models

### DocumentEditSession

Represents an active editing session in the browser. NOT persisted to database.

```typescript
interface DocumentEditSession {
  ticketId: number;
  docType: 'spec' | 'plan' | 'tasks';
  originalContent: string;       // Content when edit mode started
  currentContent: string;         // Current state in textarea
  isDirty: boolean;               // Has content changed?
  isSaving: boolean;              // Save operation in progress?
  lastSavedAt: Date | null;       // Timestamp of last successful save
  error: string | null;           // Error message from last save attempt
}
```

**Validation Rules**:
- `docType` must be one of: 'spec', 'plan', 'tasks'
- `currentContent` max length: 1MB (1,048,576 characters)
- `isDirty` computed as: `originalContent !== currentContent`

**State Transitions**:
- **View Mode → Edit Mode**: Load file content, set `originalContent` and `currentContent`, `isDirty = false`
- **Editing**: Update `currentContent` on each keystroke, recalculate `isDirty`
- **Saving**: Set `isSaving = true`, call mutation, on success: `isSaving = false, lastSavedAt = now(), originalContent = currentContent, isDirty = false`
- **Save Error**: Set `isSaving = false, error = errorMessage`
- **Cancel**: Reset to view mode, discard changes

---

## API Request/Response Models

### POST /api/projects/:projectId/docs

**Request Body**:

```typescript
interface EditDocumentationRequest {
  ticketId: number;
  docType: 'spec' | 'plan' | 'tasks';
  content: string;
  commitMessage?: string;  // Optional, auto-generated if not provided
}
```

**Zod Schema** (`lib/schemas/documentation.ts`):

```typescript
import { z } from 'zod';

export const editDocumentationSchema = z.object({
  ticketId: z.number().int().positive(),
  docType: z.enum(['spec', 'plan', 'tasks']),
  content: z.string().max(1048576, 'Document content exceeds 1MB limit'),
  commitMessage: z.string().max(500).optional(),
});

export type EditDocumentationRequest = z.infer<typeof editDocumentationSchema>;
```

**Response** (Success - 200 OK):

```typescript
interface EditDocumentationResponse {
  success: true;
  commitSha: string;           // Git commit hash
  updatedAt: string;           // ISO 8601 timestamp
  message: string;             // Success message for user
}
```

**Response** (Error - 400, 403, 409, 500):

```typescript
interface EditDocumentationError {
  success: false;
  error: string;               // User-friendly error message
  code?: string;               // Error code for client-side handling
  details?: unknown;           // Additional context (dev mode only)
}
```

**Error Codes**:
- `PERMISSION_DENIED`: User doesn't own project or wrong ticket stage
- `BRANCH_NOT_FOUND`: Ticket's branch field is null or branch doesn't exist
- `VALIDATION_ERROR`: Invalid markdown syntax
- `MERGE_CONFLICT`: Push rejected due to concurrent changes
- `NETWORK_ERROR`: Git push operation failed
- `TIMEOUT`: Operation exceeded time limit

---

## File System Data

### Documentation Files

Markdown files stored in the git repository at:

```
specs/[ticketNumber]-[slug]/
├── spec.md      # Editable in SPECIFY stage
├── plan.md      # Editable in PLAN stage
└── tasks.md     # Editable in PLAN stage
```

**File Metadata** (tracked by git):

```typescript
interface DocumentationFile {
  path: string;                 // Relative path from repo root
  content: string;              // Markdown content
  lastCommitSha: string;        // Git commit hash
  lastModifiedBy: string;       // Git author from last commit
  lastModifiedAt: Date;         // Git commit timestamp
}
```

**Access Pattern**:

1. Read file from filesystem using ticket's branch name
2. Check branch existence: `git rev-parse --verify origin/{branchName}`
3. Checkout branch: `git checkout {branchName}`
4. Read file: `fs.readFile(path.join(repoRoot, 'specs', featureDir, docType + '.md'))`

---

## Database Schema (Existing - No Changes)

This feature uses existing database entities without modifications:

### Ticket (Existing)

```prisma
model Ticket {
  id          Int      @id @default(autoincrement())
  projectId   Int
  stage       Stage    @default(INBOX)
  branch      String?  @db.VarChar(200)  // Used to locate doc files
  // ... other fields
}
```

**Relevant Fields**:
- `branch`: Feature branch name (e.g., "036-mode-to-update")
- `stage`: Determines edit permissions (SPECIFY → spec.md, PLAN → plan.md/tasks.md)

### Project (Existing)

```prisma
model Project {
  id          Int     @id @default(autoincrement())
  userId      String                                 // Owner check for security
  githubOwner String  @db.VarChar(100)
  githubRepo  String  @db.VarChar(100)
  // ... other fields
}
```

**Relevant Fields**:
- `userId`: Validated against session to authorize git operations
- `githubOwner`, `githubRepo`: Used to construct git remote URL

---

## Permission Model

### Stage-Based Permissions

```typescript
interface EditPermission {
  stage: Stage;
  allowedDocTypes: ('spec' | 'plan' | 'tasks')[];
}

const EDIT_PERMISSIONS: EditPermission[] = [
  { stage: 'SPECIFY', allowedDocTypes: ['spec'] },
  { stage: 'PLAN', allowedDocTypes: ['plan', 'tasks'] },
  // Other stages: no editing allowed
];

function canEdit(ticketStage: Stage, docType: string): boolean {
  const permission = EDIT_PERMISSIONS.find(p => p.stage === ticketStage);
  return permission?.allowedDocTypes.includes(docType as any) ?? false;
}
```

**UI Behavior**:
- Edit button visible only when `canEdit(ticket.stage, docType)` returns `true`
- Attempting to edit unauthorized doc types returns 403 Forbidden

---

## Validation Summary

### Client-Side Validation
- Document type enum check
- Content length check (≤1MB)
- Dirty state tracking (prevent save if no changes)

### Server-Side Validation
- Zod schema validation (request shape)
- User ownership check (Project.userId === session.userId)
- Stage permission check (SPECIFY → spec only, PLAN → plan/tasks)
- Branch existence check (git rev-parse)
- Markdown syntax validation (remark parse)
- File size limit enforcement (1MB)

### Git-Level Validation
- Push conflict detection (reject if remote has new commits)
- Commit signature validation (author name/email from session)

---

## Caching Strategy

### TanStack Query Cache

```typescript
// Cache key structure
queryKeys.documentation(projectId, ticketId, docType)
// Example: ['projects', 1, 'tickets', 42, 'documentation', 'spec']
```

**Cache Behavior**:
- **Initial Load**: Fetch from `/api/projects/:projectId/tickets/:ticketId/docs/:docType` (GET endpoint from feature 035)
- **Optimistic Update**: Set cache immediately on save button click
- **Rollback on Error**: Restore previous cache value if save fails
- **Invalidate on Success**: Refetch from server to confirm git state

**Cache Invalidation**:
- After successful save operation
- When ticket stage changes (different docs become editable)
- On window focus (detect external file changes)

---

## Performance Considerations

### File Size Limits

- **Soft Limit**: 100KB (warn user, allow save)
- **Hard Limit**: 1MB (reject save, suggest splitting document)

### Throttling

- Edit mode content changes debounced at 300ms (reduce re-renders)
- Git operations timeout at 10s (Vercel function limit)
- Rate limit: 10 save operations per minute per user

### Lazy Loading

- Documentation content loaded only when viewer is opened
- Git operations run server-side (not blocking UI)
- Optimistic updates provide instant feedback

---

## Error Handling

### Error Recovery Flow

1. **Save Fails** → Show error toast with message
2. **User Fixes Issue** (e.g., refresh to get latest changes)
3. **Retry Save** → If succeeds, clear error state
4. **Persistent Errors** → Suggest external git resolution

### Data Loss Prevention

- Unsaved changes warning on:
  - Closing modal
  - Navigating away
  - Browser/tab close (`beforeunload` event)
- Auto-save draft to localStorage every 30s (future enhancement)

---

## Future Enhancements (Out of Scope)

- **Conflict Resolution UI**: Three-way merge interface for concurrent edits
- **Version History**: Browse past commits and restore previous versions
- **Collaborative Editing**: Real-time multi-user editing with operational transforms
- **Rich Markdown Editor**: Syntax highlighting, live preview, toolbar buttons
- **Auto-save**: Periodic background saves to prevent data loss
