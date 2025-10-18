# Data Model: View Plan and Tasks Documentation

**Feature**: 035-view-plan-and
**Date**: 2025-10-18
**Purpose**: Entity definitions and data relationships for documentation viewing feature

## Overview

This feature operates entirely on existing database entities (Ticket, Job, Project) without requiring schema changes. All data structures are TypeScript interfaces for runtime validation and API contract definition.

## Database Entities (Existing - No Changes)

### Ticket

**Purpose**: Represents a work item in the project board

**Existing Fields Used**:
- `id`: number (Primary key, used to fetch documentation)
- `projectId`: number (Foreign key to Project, used for authorization)
- `stage`: Stage enum (INBOX | SPECIFY | PLAN | BUILD | VERIFY | SHIP)
  - Used to determine branch selection logic (SHIP → main, others → feature branch)
- `workflowType`: WorkflowType enum (FULL | QUICK)
  - Used to determine button visibility (FULL shows plan/tasks, QUICK hides them)
- `branch`: string | null
  - Git branch name containing documentation files
  - Used as GitHub ref parameter when fetching files
  - Null when branch not yet created (buttons disabled)

**No Schema Changes Required** ✅

---

### Job

**Purpose**: Tracks GitHub Actions workflow execution status

**Existing Fields Used**:
- `id`: number (Primary key)
- `ticketId`: number (Foreign key to Ticket)
- `command`: string ('specify' | 'plan' | 'tasks' | 'quick-impl')
  - Used to filter for completed plan job
- `status`: JobStatus enum (PENDING | RUNNING | COMPLETED | FAILED | CANCELLED)
  - Used to check if plan job is completed (button visibility condition)

**Query Pattern**:
```typescript
// Check if ticket has completed plan job
const hasCompletedPlanJob = jobs.some(
  job => job.command === 'plan' && job.status === 'COMPLETED'
);
```

**No Schema Changes Required** ✅

---

### Project

**Purpose**: Represents a GitHub repository

**Existing Fields Used**:
- `id`: number (Primary key)
- `githubOwner`: string (GitHub organization/user)
- `githubRepo`: string (Repository name)
  - Used together to construct GitHub API requests

**No Schema Changes Required** ✅

---

## TypeScript Interfaces (New)

### DocumentType

**Purpose**: Type-safe enumeration of documentation types

```typescript
/**
 * Supported documentation types for viewing
 */
export type DocumentType = 'spec' | 'plan' | 'tasks';

/**
 * Human-readable labels for documentation types
 */
export const DocumentTypeLabels: Record<DocumentType, string> = {
  spec: 'Specification',
  plan: 'Implementation Plan',
  tasks: 'Task Breakdown',
};

/**
 * File names for documentation types
 */
export const DocumentTypeFiles: Record<DocumentType, string> = {
  spec: 'spec.md',
  plan: 'plan.md',
  tasks: 'tasks.md',
};
```

**Validation Rules**:
- Must be one of: 'spec' | 'plan' | 'tasks'
- Case-sensitive
- No whitespace allowed

---

### DocumentContent

**Purpose**: Response type for documentation API endpoints

```typescript
/**
 * Documentation content response from API
 */
export interface DocumentContent {
  /** Markdown content of the documentation file */
  content: string;

  /** Metadata about the fetched document */
  metadata: {
    /** Ticket ID */
    ticketId: number;

    /** Git branch from which file was fetched */
    branch: string;

    /** Project ID for authorization context */
    projectId: number;

    /** Document type (spec, plan, or tasks) */
    docType: DocumentType;

    /** File name (e.g., 'plan.md') */
    fileName: string;

    /** Full file path in repository (e.g., 'specs/035-view-plan-and/plan.md') */
    filePath: string;

    /** Timestamp when content was fetched (ISO 8601) */
    fetchedAt: string;
  };
}
```

**Validation Rules**:
- `content`: Non-empty string, max 1MB (1048576 bytes)
- `metadata.ticketId`: Positive integer
- `metadata.branch`: Non-empty string, max 200 chars
- `metadata.projectId`: Positive integer
- `metadata.docType`: Valid DocumentType
- `metadata.fileName`: Matches `${docType}.md` pattern
- `metadata.filePath`: Matches `specs/${branch}/${fileName}` pattern
- `metadata.fetchedAt`: Valid ISO 8601 timestamp

---

### DocumentFetchParams

**Purpose**: Parameters for GitHub API document fetching

```typescript
/**
 * Parameters for fetching documentation from GitHub
 */
export interface DocumentFetchParams {
  /** GitHub repository owner/organization */
  owner: string;

  /** GitHub repository name */
  repo: string;

  /** Git branch or commit ref */
  branch: string;

  /** Document type to fetch */
  docType: DocumentType;
}
```

**Validation Rules**:
- `owner`: Non-empty string, max 100 chars, alphanumeric + hyphens
- `repo`: Non-empty string, max 100 chars, alphanumeric + hyphens/underscores
- `branch`: Non-empty string, max 200 chars, valid git ref format
- `docType`: Valid DocumentType enum value

---

### DocumentError

**Purpose**: Structured error responses for documentation API

```typescript
/**
 * Error response from documentation API
 */
export interface DocumentError {
  /** Human-readable error message */
  error: string;

  /** Machine-readable error code for client logic */
  code: DocumentErrorCode;

  /** Optional additional context (not shown to end users) */
  message?: string;
}

/**
 * Error codes for documentation API
 */
export enum DocumentErrorCode {
  /** Invalid projectId or ticketId */
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  /** Project not found */
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',

  /** Ticket not found */
  TICKET_NOT_FOUND = 'TICKET_NOT_FOUND',

  /** Ticket belongs to different project */
  WRONG_PROJECT = 'WRONG_PROJECT',

  /** Ticket has no branch assigned */
  BRANCH_NOT_ASSIGNED = 'BRANCH_NOT_ASSIGNED',

  /** Documentation file not found on GitHub */
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',

  /** Documentation not available yet (job not completed) */
  NOT_AVAILABLE_YET = 'NOT_AVAILABLE_YET',

  /** Documentation not merged to main (SHIP stage only) */
  NOT_MERGED = 'NOT_MERGED',

  /** GitHub API rate limit exceeded */
  RATE_LIMIT = 'RATE_LIMIT',

  /** GitHub API error */
  GITHUB_API_ERROR = 'GITHUB_API_ERROR',

  /** Internal server error */
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
```

**Error Handling Matrix**:

| Error Code              | HTTP Status | User Message                                          |
|-------------------------|-------------|------------------------------------------------------|
| VALIDATION_ERROR        | 400         | "Invalid request parameters"                         |
| PROJECT_NOT_FOUND       | 404         | "Project not found"                                  |
| TICKET_NOT_FOUND        | 404         | "Ticket not found"                                   |
| WRONG_PROJECT           | 403         | "Access denied"                                      |
| BRANCH_NOT_ASSIGNED     | 404         | "Documentation not available (branch not created)"   |
| FILE_NOT_FOUND          | 404         | "Documentation file not found"                       |
| NOT_AVAILABLE_YET       | 404         | "Documentation not generated yet. Wait for job."     |
| NOT_MERGED              | 404         | "Documentation not yet merged to main branch"        |
| RATE_LIMIT              | 429         | "Too many requests. Please try again later."         |
| GITHUB_API_ERROR        | 500         | "Failed to fetch documentation. Please try again."   |
| INTERNAL_ERROR          | 500         | "Internal server error"                              |

---

## Component Prop Interfaces

### DocumentationViewerProps

**Purpose**: Props for DocumentationViewer React component

```typescript
/**
 * Props for DocumentationViewer component
 */
export interface DocumentationViewerProps {
  /** Ticket ID to fetch documentation for */
  ticketId: number;

  /** Project ID for API authorization */
  projectId: number;

  /** Ticket title for display in modal header */
  ticketTitle: string;

  /** Document type to display (spec, plan, or tasks) */
  docType: DocumentType;

  /** Whether the modal is open */
  open: boolean;

  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
}
```

**Validation Rules**:
- `ticketId`: Positive integer
- `projectId`: Positive integer
- `ticketTitle`: Non-empty string, max 200 chars
- `docType`: Valid DocumentType
- `open`: Boolean
- `onOpenChange`: Function that accepts boolean

---

### DocumentationButtonProps

**Purpose**: Props for documentation action buttons in TicketDetailModal

```typescript
/**
 * Props for documentation buttons (View Spec, View Plan, View Tasks)
 */
export interface DocumentationButtonProps {
  /** Document type for this button */
  docType: DocumentType;

  /** Whether button should be visible */
  visible: boolean;

  /** Callback when button is clicked */
  onClick: () => void;

  /** Icon component to display (lucide-react icon) */
  icon: React.ComponentType<{ className?: string }>;

  /** Button label text */
  label: string;
}
```

---

## Validation Schemas (Zod)

### DocumentType Schema

```typescript
import { z } from 'zod';

/**
 * Zod schema for DocumentType validation
 */
export const DocumentTypeSchema = z.enum(['spec', 'plan', 'tasks']);

/**
 * Infer TypeScript type from schema
 */
export type DocumentTypeInferred = z.infer<typeof DocumentTypeSchema>;
```

---

### DocumentContent Response Schema

```typescript
import { z } from 'zod';

/**
 * Zod schema for DocumentContent API response
 */
export const DocumentContentSchema = z.object({
  content: z.string().min(1).max(1048576), // Max 1MB
  metadata: z.object({
    ticketId: z.number().int().positive(),
    branch: z.string().min(1).max(200),
    projectId: z.number().int().positive(),
    docType: DocumentTypeSchema,
    fileName: z.string().regex(/^(spec|plan|tasks)\.md$/),
    filePath: z.string().regex(/^specs\/[^/]+\/(spec|plan|tasks)\.md$/),
    fetchedAt: z.string().datetime(),
  }),
});
```

---

## State Management (TanStack Query)

### Query Keys

```typescript
/**
 * Query key factory for documentation queries
 */
export const documentationKeys = {
  /** All documentation queries */
  all: ['documentation'] as const,

  /** All docs for a specific project */
  project: (projectId: number) => ['documentation', projectId] as const,

  /** All docs for a specific ticket */
  ticket: (projectId: number, ticketId: number) =>
    ['documentation', projectId, ticketId] as const,

  /** Specific document for a ticket */
  document: (projectId: number, ticketId: number, docType: DocumentType) =>
    ['documentation', projectId, ticketId, docType] as const,
};
```

**Cache Strategy**:
- Stale time: 5 minutes (documentation rarely changes within session)
- Cache time: 30 minutes (keep in cache even when not in use)
- Refetch on window focus: false (avoid unnecessary GitHub API calls)
- Retry: 2 attempts with exponential backoff

---

### Query State Interface

```typescript
/**
 * TanStack Query state for documentation fetching
 */
export interface DocumentationQueryState {
  /** Documentation content (null until loaded) */
  data: DocumentContent | null;

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: DocumentError | null;

  /** Whether query is currently fetching */
  isFetching: boolean;

  /** Refetch function to manually trigger reload */
  refetch: () => void;
}
```

---

## Data Flow Diagrams

### Fetch Documentation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User clicks "View Plan" button in TicketDetailModal        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ DocumentationViewer opens with docType='plan'               │
│ - ticketId, projectId, ticketTitle passed as props         │
│ - TanStack Query hook triggered                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ useDocumentation hook checks cache                          │
│ - Query key: ['documentation', projectId, ticketId, 'plan']│
│ - Cache hit? Return cached data                            │
│ - Cache miss? Trigger API fetch                            │
└────────────────────────┬────────────────────────────────────┘
                         │ (cache miss)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ API: GET /api/projects/{projectId}/tickets/{ticketId}/plan │
│ 1. Validate projectId and ticketId (Zod)                   │
│ 2. Fetch ticket with project and jobs                      │
│ 3. Verify ticket belongs to project (403 if not)           │
│ 4. Determine branch (SHIP → main, else → ticket.branch)    │
│ 5. Call fetchDocumentContent() with GitHub params          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ fetchDocumentContent() in lib/github/doc-fetcher.ts        │
│ 1. Check TEST_MODE (return mock data if true)              │
│ 2. Initialize Octokit with GITHUB_TOKEN                    │
│ 3. Fetch file: specs/{branch}/plan.md                      │
│ 4. Decode base64 content                                   │
│ 5. Return markdown string                                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ API returns DocumentContent response                        │
│ - content: markdown string                                  │
│ - metadata: ticketId, branch, projectId, docType, etc.     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ TanStack Query caches response and updates component state │
│ - data: DocumentContent                                     │
│ - isLoading: false                                          │
│ - error: null                                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ DocumentationViewer renders markdown content                │
│ - react-markdown with syntax highlighting                  │
│ - ScrollArea for large documents                           │
│ - Modal with ticket title in header                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

**Database Changes**: None required ✅

**New TypeScript Interfaces**: 7 (DocumentType, DocumentContent, DocumentFetchParams, DocumentError, DocumentationViewerProps, DocumentationButtonProps, DocumentationQueryState)

**Validation Schemas**: 2 Zod schemas (DocumentTypeSchema, DocumentContentSchema)

**Query Keys**: 1 factory function with 4 key generators

**Data Flow**: Simple read-only flow with TanStack Query caching and GitHub API integration
