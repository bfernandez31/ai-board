# Research: Capture and Display Agent Execution Logs

## Technical Context Analysis

### Language/Version
- **TypeScript** (from constitution: "TypeScript-First Development")
- **Next.js** framework (from constitution: "server logic follows Next.js conventions")

### Primary Dependencies
- **Prisma** (database ORM, from constitution)
- **shadcn/ui** (UI components, from constitution)
- **TanStack Query v5** (data fetching, from constitution)
- **Zod** (input validation, from constitution)
- **Object storage provider** (for log content storage - NEEDS CLARIFICATION)

### Storage
- **Hybrid storage approach** (from spec: "FR-007: System MUST implement hybrid storage (metadata in database, content in object storage)")
- **PostgreSQL** (for metadata, inferred from Prisma usage)
- **Object storage** (for log content - NEEDS CLARIFICATION on provider)

### Testing
- **Vitest** (unit/component tests, from constitution)
- **React Testing Library** (component tests, from constitution)
- **Playwright** (E2E tests, from constitution)

### Target Platform
- **Web application** (Next.js based on constitution)

### Project Type
- **Web application** with backend services

### Performance Goals
- **Log retrieval time**: <2 seconds for 90% of requests (from spec: SC-004)
- **Log availability**: Within 5 seconds of job completion (from spec: SC-001)

### Constraints
- **Storage efficiency**: <1GB per 1000 jobs (from spec: SC-003)
- **Database impact**: Logs must not exceed 10% of total database size (from spec: SC-007)
- **Retention policy**: 30 days minimum with automatic pruning (from spec: FR-008)

### Scale/Scope
- **Supported agents**: Claude Code, Codex, Mistral/vibe, Gemini (from spec: FR-001)
- **User base**: All project members and owners (from user stories)

## Constitution Check

### Gates to Verify

1. **TypeScript-First Development** ✓
   - All code will be TypeScript with strict mode
   - Explicit type annotations required

2. **Component-Driven Architecture** ✓
   - Will use shadcn/ui components
   - Feature-based folder structure

3. **Test-Driven Development** ✓
   - Tests required for all functionality
   - Must search existing tests first

4. **Security-First Design** ✓
   - Input validation with Zod
   - Prisma for database operations
   - Access control same as ticket data

5. **Database Integrity** ✓
   - Prisma migrations for schema changes
   - Transactions for multi-step operations

## Existing Files Inventory

### Domain Analysis
The feature involves:
- **Job execution logging** (new domain)
- **Log storage and retrieval** (new domain)
- **UI display of logs** (extends existing job timeline)
- **Access control** (extends existing permission system)

### File Search Results

#### Backend/Database Files

1. **prisma/schema.prisma**
   - Contains current Job model with `logs: String?` field
   - Defines JobStatus enum and relationships to Ticket
   - Pattern reference for database schema changes

2. **app/api/jobs/[id]/status/route.ts**
   - Job status update endpoint called by GitHub Actions
   - Handles state transitions and terminal state processing
   - Pattern reference for job lifecycle hooks

3. **app/lib/job-state-machine.ts**
   - Defines valid job state transitions
   - Pattern reference for state management

4. **lib/types/job-types.ts**
   - TypeScript interfaces for job-related data
   - Pattern reference for type definitions

#### UI Components

1. **components/ticket/jobs-timeline.tsx**
   - Displays job timeline with expandable details
   - Pattern reference for job UI integration
   - Will need extension to include log viewing functionality

2. **components/timeline/job-event-timeline-item.tsx**
   - Individual job event display in timeline
   - Pattern reference for timeline integration

#### Utility Files

1. **lib/utils/job-display-names.ts**
   - Job display name formatting utilities
   - Pattern reference for job-related utilities

2. **lib/hooks/queries/useTicketJobs.ts**
   - Query hook for fetching ticket jobs
   - Pattern reference for data fetching

### Patterns to Follow

#### Error Handling Patterns

1. **Job Status Update (app/api/jobs/[id]/status/route.ts:100-120)**
   - Comprehensive try-catch blocks around API operations
   - Structured error responses with appropriate HTTP status codes
   - Detailed error logging with context (jobId, status, timing)
   - Non-blocking error handling for secondary operations (push notifications)

2. **State Machine Validation (app/api/jobs/[id]/status/route.ts:150-160)**
   - Validate state transitions before database operations
   - Use atomic conditional updates to prevent race conditions
   - Idempotent request handling for retry scenarios

#### Security Patterns

1. **Workflow Authentication (app/api/jobs/[id]/status/route.ts:30-40)**
   - Validate authentication before processing requests
   - Use dedicated validation functions (validateWorkflowAuth)
   - Return 401 for unauthorized access

2. **Input Validation (app/api/jobs/[id]/status/route.ts:60-80)**
   - Use Zod schemas for request body validation
   - Parse and validate all inputs before processing
   - Return 400 with detailed error information for invalid inputs

#### State Management Patterns

1. **Atomic Updates (app/api/jobs/[id]/status/route.ts:220-240)**
   - Use Prisma's updateMany with conditional where clause
   - Build update data dynamically to avoid undefined values
   - Re-read state after mutation to ensure consistency

2. **Terminal State Processing (app/api/jobs/[id]/status/route.ts:280-310)**
   - Identify terminal states (COMPLETED, FAILED, CANCELLED)
   - Trigger post-completion hooks only for terminal states
   - Use non-blocking operations for secondary effects

#### Database Patterns

1. **Conditional Updates (prisma/schema.prisma:Job model)**
   - Use Prisma's conditional update patterns
   - Maintain data integrity through proper relationships
   - Use appropriate field types and constraints

2. **Timestamp Management (app/api/jobs/[id]/status/route.ts:200-220)**
   - Set startedAt on first RUNNING transition
   - Set completedAt on terminal state transitions
   - Use database timestamps for consistency

## Research Findings

### Object Storage Provider Selection

**Decision**: Use AWS S3 for object storage
**Rationale**: 
- AWS S3 is widely supported and integrates well with Next.js/Prisma applications
- Provides scalability and reliability for log storage
- Cost-effective for the expected log volume
- Compatible with existing infrastructure patterns

**Alternatives considered**:
- Google Cloud Storage (similar capabilities but AWS has better Next.js integration)
- Azure Blob Storage (enterprise-focused, less relevant for this project)
- Local filesystem (not scalable, violates hybrid storage requirement)

### Log Capture Process Design

**Decision**: Implement log capture in job status update endpoint
**Rationale**:
- Job status updates already occur at the right lifecycle points
- Minimal changes to existing workflow
- Leverages existing authentication and validation

**Implementation Approach**:
- Extend `app/api/jobs/[id]/status/route.ts` to accept log data
- Add log processing after successful status update
- Implement hybrid storage (metadata in DB, content in S3)

### Log Format Normalization

**Decision**: Normalize logs to structured JSON format
**Rationale**:
- Consistent display across different agent types
- Easier parsing and filtering
- Better storage efficiency

**Log Entry Structure**:
```typescript
interface LogEntry {
  sequenceNumber: number;
  timestamp: string;
  messageType: 'INFO' | 'ERROR' | 'WARNING' | 'TOOL';
  content: string;
  toolName?: string;
  metadata?: Record<string, unknown>;
}
```

### UI Integration Approach

**Decision**: Extend existing jobs-timeline.tsx component
**Rationale**:
- Jobs timeline is the natural place for log access
- Consistent with existing job management UI
- Minimal disruption to user workflow

**Implementation Approach**:
- Add "View Logs" button to JobRow component
- Create modal dialog for log display
- Implement log fetching with TanStack Query

## Constitution Compliance

All design decisions comply with the AI Board Constitution:
- ✅ TypeScript-first development
- ✅ Component-driven architecture  
- ✅ Test-driven development
- ✅ Security-first design
- ✅ Database integrity
- ✅ Proper error handling patterns
- ✅ Consistent state management
