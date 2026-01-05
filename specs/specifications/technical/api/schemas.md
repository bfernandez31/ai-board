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
    .max(2500, 'Description must be 2500 characters or less'),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
```

**Validation Rules**:
- **title**: Required, 1-100 characters, alphanumeric + basic punctuation only
- **description**: Required, 1-2500 characters, all UTF-8 characters allowed

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
    .max(2500)
    .optional(),

  clarificationPolicy: z.enum(['AUTO', 'CONSERVATIVE', 'PRAGMATIC', 'INTERACTIVE'])
    .nullable()
    .optional(),

  version: z.number().int().positive(),
});

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
```

**Stage-Based Validation**:
- **description**: Editable ONLY in INBOX stage (API enforced)
- **clarificationPolicy**: Editable ONLY in INBOX stage (API enforced)
- **version**: Always required for optimistic concurrency control

### TransitionTicketSchema

```typescript
export const transitionTicketSchema = z.object({
  targetStage: z.enum(['SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP']),
});

export type TransitionTicketInput = z.infer<typeof transitionTicketSchema>;
```

**Validation**:
- **targetStage**: Must be valid Stage enum value
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
const vercelDomainPattern = /^https:\/\/[a-z0-9-]+\.vercel\.app$/;

export const updatePreviewUrlSchema = z.object({
  previewUrl: z.string()
    .max(500, 'Preview URL must be 500 characters or less')
    .regex(vercelDomainPattern, 'Preview URL must be a valid Vercel domain (HTTPS only)')
    .nullable(),
});

export type UpdatePreviewUrlInput = z.infer<typeof updatePreviewUrlSchema>;
```

**Validation Rules**:
- **previewUrl**: Max 500 characters, HTTPS-only, Vercel domain pattern (`https://*.vercel.app`)
- **Pattern**: `^https:\/\/[a-z0-9-]+\.vercel\.app$`
- Rejects non-HTTPS URLs, non-Vercel domains, and malformed URLs

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
    .default(10),
});

export type SearchTicketsInput = z.infer<typeof searchTicketsSchema>;
```

**Validation Rules**:
- **q**: Search query string, 2-100 characters required
- **limit**: Optional result limit (default: 10, max: 50)

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
  stage: z.enum(['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP']),
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
- **stage**: Current workflow stage enum

**Usage Context**:
- Ticket search results in search bar
- Ticket autocomplete dropdown in comments (#autocomplete)
- Both use same schema for consistency

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
- User mentions via `@[Name](userId)` syntax
- HTML escaping enabled (XSS protection)

### CreateAIBoardCommentSchema

```typescript
export const createAIBoardCommentSchema = z.object({
  content: z.string()
    .min(1)
    .max(2000),

  userId: z.literal('ai-board-system-user'),
});

export type CreateAIBoardCommentInput = z.infer<typeof createAIBoardCommentSchema>;
```

**Validation**:
- **userId**: Must be exactly "ai-board-system-user"
- Used only by GitHub Actions workflows

## Job Schemas

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
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
```

**Validation**:
- **clarificationPolicy**: NOT NULL at database level, default: AUTO
- Updates are partial (all fields optional)

## Image Attachment Schemas

### UploadImageSchema

```typescript
export const uploadImageSchema = z.object({
  file: z.instanceof(File)
    .refine((file) => file.size <= 10 * 1024 * 1024, 'File must be 10MB or smaller')
    .refine(
      (file) => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type),
      'Only JPEG, PNG, GIF, and WebP images are allowed'
    ),
});

export type UploadImageInput = z.infer<typeof uploadImageSchema>;
```

**Validation**:
- **Max Size**: 10MB (10485760 bytes)
- **Formats**: JPEG, PNG, GIF, WebP only
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
  message: string;         // Detailed explanation
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
  errorCode?: 'INVALID_TRANSITION' | 'GITHUB_ERROR' | 'JOB_NOT_COMPLETED' | 'MISSING_JOB';
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
- **NOT_MERGED**: Document not merged to main branch (for SHIP stage tickets)
- **RATE_LIMIT**: GitHub API rate limit exceeded
- **GITHUB_API_ERROR**: GitHub API returned an error
- **INTERNAL_ERROR**: Unexpected server error

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
