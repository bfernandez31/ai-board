# API Schemas & Validation

Zod validation schemas for request/response data with complete field specifications.

## Validation Strategy

- **Double Validation**: Client and server both validate using same Zod schemas
- **Location**: `app/lib/schemas/` directory
- **Export Pattern**: Schemas exported for use in API routes and client code
- **Error Format**: Zod validation errors automatically formatted to user-friendly messages

## Ticket Schemas

### CreateTicketSchema

```typescript
import { z } from 'zod';

const ticketTitleRegex = /^[a-zA-Z0-9\s.,?!\-:;'"()\[\]{}/\\@#$%&*+=_~`|]+$/;

export const createTicketSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(100, 'Title must be 100 characters or less')
    .regex(ticketTitleRegex, 'Title contains invalid characters'),

  description: z.string()
    .min(1, 'Description is required')
    .max(10000, 'Description must be 10000 characters or less'),

  agent: z.nativeEnum(Agent).nullable().optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
```

**Validation Rules**:
- **title**: Required, 1-100 characters, alphanumeric + basic punctuation only
- **description**: Required, 1-10000 characters, all UTF-8 characters allowed
- **agent**: Optional, nullable — `CLAUDE`, `CODEX`, or omitted/`null` to inherit project default

**Rejected Characters (title)**:
- Emojis (🚀, 😀, etc.)
- Extended Unicode beyond basic punctuation
- Control characters

**Allowed Characters (description)**:
- All UTF-8: emoji, Chinese (中文), Arabic (العربية), Japanese (日本語), etc.
- Feature added in ticket #048

### UpdateTicketSchema

```typescript
export const updateTicketSchema = z.object({
  title: z.string()
    .min(1)
    .max(100)
    .regex(ticketTitleRegex)
    .optional(),

  description: z.string()
    .min(1)
    .max(10000)
    .optional(),

  clarificationPolicy: z.enum(['AUTO', 'CONSERVATIVE', 'PRAGMATIC', 'INTERACTIVE'])
    .nullable()
    .optional(),

  agent: z.nativeEnum(Agent).nullable().optional(),

  version: z.number().int().positive(),
});

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
```

**Stage-Based Validation**:
- **description**: Editable ONLY in INBOX stage (API enforced)
- **clarificationPolicy**: Editable ONLY in INBOX stage (API enforced)
- **agent**: Editable ONLY in INBOX stage (API enforced; follows same rules as clarificationPolicy)
- **version**: Always required for optimistic concurrency control

### TransitionRequestSchema

```typescript
export const StageSchema = z.enum([
  'INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP', 'CLOSED',
]);

export const TransitionRequestSchema = z.object({
  targetStage: StageSchema,
});

export type TransitionRequest = z.infer<typeof TransitionRequestSchema>;
```

**Validation**:
- **targetStage**: Must be valid Stage enum value (includes CLOSED)
- Additional business logic validation in API route (sequential progression, job completion)

### UpdateBranchSchema

```typescript
export const updateBranchSchema = z.object({
  branch: z.string().max(200).nullable(),
});

export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
```

**Validation**:
- **branch**: Max 200 characters or null
- No version checking (workflow-only endpoint)

### DeleteTicketSchema

```typescript
export const deleteTicketParamsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  id: z.coerce.number().int().positive(),
});

export type DeleteTicketParams = z.infer<typeof deleteTicketParamsSchema>;
```

**Validation**:
- **projectId**: Positive integer (path parameter)
- **id**: Positive integer (path parameter)
- No request body required

**Business Validation** (performed in API route, not schema):
- Ticket cannot be in SHIP stage
- Ticket cannot have PENDING or RUNNING jobs
- GitHub artifacts (PRs, branch) must be deleted before database deletion

### UpdatePreviewUrlSchema

```typescript
// app/lib/schemas/deploy-preview.ts
export const previewUrlSchema = z
  .string()
  .url('Must be a valid URL')
  .regex(
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/,
    'Must be a valid Vercel preview URL (https://*.vercel.app)'
  )
  .max(500, 'Preview URL must be ≤500 characters');

// Inline in route handler
const updatePreviewUrlSchema = z.object({
  previewUrl: previewUrlSchema,
});

export type UpdatePreviewUrlInput = z.infer<typeof updatePreviewUrlSchema>;
```

**Validation Rules**:
- **previewUrl**: Required string (not nullable), max 500 characters, HTTPS-only, valid URL, Vercel domain pattern (`https://*.vercel.app`)
- **Pattern**: `^https:\/\/[a-z0-9-]+\.vercel\.app$`
- Rejects non-HTTPS URLs, non-Vercel domains, and malformed URLs
- **Note**: Schema is defined in `app/lib/schemas/deploy-preview.ts` and imported by the route handler

## Search Schemas

### SearchTicketsSchema

```typescript
export const searchTicketsSchema = z.object({
  q: z.string()
    .min(2, 'Search query must be at least 2 characters')
    .max(100, 'Search query must be 100 characters or less'),

  limit: z.coerce.number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(20),
});

export type SearchTicketsInput = z.infer<typeof searchTicketsSchema>;
```

**Validation Rules**:
- **q**: Search query string, 2-100 characters required
- **limit**: Optional result limit (default: 20, max: 50)

**Usage**:
- Used by `/api/projects/:projectId/tickets/search` endpoint
- Query parameter validation before database query
- Prevents empty searches and excessive result sets
- Supports ticket autocomplete in comment textarea (#autocomplete)

### SearchResultSchema

```typescript
export const searchResultSchema = z.object({
  id: z.number().int().positive(),
  ticketKey: z.string().min(1),
  title: z.string().min(1),
  stage: z.enum(['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP', 'CLOSED']),
});

export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
  totalCount: z.number().int().nonnegative(),
});

export type SearchResult = z.infer<typeof searchResultSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
```

**Response Structure**:
- **results**: Array of matching tickets with minimal fields
- **totalCount**: Number of results returned (capped at limit)

**Fields**:
- **id**: Ticket ID for modal navigation
- **ticketKey**: Human-readable identifier (e.g., "ABC-42")
- **title**: Ticket title for display
- **stage**: Current workflow stage enum (includes CLOSED for closed tickets)

**Usage Context**:
- Ticket search results in search bar
- Ticket autocomplete dropdown in comments (#autocomplete)
- Both use same schema for consistency

### CloseTicketSchema

```typescript
export const closeTicketParamsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  id: z.coerce.number().int().positive(),
});

export type CloseTicketParams = z.infer<typeof closeTicketParamsSchema>;
```

**Validation**:
- **projectId**: Positive integer (path parameter)
- **id**: Positive integer (path parameter)
- No request body required

**Business Validation** (performed in API route, not schema):
- Ticket must be in VERIFY stage
- Ticket cannot have PENDING or RUNNING jobs
- All open GitHub PRs for ticket branch will be closed
- Git branch preserved (not deleted)

## AI-BOARD Command Schemas

### AIBoardCommandSchema

```typescript
export interface AIBoardCommand {
  name: string;
  description: string;
}
```

**Data Structure**:
- Static command definitions stored in `/app/lib/data/ai-board-commands.ts`
- Commands displayed in autocomplete after @ai-board mention
- No API endpoint; client-side filtering only

**Example Commands**:
```typescript
export const AI_BOARD_COMMANDS: AIBoardCommand[] = [
  {
    name: '/compare',
    description: 'Compare ticket implementations for best code quality',
  },
];
```

**Validation Rules**:
- **name**: Must start with `/` prefix
- **description**: Max 60 characters for dropdown display
- Commands are user-invocable (excludes internal system commands)

**Filter Function**:
```typescript
export function filterCommands(query: string): AIBoardCommand[] {
  if (!query) return AI_BOARD_COMMANDS;

  const q = query.toLowerCase();
  return AI_BOARD_COMMANDS.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q)
  );
}
```

**Usage**:
- Command autocomplete in comment textarea (/autocomplete)
- Triggered only after @ai-board mention
- Client-side filtering for fast responsiveness

## Comment Schemas

### CreateCommentSchema

```typescript
export const createCommentSchema = z.object({
  content: z.string()
    .min(1, 'Comment cannot be empty')
    .max(2000, 'Comment must be 2000 characters or less'),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
```

**Features**:
- Markdown formatting supported
- User mentions via `@[userId:displayName]` syntax
- HTML escaping enabled (XSS protection)

### AIBoardCommentRequestSchema

```typescript
export const aiBoardCommentRequestSchema = z.object({
  content: z.string()
    .min(1, 'Comment content cannot be empty')
    .max(2000, 'Comment content cannot exceed 2000 characters'),

  userId: z.string().min(1, 'User ID is required'),
});

export type AIBoardCommentRequest = z.infer<typeof aiBoardCommentRequestSchema>;
```

**Location**: `app/lib/schemas/ai-board-comment.ts`

**Validation**:
- **userId**: Any non-empty string (verified server-side)
- Used by GitHub Actions workflows for AI-BOARD comment posting

## Job Schemas

### JobStatusResponseSchema (Polling)

```typescript
export const JobStatusDtoSchema = z.object({
  id: z.number(),
  ticketId: z.number(),
  status: z.enum(['PENDING', 'RUNNING']),  // Only active statuses returned
  command: z.string(),
  updatedAt: z.string().datetime(),
});

export const JobStatusResponseSchema = z.object({
  jobs: z.array(JobStatusDtoSchema),
});
```

**Location**: `app/lib/schemas/job-polling.ts`

**Notes**:
- The GET `/api/projects/:projectId/jobs/status` endpoint only returns PENDING and RUNNING jobs
- Terminal jobs (COMPLETED, FAILED, CANCELLED) are excluded from the response to minimize payload
- The frontend detects completion when a previously-polled job disappears from the response

### UpdateJobStatusSchema

```typescript
export const updateJobStatusSchema = z.object({
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
});

export type UpdateJobStatusInput = z.infer<typeof updateJobStatusSchema>;
```

**State Machine**:
- Valid transitions enforced in API route (not schema)
- Terminal states (COMPLETED, FAILED, CANCELLED) cannot transition
- Idempotent updates allowed (same status returns 200)

## Project Schemas

### UpdateProjectSchema

```typescript
export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),

  description: z.string().nullable().optional(),

  clarificationPolicy: z.enum(['AUTO', 'CONSERVATIVE', 'PRAGMATIC', 'INTERACTIVE']).optional(),

  defaultAgent: z.nativeEnum(Agent).optional(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
```

**Validation**:
- **clarificationPolicy**: NOT NULL at database level, default: AUTO
- **defaultAgent**: NOT NULL at database level, default: CLAUDE; must be a valid `Agent` enum value when provided
- Updates are partial (all fields optional)

## Image Attachment Schemas

### UploadImageSchema

```typescript
export const uploadImageSchema = z.object({
  file: z.instanceof(File)
    .refine((file) => file.size <= 10 * 1024 * 1024, 'File must be 10MB or smaller')
    .refine(
      (file) => ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'].includes(file.type),
      'Only JPEG, PNG, GIF, WebP, and SVG images are allowed'
    ),
});

export type UploadImageInput = z.infer<typeof uploadImageSchema>;
```

**Validation**:
- **Max Size**: 10MB (10485760 bytes)
- **Formats**: JPEG, PNG, GIF, WebP, SVG
- **Stage Restriction**: SPECIFY and PLAN only (enforced in API route)

### TicketAttachment Interface

```typescript
interface TicketAttachment {
  type: 'uploaded' | 'external';
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;  // ISO 8601 timestamp
  cloudinaryPublicId?: string;  // For uploaded type only
}
```

**Storage**:
- JSON array in Ticket.attachments column (PostgreSQL JSONB)
- Max 5 attachments per ticket

## Agent Schemas

### AgentSchema

```typescript
// app/lib/schemas/agent.ts
import { z } from 'zod';
import { Agent } from '@prisma/client';

export const projectAgentSchema = z.nativeEnum(Agent);
export const ticketAgentSchema = z.nativeEnum(Agent).nullable();
```

**Validation Rules**:
- **projectAgentSchema**: Required, must be a valid `Agent` enum value
- **ticketAgentSchema**: Optional (nullable), must be a valid `Agent` enum value or `null`
- `null` on a ticket means inherit the project's `defaultAgent` at workflow dispatch time

**Agent Values**:
- `CLAUDE` — Anthropic Claude (default for all projects)
- `CODEX` — OpenAI Codex
- `MISTRAL` — Mistral vibe CLI
- `GEMINI` — Google Gemini CLI

**Usage**:
- `projectAgentSchema` used in `UpdateProjectSchema` for `defaultAgent` field
- `ticketAgentSchema` used in `CreateTicketSchema` and `UpdateTicketSchema` for `agent` field

## Clarification Policy Schemas

### ClarificationPolicyEnum

```typescript
export const ClarificationPolicyEnum = z.enum([
  'AUTO',
  'CONSERVATIVE',
  'PRAGMATIC',
  'INTERACTIVE'
]);

export type ClarificationPolicy = z.infer<typeof ClarificationPolicyEnum>;
```

**Hierarchy**:
```typescript
const effectivePolicy =
  ticket.clarificationPolicy ??
  project.clarificationPolicy ??
  'AUTO';
```

**Policy Meanings**:
- **AUTO**: Context-aware (detects sensitive keywords → CONSERVATIVE, internal → PRAGMATIC)
- **CONSERVATIVE**: Security & quality first (strict validation, short timeouts)
- **PRAGMATIC**: Speed & simplicity first (permissive validation, no limits)
- **INTERACTIVE**: Manual clarification (future, preserves `[NEEDS CLARIFICATION]` markers)

## Workflow Authentication Schema

### WorkflowAuthValidation

```typescript
export function validateWorkflowAuth(request: NextRequest): {
  isValid: boolean;
  error?: string;
} {
  const expectedToken = process.env.WORKFLOW_API_TOKEN;

  if (!expectedToken) {
    return { isValid: false, error: 'Workflow authentication not configured' };
  }

  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return { isValid: false, error: 'Missing Authorization header' };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return { isValid: false, error: 'Invalid Authorization header format' };
  }

  const token = authHeader.substring(7);

  // Constant-time comparison to prevent timing attacks
  if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))) {
    return { isValid: true };
  }

  return { isValid: false, error: 'Invalid authentication token' };
}
```

**Security**:
- Constant-time string comparison prevents timing attacks
- Token never logged or exposed in responses
- Used by workflow-callable endpoints only

## Response Schemas

### Success Response

```typescript
interface SuccessResponse<T> {
  data: T;
  message?: string;
}
```

### Error Response

```typescript
interface ErrorResponse {
  error: string;           // Short error message
  message?: string;        // Human-readable explanation (omitted on server errors to prevent information disclosure)
  code?: string;           // Error code (e.g., 'JOB_NOT_COMPLETED')
  details?: Record<string, any>;  // Additional context
}
```

### Transition Response

```typescript
interface TransitionResponse {
  success: boolean;
  jobId?: number;
  branchName?: string;
  message?: string;
  error?: string;
  errorCode?: 'INVALID_TRANSITION' | 'GITHUB_ERROR' | 'JOB_NOT_COMPLETED' | 'MISSING_JOB' | 'MISSING_CREDENTIAL';
  details?: {
    currentStage?: Stage;
    targetStage?: Stage;
    jobStatus?: JobStatus;
    jobCommand?: string;
  };
}
```

## Documentation Schemas

### DocumentTypeSchema

```typescript
export const DocumentTypeSchema = z.enum(['spec', 'plan', 'tasks', 'summary']);

export type DocumentType = z.infer<typeof DocumentTypeSchema>;
```

**Validation**:
- **spec**: Specification document (spec.md)
- **plan**: Implementation plan document (plan.md)
- **tasks**: Task breakdown document (tasks.md)
- **summary**: Implementation summary document (summary.md, read-only)

**Usage**:
- Used in documentation viewer component to determine which file to fetch
- Passed as route parameter or component prop
- Validated in API routes and components

### DocumentContentSchema

```typescript
export const DocumentContentSchema = z.object({
  content: z.string().min(1).max(1048576), // Max 1MB
  metadata: z.object({
    ticketId: z.number().int().positive(),
    branch: z.string().min(1).max(200),
    projectId: z.number().int().positive(),
    docType: DocumentTypeSchema,
    fileName: z.string().regex(/^(spec|plan|tasks|summary)\.md$/),
    filePath: z.string().regex(/^specs\/[^/]+\/(spec|plan|tasks|summary)\.md$/),
    fetchedAt: z.string().datetime(),
  }),
});

export type DocumentContent = z.infer<typeof DocumentContentSchema>;
```

**Validation Rules**:
- **content**: Document markdown content, 1 byte to 1MB
- **metadata.ticketId**: Positive integer identifying the ticket
- **metadata.branch**: Git branch name (1-200 characters)
- **metadata.projectId**: Positive integer identifying the project
- **metadata.docType**: One of: 'spec', 'plan', 'tasks', 'summary'
- **metadata.fileName**: Must match pattern `(spec|plan|tasks|summary).md`
- **metadata.filePath**: Must match pattern `specs/{branch}/(spec|plan|tasks|summary).md`
- **metadata.fetchedAt**: ISO 8601 datetime string

### DocumentErrorSchema

```typescript
export enum DocumentErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  TICKET_NOT_FOUND = 'TICKET_NOT_FOUND',
  WRONG_PROJECT = 'WRONG_PROJECT',
  BRANCH_NOT_ASSIGNED = 'BRANCH_NOT_ASSIGNED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  NOT_AVAILABLE_YET = 'NOT_AVAILABLE_YET',
  NOT_MERGED = 'NOT_MERGED',
  RATE_LIMIT = 'RATE_LIMIT',
  GITHUB_API_ERROR = 'GITHUB_API_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export const DocumentErrorSchema = z.object({
  error: z.string(),
  code: z.nativeEnum(DocumentErrorCode),
  message: z.string().optional(),
});

export type DocumentError = z.infer<typeof DocumentErrorSchema>;
```

**Error Codes**:
- **VALIDATION_ERROR**: Invalid request parameters (project ID, ticket ID)
- **PROJECT_NOT_FOUND**: Project does not exist
- **TICKET_NOT_FOUND**: Ticket does not exist
- **WRONG_PROJECT**: Ticket belongs to different project
- **BRANCH_NOT_ASSIGNED**: Ticket has no branch assigned yet
- **FILE_NOT_FOUND**: Documentation file not found in repository
- **NOT_AVAILABLE_YET**: Document not yet created (e.g., plan before planning stage)
- **NOT_MERGED**: Document not merged to the repository's default branch (for SHIP stage tickets)
- **RATE_LIMIT**: GitHub API rate limit exceeded
- **GITHUB_API_ERROR**: GitHub API returned an error
- **INTERNAL_ERROR**: Unexpected server error

## Edit Documentation Schemas

### EditDocumentationSchema

```typescript
// app/lib/schemas/documentation.ts
export const editDocumentationSchema = z.object({
  ticketId: z.number().int().positive('Ticket ID must be a positive integer'),
  docType: z.enum(['spec', 'plan', 'tasks']),
  content: z
    .string()
    .min(1, 'Document content cannot be empty')
    .max(1048576, 'Document content exceeds 1MB limit'),
  commitMessage: z.string().max(500, 'Commit message must be 500 characters or less').optional(),
});

export type EditDocumentationRequest = z.infer<typeof editDocumentationSchema>;
```

**Validation Rules**:
- **ticketId**: Required positive integer identifying the ticket
- **docType**: One of: `spec`, `plan`, `tasks` (excludes `summary` which is read-only)
- **content**: Required document markdown content, 1 byte to 1MB
- **commitMessage**: Optional custom commit message, max 500 characters

**Usage**:
- Used by `POST /api/projects/:projectId/docs` for validating document edit requests
- Enables in-app editing of spec, plan, and tasks documents

### EditDocumentationResponseSchema

```typescript
export const editDocumentationResponseSchema = z.object({
  success: z.literal(true),
  commitSha: z.string(),
  updatedAt: z.string(),
  message: z.string(),
});

export type EditDocumentationResponse = z.infer<typeof editDocumentationResponseSchema>;
```

**Fields**:
- **success**: Always `true` for successful responses
- **commitSha**: Git commit SHA of the documentation update
- **updatedAt**: ISO 8601 timestamp of the update
- **message**: Human-readable success message

### EditDocumentationErrorSchema

```typescript
export const editDocumentationErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.enum([
    'PERMISSION_DENIED',
    'BRANCH_NOT_FOUND',
    'VALIDATION_ERROR',
    'MERGE_CONFLICT',
    'NETWORK_ERROR',
    'TIMEOUT',
  ]).optional(),
  details: z.unknown().optional(),
});

export type EditDocumentationError = z.infer<typeof editDocumentationErrorSchema>;
```

**Error Codes**:
- **PERMISSION_DENIED**: User lacks access to modify documentation
- **BRANCH_NOT_FOUND**: Ticket branch does not exist
- **VALIDATION_ERROR**: Request body failed schema validation
- **MERGE_CONFLICT**: Concurrent edit conflict on the same file
- **NETWORK_ERROR**: GitHub API communication failure
- **TIMEOUT**: Operation exceeded time limit

### GetDocumentationHistorySchema

```typescript
export const getDocumentationHistorySchema = z.object({
  ticketId: z.coerce.number().int().positive('Ticket ID must be a positive integer'),
  docType: z.enum(['spec', 'plan', 'tasks']),
});

export type GetDocumentationHistoryRequest = z.infer<typeof getDocumentationHistorySchema>;
```

**Validation Rules**:
- **ticketId**: Coerced to positive integer (accepts string query parameter)
- **docType**: One of: `spec`, `plan`, `tasks`

**Usage**:
- Used by `GET /api/projects/:projectId/docs/history` for fetching commit history of a document

### DocumentationHistoryResponseSchema

```typescript
export const documentationHistoryResponseSchema = z.object({
  commits: z.array(
    z.object({
      sha: z.string().length(40),
      author: z.object({
        name: z.string(),
        email: z.string().email(),
        date: z.string().datetime(),
      }),
      message: z.string(),
      url: z.string().url(),
    })
  ),
});

export type DocumentationHistoryResponse = z.infer<typeof documentationHistoryResponseSchema>;
```

### GetDocumentationDiffSchema

```typescript
export const getDocumentationDiffSchema = z.object({
  ticketId: z.coerce.number().int().positive('Ticket ID must be a positive integer'),
  docType: z.enum(['spec', 'plan', 'tasks']),
  sha: z.string().regex(/^[a-f0-9]{40}$/, 'SHA must be 40 character hexadecimal string'),
});

export type GetDocumentationDiffRequest = z.infer<typeof getDocumentationDiffSchema>;
```

**Validation Rules**:
- **ticketId**: Coerced to positive integer
- **docType**: One of: `spec`, `plan`, `tasks`
- **sha**: 40-character hexadecimal Git commit SHA

**Usage**:
- Used by `GET /api/projects/:projectId/docs/diff` for fetching diff at a specific commit

### DocumentationDiffResponseSchema

```typescript
export const documentationDiffResponseSchema = z.object({
  sha: z.string().length(40),
  files: z.array(
    z.object({
      filename: z.string(),
      status: z.enum(['added', 'modified', 'removed']),
      additions: z.number().int().nonnegative(),
      deletions: z.number().int().nonnegative(),
      patch: z.string().optional(),
    })
  ),
});

export type DocumentationDiffResponse = z.infer<typeof documentationDiffResponseSchema>;
```

## Type Inference

Zod schemas provide TypeScript type inference:

```typescript
// Inferred from schema
type CreateTicketInput = {
  title: string;
  description: string;
};

// Use in API route
export async function POST(request: NextRequest) {
  const body = await request.json();
  const validatedData = createTicketSchema.parse(body);  // Type: CreateTicketInput

  // validatedData is now type-safe
  const ticket = await prisma.ticket.create({
    data: {
      title: validatedData.title,
      description: validatedData.description,
      ...
    }
  });
}
```

## Validation Error Formatting

Zod errors are automatically formatted:

```typescript
try {
  const validatedData = schema.parse(body);
} catch (error) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        message: error.errors[0].message,
        details: error.errors,
      },
      { status: 400 }
    );
  }
}
```

**Example Zod Error**:
```json
{
  "error": "Validation failed",
  "message": "Title must be 100 characters or less",
  "details": [
    {
      "path": ["title"],
      "message": "Title must be 100 characters or less",
      "code": "too_big"
    }
  ]
}
```

## Telemetry Context Schema

### TelemetryContextFileSchema

The telemetry context file is generated by the `fetch-telemetry.sh` script during `/compare` operations and contains aggregated job metrics for ticket comparison analysis.

**File Location**: `specs/{branch}/.telemetry-context.json`

**Schema Structure**:

```typescript
interface TelemetryContextFile {
  generatedAt: string;      // ISO 8601 timestamp
  sourceTicket: string;     // Source ticket key (e.g., "AIB-138")
  tickets: Record<string, TicketTelemetry>;
}

interface TicketTelemetry {
  ticketKey: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
  durationMs: number;
  model: string | null;
  toolsUsed: string[];      // ["Edit", "Read", "Bash", etc.]
  jobCount: number;
  hasData: boolean;         // False when no completed jobs
}
```

**Example**:

```json
{
  "generatedAt": "2026-01-04T10:30:00Z",
  "sourceTicket": "AIB-138",
  "tickets": {
    "AIB-138": {
      "ticketKey": "AIB-138",
      "inputTokens": 12000,
      "outputTokens": 4500,
      "cacheReadTokens": 2500,
      "cacheCreationTokens": 800,
      "costUsd": 0.110,
      "durationMs": 160000,
      "model": "claude-sonnet-4-5-20250929",
      "toolsUsed": ["Edit", "Read", "Bash"],
      "jobCount": 3,
      "hasData": true
    },
    "AIB-127": {
      "ticketKey": "AIB-127",
      "inputTokens": 15000,
      "outputTokens": 5000,
      "cacheReadTokens": 3000,
      "cacheCreationTokens": 1000,
      "costUsd": 0.125,
      "durationMs": 180000,
      "model": "claude-sonnet-4-5-20250929",
      "toolsUsed": ["Edit", "Read", "Bash"],
      "jobCount": 4,
      "hasData": true
    }
  }
}
```

**Field Descriptions**:

- **generatedAt**: Timestamp when telemetry was fetched
- **sourceTicket**: Ticket key from which comparison was triggered (extracted from BRANCH env var)
- **tickets**: Map of ticket keys to telemetry data
  - **ticketKey**: Ticket identifier (e.g., "AIB-138")
  - **inputTokens**: Total input tokens consumed by Claude (all completed jobs)
  - **outputTokens**: Total output tokens generated by Claude
  - **cacheReadTokens**: Total tokens read from prompt cache
  - **cacheCreationTokens**: Total tokens written to prompt cache
  - **costUsd**: Total USD cost aggregated across all completed jobs
  - **durationMs**: Total execution time in milliseconds
  - **model**: Claude model used (null if no jobs)
  - **toolsUsed**: Unique list of tools used across all jobs
  - **jobCount**: Number of completed jobs aggregated
  - **hasData**: Boolean indicating if telemetry data exists (false when no completed jobs)

**Aggregation Rules**:

- Only COMPLETED jobs are included in aggregation
- Metrics summed across all completed jobs for the ticket
- Empty telemetry (all zeros, hasData: false) used when:
  - Ticket not found in database
  - API call fails
  - No completed jobs exist for ticket
- Source ticket automatically included in telemetry list
- Deduplication: If source ticket also appears in compare list, only one entry created

**Usage**:

- Generated by `.github/scripts/fetch-telemetry.sh` workflow step
- Read by Claude `/compare` command for cost analysis
- Enables complete cost comparison including source ticket
- Supports comparison reports with telemetry metrics

## Health Report Schemas

Scan report data is stored as a JSON string in `HealthScan.report` and validated at parse time using Zod. The schema is a discriminated union keyed on `type`.

**Location**: `lib/health/report-schemas.ts` (Zod schemas + `parseScanReport()` helper)
**Types**: `lib/health/types.ts` (`ScanReport` union, per-module report interfaces)

### Common Structures

```typescript
// Shared across all active-module reports
interface ReportIssue {
  id: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  file?: string;              // relative path to affected file
  line?: number;              // line number in affected file
  category?: string;          // module-specific grouping key
  confidence?: number;        // 7-10 confidence score (security scan only)
  exploitScenario?: string;   // concrete attack scenario (security scan only)
  recommendation?: string;    // specific fix recommendation (security scan only)
}

interface GeneratedTicket {
  ticketKey: string;   // e.g. "AIB-123"
  stage: string;       // current ticket stage
}
```

### Command Output Format

Active module scan commands (`health-security`, `health-compliance`, `health-tests`, `health-spec-sync`, `health-review-quality`) write a JSON result file to `/tmp/health-scan-result.json`. The workflow reads this file with `jq` to extract fields for storage and ticket creation.

```json
{
  "score": 85,
  "issuesFound": 3,
  "issuesFixed": 1,
  "report": { ... },
  "skipped": false,
  "skipReason": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `score` | `number` 0–100 \| `null` | Health score; 100 = no issues. Score weights: HIGH −15, MEDIUM −8, LOW −3, floor 0. Must be `null` when `skipped: true` |
| `issuesFound` | `number` | Total issues detected (for TESTS: `autoFixed.length + nonFixable.length`) |
| `issuesFixed` | `number` | Issues auto-fixed (non-zero only for TESTS; 0 for all other modules) |
| `report` | `ScanReport` | Typed report object stored in `HealthScan.report` (see discriminated union below) |
| `skipped` | `boolean` | `true` when the agent detected nothing to evaluate and exited early. Defaults to `false` (backward compatible). Ignored for COMPLIANCE and TESTS scan types. |
| `skipReason` | `string` \| `null` | Human-readable reason for skipping (e.g., `"No qualifying PRs since last scan"`). Present only when `skipped: true`. |

### ScanReport Discriminated Union

```typescript
type ScanReport =
  | SecurityReport
  | ComplianceReport
  | TestsReport
  | SpecSyncReport
  | QualityGateReport
  | ReviewQualityReport;
```

| `type` value | Module | Grouping strategy |
|---|---|---|
| `"SECURITY"` | Security | Issues grouped by `severity` (high → medium → low) |
| `"COMPLIANCE"` | Compliance | Issues grouped by `category` (constitution principle) |
| `"TESTS"` | Tests | Two arrays: `autoFixed` / `nonFixable` |
| `"SPEC_SYNC"` | Spec Sync | `specs[]` with `status: "synced" | "drifted"` and optional `drift` string |
| `"QUALITY_GATE"` | Quality Gate (passive) | `dimensions[]` score breakdown + `recentTickets[]` |
| `"REVIEW_QUALITY"` | Review Quality | `missedFindings[]` + `cumulativeAnalysis` with `recurringPatterns[]` |

**ReviewQualityReport structure**:
```typescript
interface ReviewQualityReport {
  type: 'REVIEW_QUALITY';
  summary: {
    prsAnalyzed: number;
    totalMissedFindings: number;
    coverageScore: number;       // 0–100
    scoreBreakdown: {
      base: 100;
      highPenalty: number;       // sum of -15 per high finding
      mediumPenalty: number;     // sum of -8 per medium finding
      lowPenalty: number;        // sum of -3 per low finding
    };
  };
  missedFindings: MissedFinding[];
  cumulativeAnalysis: {
    windowDays: 30;
    reportsAnalyzed: number;
    recurringPatterns: RecurringPattern[];
  };
  generatedTickets: GeneratedTicket[];
}

interface MissedFinding {
  id: string;
  prNumber: number;
  source: 'codex' | 'copilot';
  category: ReviewGapCategory;
  severity: 'high' | 'medium' | 'low';
  description: string;
  file: string;
  line: number;
  sourceCommentUrl?: string;
}

interface RecurringPattern {
  category: ReviewGapCategory;
  occurrences: number;           // ≥ 3
  prNumbers: number[];
  suggestedRule: string;
  target: 'constitution' | 'review-prompt';
  alreadyTicketed: boolean;
  ticketKey?: string;
}

type ReviewGapCategory =
  | 'state-lifecycle'
  | 'edge-case-validation'
  | 'test-quality'
  | 'error-handling'
  | 'ui-ux-state'
  | 'ci-workflow'
  | 'api-contract'
  | 'security'
  | 'performance';
```

**ReviewQualityReport scoring**: base 100, penalty −15 per high finding, −8 per medium, −3 per low, floor 0. Only FULL workflow PRs merged since the last scan are analyzed; QUICK workflow PRs are excluded.

**Filtering**: doc/spec staleness, TypeScript/ESLint-catchable issues, and duplicate findings (same file + overlapping line range within 5 lines) are excluded.

**Cumulative analysis**: Runs after every incremental collection over the previous 30 days of scan reports. Patterns with ≥ 3 occurrences across distinct PRs are reported. Deduplication against existing open `[Review Gap]` tickets prevents duplicate ticket creation.

**SecurityReport categories**: `injection`, `authentication`, `sensitive-data`, `access-control`, `misconfiguration`, `dependencies`, `cryptography`

**SecurityReport severity mapping** (by exploitability + impact):
- `high`: Directly exploitable — RCE, data breach, auth bypass, privilege escalation (no special conditions)
- `medium`: Significant impact but requires specific conditions (authenticated attacker, chained exploit, race condition)
- `low`: Defense-in-depth issues — weakens posture but not directly exploitable (verbose errors, debug flags, weak non-critical tokens)
- Confidence override: findings with confidence = 7 are capped at `low` severity

**ComplianceReport categories**: Derived dynamically from the project's constitution file — each `category` value must match a principle name declared in the constitution (e.g., `TypeScript-First`, `Security-First`, etc.). No hardcoded list; different projects may have entirely different principles.

**ComplianceReport severity mapping** (by impact category of violated principle):
- `high`: Principles related to security, data integrity, or safety
- `medium`: Principles related to code quality, type safety, testing, or architecture
- `low`: Principles related to conventions, documentation structure, or style
- Confidence override: findings with confidence = 7 are capped at `low` severity

**Constitution file discovery** (compliance command): reads `.ai-board/memory/constitution.md` first, falls back to `.claude-plugin/memory/constitution.md`

### Parsing

```typescript
import { parseScanReport } from '@/lib/health/report-schemas';

// Returns typed ScanReport or null (never throws)
const report = parseScanReport(moduleType, rawJsonString);
```

`parseScanReport` uses Zod `safeParse`. Invalid or null inputs return `null`; callers render a fallback message ("Report data unavailable — scan predates structured reporting").

### Hook

`useScanReport(projectId, moduleType)` fetches the latest scan with `includeReport=true` and parses the report via `parseScanReport`. It is used by the Scan Detail Drawer to load report content on demand.

```typescript
const { data, isLoading } = useScanReport(projectId, 'SECURITY');
// data: { scan: ScanHistoryItemWithReport | null, report: ScanReport | null }
```

---

## Health Trend Schemas

Types for the trends endpoint response and the client hook that consumes it.

**Location**: `lib/health/types.ts` (`TrendDataPoint`, `ModuleTrends`)
**Hook**: `app/lib/hooks/useHealthTrends.ts`

```typescript
interface TrendDataPoint {
  date: string;   // ISO 8601 — scan completedAt timestamp
  score: number;  // 0–100
}

type ModuleTrends = {
  SECURITY: TrendDataPoint[];
  COMPLIANCE: TrendDataPoint[];
  TESTS: TrendDataPoint[];
  SPEC_SYNC: TrendDataPoint[];
};
```

**Hook**: `useHealthTrends(projectId)` — TanStack Query, fetched once on dashboard mount with `staleTime: 60_000` and `gcTime: 300_000`. No polling; not invalidated by the 2-second scan-status cycle.

**Query key**: `queryKeys.health.trends(projectId)` → `['health', projectId, 'trends']`

---

## Health Scan History Item

The `ScanHistoryItem` interface represents a single entry returned by `GET /api/projects/[projectId]/health/scans`.

```typescript
interface ScanHistoryItem {
  id: number;
  scanType: HealthScanType;
  status: HealthScanStatus;
  score: number | null;
  issuesFound: number | null;
  issuesFixed: number | null;
  baseCommit: string | null;
  headCommit: string | null;
  durationMs: number | null;
  tokensUsed: number | null;   // API tokens consumed; null for pre-telemetry scans
  costUsd: number | null;      // Cost in USD; null for pre-telemetry scans
  errorMessage: string | null;
  startedAt: string | null;    // ISO 8601
  completedAt: string | null;  // ISO 8601
  createdAt: string;           // ISO 8601
}

// Extended variant used when includeReport=true
type ScanHistoryItemWithReport = ScanHistoryItem & { report: string | null };
```

**Formatting utilities** (`lib/health/format.ts`):
- `formatCost(costUsd: number): string` → `"$0.42"` (2 decimal places)
- `formatTokens(tokens: number): string` → `"500"`, `"1.2k"`, `"1.5M"` (abbreviated)
- `formatDuration(ms: number): string` → `"0.5s"`, `"2.3s"`, `"1m 15s"` (human-readable)

---

## Health Passive Module Detail Schemas

Response types returned by the passive module detail endpoint (`/health/quality-gate`). These are distinct from the `ScanReport` union above — they are API response shapes, not stored scan report blobs.

**Location**: `lib/health/quality-gate.ts` (`QualityGateDetails`)

### QualityGateDetails

```typescript
interface QualityGateDimension {
  name: string;              // "Compliance" | "Bug Detection" | "Product Contract Sync" | "Edge Cases & Failure Modes" | "Historical Context"
  averageScore: number | null; // 0–100 or null when no data for dimension
  weight: number;            // 0.00–1.00 (Compliance=0.30, Bug Detection=0.30, Product Contract Sync=0.20, Edge Cases & Failure Modes=0.15, Historical Context=0.05)
}

interface QualityGateTicket {
  ticketKey: string;
  title: string;
  score: number;
  completedAt: string; // ISO 8601
}

interface QualityGateDetails {
  averageScore: number | null;
  ticketCount: number;
  trend: 'up' | 'down' | 'stable' | null;
  trendDelta: number | null;
  distribution: { excellent: number; good: number; fair: number; poor: number };
  dimensions: QualityGateDimension[];
  recentTickets: QualityGateTicket[];
  trendData: Array<{ ticketKey: string; score: number; date: string }>;
}
```

**Hooks**: `useQualityGateDetails(projectId)` — TanStack Query, fetches on drawer open, no polling.

### HealthModuleStatus

The `HealthModuleStatus` interface in `lib/health/types.ts` defines the per-module shape returned in the `modules` object of `GET /api/projects/[projectId]/health`:

```typescript
interface HealthModuleStatus {
  score: number | null;
  label: string | null;
  lastScanDate?: string | null;      // ISO 8601 — last completed scan date
  scanStatus?: string | null;        // current scan status (e.g., "COMPLETED", "RUNNING")
  issuesFound?: number | null;       // issues found in latest scan
  passive?: boolean;                 // true for Quality Gate (no user-triggered scans)
  jobId?: number | null;             // associated job ID (passive modules)
  summary: string;                   // human-readable summary (e.g., "3 issues found", "No scan yet")
  ticketCount?: number;              // Quality Gate: number of qualifying tickets
  trend?: 'up' | 'down' | 'stable' | null;  // Quality Gate: trend vs previous period
  trendDelta?: number | null;        // Quality Gate: numeric score delta
  distribution?: { excellent: number; good: number; fair: number; poor: number }; // Quality Gate: threshold buckets
}
```

---

## Health Scan Request Schemas

Zod validation schemas for health scan API endpoints. These are co-located in the route handlers rather than `app/lib/schemas/`.

### triggerScanSchema

**Location**: `app/api/projects/[projectId]/health/scans/route.ts`

```typescript
const triggerScanSchema = z.object({
  scanType: z.enum(['SECURITY', 'COMPLIANCE', 'TESTS', 'SPEC_SYNC']),
});
```

Used by `POST /api/projects/[projectId]/health/scans` to validate the request body.

### scanHistorySchema

**Location**: `app/api/projects/[projectId]/health/scans/route.ts`

```typescript
const scanHistorySchema = z.object({
  type: z.enum(['SECURITY', 'COMPLIANCE', 'TESTS', 'SPEC_SYNC']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.coerce.number().int().positive().optional(),
  includeReport: z.enum(['true', 'false']).optional(),
});
```

Used by `GET /api/projects/[projectId]/health/scans` to validate query parameters. The response is wrapped in a pagination envelope:

```typescript
interface ScanHistoryResponse {
  scans: ScanHistoryItem[];
  nextCursor: number | null;  // ID of last scan returned; pass as cursor for next page
  hasMore: boolean;           // true if more results exist beyond this page
}
```

### statusUpdateSchema

**Location**: `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts`

```typescript
const statusUpdateSchema = z.object({
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED']),
  score: z.number().int().min(0).max(100).optional(),
  report: z.string().optional(),
  issuesFound: z.number().int().min(0).optional(),
  issuesFixed: z.number().int().min(0).optional(),
  headCommit: z.string().length(40).optional(),
  durationMs: z.number().int().min(0).optional(),
  tokensUsed: z.number().int().min(0).optional(),
  costUsd: z.number().min(0).optional(),
  errorMessage: z.string().max(2000).optional(),
});
```

Used by `PATCH /api/projects/[projectId]/health/scans/[scanId]/status` (workflow callback). Validates state transitions: PENDING → RUNNING/FAILED, RUNNING → COMPLETED/FAILED. Terminal states (COMPLETED, FAILED) reject further updates.

### trendsQuerySchema

**Location**: `app/api/projects/[projectId]/health/trends/route.ts`

```typescript
const trendsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

Used by `GET /api/projects/[projectId]/health/trends` to validate the `limit` query parameter.

---

## Schema Location & Usage

### File Organization

```
app/lib/schemas/
├── ticket.ts           # Ticket-related schemas (create, update, transition, branch, preview URL)
├── ticket-delete.ts    # Ticket deletion schemas
├── comment.ts          # Comment schemas
├── job.ts              # Job status schemas
├── project.ts          # Project schemas
├── image.ts            # Image attachment schemas
├── agent.ts            # Agent enum schemas (projectAgentSchema, ticketAgentSchema)
├── documentation.ts    # Documentation edit, history, and diff schemas
└── index.ts            # Re-exports all schemas
```

### Import Pattern

```typescript
// API route
import { createTicketSchema } from '@/app/lib/schemas/ticket';

// Client component
import { createCommentSchema } from '@/app/lib/schemas/comment';
import type { CreateCommentInput } from '@/app/lib/schemas/comment';
```

## Optimistic Concurrency Control

### Version Field Pattern

All ticket updates require version field:

```typescript
const updateTicketSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  version: z.number().int().positive(),  // Required
});
```

### API Implementation

```typescript
const ticket = await prisma.ticket.findUnique({
  where: { id: ticketId }
});

if (!ticket || ticket.version !== input.version) {
  return NextResponse.json(
    { error: 'Version conflict', code: 'VERSION_CONFLICT' },
    { status: 409 }
  );
}

const updated = await prisma.ticket.update({
  where: { id: ticketId },
  data: {
    ...input,
    version: { increment: 1 }
  }
});
```

### Client Pattern (TanStack Query)

```typescript
const mutation = useMutation({
  mutationFn: async (input: UpdateTicketInput) => {
    const response = await fetch(`/api/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });

    if (response.status === 409) {
      throw new Error('VERSION_CONFLICT');
    }

    return response.json();
  },
  onError: (error) => {
    if (error.message === 'VERSION_CONFLICT') {
      // Rollback optimistic update
      queryClient.invalidateQueries(['tickets', id]);
    }
  }
});
```
