# Data Model: MCP Server for AI-Board

**Branch**: `AIB-174-mcp-server` | **Date**: 2026-01-23

## Overview

The MCP server is a stateless proxy - it doesn't store data itself but transforms between MCP protocol and ai-board API. This document defines the data structures used for configuration, API communication, and MCP tool responses.

## Configuration

### Config File Schema

**Location**: `~/.aiboard/config.json`

```typescript
/**
 * User configuration for ai-board MCP server
 */
interface AiBoardConfig {
  /** Base URL of the ai-board API (e.g., "https://ai-board.vercel.app") */
  apiUrl: string;

  /** Personal Access Token for authentication (format: pat_xxx...) */
  token: string;
}
```

**Zod Schema**:
```typescript
const ConfigSchema = z.object({
  apiUrl: z
    .string()
    .url("apiUrl must be a valid URL")
    .refine(
      (url) => !url.endsWith("/"),
      "apiUrl should not end with a trailing slash"
    ),
  token: z
    .string()
    .startsWith("pat_", "Token must start with 'pat_'")
    .min(68, "Token must be at least 68 characters (pat_ + 64 hex chars)"),
});
```

**Example**:
```json
{
  "apiUrl": "https://ai-board.vercel.app",
  "token": "pat_abc123..."
}
```

## API Response Types

### Project

```typescript
/**
 * Project summary from GET /api/projects
 */
interface ProjectSummary {
  id: number;
  key: string;           // 3-6 char unique key (e.g., "AIB")
  name: string;
  description: string;
  githubOwner: string;
  githubRepo: string;
  deploymentUrl: string | null;
  updatedAt: string;     // ISO 8601 timestamp
  ticketCount: number;
  lastShippedTicket: {
    id: number;
    ticketKey: string;
    title: string;
    updatedAt: string;
  } | null;
}

/**
 * Full project details from GET /api/projects/{id}
 */
interface ProjectDetails {
  id: number;
  key: string;
  name: string;
  description: string;
  githubOwner: string;
  githubRepo: string;
  deploymentUrl: string | null;
  clarificationPolicy: "AUTO" | "CONSERVATIVE" | "PRAGMATIC" | "INTERACTIVE";
  createdAt: string;
  updatedAt: string;
}
```

### Ticket

```typescript
/**
 * Ticket stage enum
 */
type Stage = "INBOX" | "SPECIFY" | "PLAN" | "BUILD" | "VERIFY" | "SHIP";

/**
 * Workflow type enum
 */
type WorkflowType = "FULL" | "QUICK" | "CLEAN";

/**
 * Ticket summary in stage groupings
 */
interface TicketSummary {
  id: number;
  ticketNumber: number;
  ticketKey: string;      // Format: "{PROJECT_KEY}-{NUMBER}" (e.g., "AIB-123")
  title: string;
  description: string;
  stage: Stage;
  version: number;
  projectId: number;
  branch: string | null;
  workflowType: WorkflowType;
  createdAt: string;
  updatedAt: string;
}

/**
 * Tickets grouped by stage from GET /api/projects/{id}/tickets
 */
interface TicketsByStage {
  INBOX: TicketSummary[];
  SPECIFY: TicketSummary[];
  PLAN: TicketSummary[];
  BUILD: TicketSummary[];
  VERIFY: TicketSummary[];
  SHIP: TicketSummary[];
}

/**
 * Full ticket details from GET /api/projects/{id}/tickets/{key}
 */
interface TicketDetails {
  id: number;
  ticketNumber: number;
  ticketKey: string;
  title: string;
  description: string;
  stage: Stage;
  version: number;
  projectId: number;
  branch: string | null;
  autoMode: boolean;
  clarificationPolicy: string | null;
  workflowType: WorkflowType;
  attachments: unknown[];  // Image attachments (not relevant for MCP)
  createdAt: string;
  updatedAt: string;
  project: {
    id: number;
    name: string;
    clarificationPolicy: string;
    githubOwner: string;
    githubRepo: string;
  };
}

/**
 * Ticket creation request body
 */
interface CreateTicketRequest {
  title: string;          // 1-100 characters
  description: string;    // 1-10000 characters
}

/**
 * Ticket creation response
 */
interface CreateTicketResponse {
  id: number;
  ticketNumber: number;
  ticketKey: string;
  title: string;
  description: string;
  stage: "INBOX";
  version: number;
  projectId: number;
  branch: null;
  autoMode: boolean;
  attachments: unknown[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Stage transition request body
 */
interface TransitionRequest {
  targetStage: Stage;
}

/**
 * Stage transition response
 */
interface TransitionResponse {
  id: number;
  stage: Stage;
  workflowType: WorkflowType;
  branch: string | null;
  version: number;
  updatedAt: string;
  jobId?: number;        // Only present for transitions that create jobs
}
```

## MCP Tool Schemas

### Tool Input Schemas (Zod)

```typescript
// list_projects - no parameters
const ListProjectsInput = z.object({});

// get_project
const GetProjectInput = z.object({
  projectId: z.number().int().positive().describe("Project ID"),
});

// create_ticket
const CreateTicketInput = z.object({
  projectId: z.number().int().positive().describe("Project ID"),
  title: z
    .string()
    .min(1)
    .max(100)
    .describe("Ticket title (1-100 characters)"),
  description: z
    .string()
    .min(1)
    .max(10000)
    .describe("Ticket description (1-10000 characters)"),
});

// get_ticket
const GetTicketInput = z.object({
  projectId: z.number().int().positive().describe("Project ID"),
  ticketKey: z
    .string()
    .regex(/^[A-Z]{3,6}-\d+$/)
    .describe("Ticket key (e.g., 'AIB-123')"),
});

// list_tickets
const ListTicketsInput = z.object({
  projectId: z.number().int().positive().describe("Project ID"),
  stage: z
    .enum(["INBOX", "SPECIFY", "PLAN", "BUILD", "VERIFY", "SHIP"])
    .optional()
    .describe("Filter by stage (optional)"),
});

// move_ticket
const MoveTicketInput = z.object({
  projectId: z.number().int().positive().describe("Project ID"),
  ticketKey: z
    .string()
    .regex(/^[A-Z]{3,6}-\d+$/)
    .describe("Ticket key (e.g., 'AIB-123')"),
  targetStage: z
    .enum(["INBOX", "SPECIFY", "PLAN", "BUILD", "VERIFY", "SHIP"])
    .describe("Target stage for transition"),
});
```

### Tool Output Format

All MCP tools return content in the standard MCP format:

```typescript
interface McpToolResponse {
  content: Array<{
    type: "text";
    text: string;  // JSON-stringified data or error message
  }>;
}
```

## Error Types

```typescript
/**
 * API error from ai-board
 */
interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * MCP server error categories
 */
enum ErrorCode {
  CONFIG_NOT_FOUND = "CONFIG_NOT_FOUND",
  CONFIG_INVALID = "CONFIG_INVALID",
  AUTH_FAILED = "AUTH_FAILED",
  ACCESS_DENIED = "ACCESS_DENIED",
  NOT_FOUND = "NOT_FOUND",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  RATE_LIMITED = "RATE_LIMITED",
  NETWORK_ERROR = "NETWORK_ERROR",
  API_ERROR = "API_ERROR",
}
```

## Validation Rules

### Ticket Title
- Minimum: 1 character
- Maximum: 100 characters
- Trimmed before storage

### Ticket Description
- Minimum: 1 character
- Maximum: 10,000 characters
- Trimmed before storage
- Supports Markdown

### Stage Transitions
Valid transitions are enforced by the API:
- INBOX → SPECIFY, BUILD (quick-impl)
- SPECIFY → PLAN
- PLAN → BUILD
- BUILD → VERIFY, INBOX (rollback for QUICK)
- VERIFY → SHIP, PLAN (rollback for FULL)
- SHIP → (terminal)

## State Transitions

```
┌─────────┐     ┌─────────┐     ┌──────┐     ┌───────┐     ┌────────┐     ┌──────┐
│  INBOX  │────▶│ SPECIFY │────▶│ PLAN │────▶│ BUILD │────▶│ VERIFY │────▶│ SHIP │
└─────────┘     └─────────┘     └──────┘     └───────┘     └────────┘     └──────┘
     │                                             ▲            │
     │                                             │            │
     └─────────────────────────────────────────────┘            │
              (quick-impl: INBOX → BUILD)                       │
                                                                │
                           ┌────────────────────────────────────┘
                           │ (rollback: VERIFY → PLAN)
                           ▼
                        ┌──────┐
                        │ PLAN │
                        └──────┘
```
