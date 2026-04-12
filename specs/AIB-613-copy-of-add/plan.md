# Implementation Plan: Add Gemini CLI as AI Agent (Google Provider)

**Feature Branch**: `AIB-613-copy-of-add`
**Created**: 2024-07-14
**Status**: Planning

## Technical Context

### Architecture Overview
- **TypeScript/Next.js** application with shadcn/ui components
- **Prisma ORM** for database operations with PostgreSQL backend
- **TanStack Query v5** for server state management
- **Vitest + React Testing Library** for testing
- **Playwright** for E2E testing
- **NextAuth.js** for authentication (when implemented)

### Key Domains Impacted
1. **Credential Management**: Store and validate Google credentials
2. **Agent Selection**: Add Gemini to agent selectors and workflow dispatch
3. **Workflow Execution**: Extend run-agent.sh for Gemini CLI support
4. **Telemetry Collection**: Parse Gemini CLI OTLP events
5. **Analytics Dashboard**: Include Gemini in agent filters and metrics
6. **Project Setup**: Add Gemini to onboarding agent selection

### Dependencies
- **Gemini CLI**: Google's official CLI tool for AI Studio API
- **OTLP Protocol**: OpenTelemetry Protocol for telemetry collection
- **AES-256-GCM**: Encryption standard for credential storage
- **Existing Provider Pattern**: Reuse credential storage and agent selection patterns

### Integration Points
- **Credential Storage**: Extend existing provider-based credential system
- **Agent Selection**: Add GEMINI enum to Agent type and update selectors
- **Workflow Dispatch**: Add Gemini case to run-agent.sh script
- **Telemetry Parsing**: Extend event parser for gemini_cli.* events
- **Analytics**: Make agent filtering dynamic based on Agent enum

### Unknowns (NEEDS CLARIFICATION)
- Exact Gemini CLI installation requirements and version compatibility
- Complete OTLP event schema for Gemini CLI telemetry
- Google API rate limiting behavior and error handling
- Specific error codes and retry logic for Gemini CLI failures
- Performance characteristics of Gemini CLI in headless mode

## Constitution Check

### TypeScript-First Development
✅ All new code will be TypeScript with strict mode
✅ Type annotations for all function parameters and return types
✅ Interfaces for API responses and database models

### Component-Driven Architecture
✅ Will use shadcn/ui components for UI elements
✅ Feature-based folder structure for Gemini components
✅ Server Components by default, Client Components only where needed

### Test-Driven Development
✅ Will follow Testing Trophy architecture
✅ Search existing tests first, extend rather than duplicate
✅ Mocks will target same module instances as imports
✅ No conditional assertions in tests

### Security-First Design
✅ Zod validation for all Google credential inputs
✅ AES-256-GCM encryption for stored credentials
✅ Environment variables for sensitive data
✅ Input validation before processing

### Database Integrity
✅ Prisma migrations for schema changes
✅ Transactions for multi-step credential operations
✅ Soft deletes for credential management
✅ Database constraints enforced at schema level

## Gate Evaluation

### Gate 1: Security Compliance
**Status**: PASS
- Credential encryption matches existing pattern (AES-256-GCM)
- Input validation required for all credential fields
- No sensitive data exposed in API responses

### Gate 2: Architecture Compliance
**Status**: PASS
- Follows existing provider pattern for credentials
- Extends existing agent selection architecture
- Reuses workflow dispatch infrastructure

### Gate 3: Test Coverage
**Status**: PASS
- Testing strategy defined in constitution
- Will extend existing test files where possible
- New test files only for new domains

### Gate 4: Specification Clarity
**Status**: WARNING - Unknowns identified
- Gemini CLI specifics need research
- OTLP event schema needs clarification
- Error handling patterns need definition

## Phase 0: Research

### Research Tasks
1. **Gemini CLI Requirements**: Installation, version compatibility, headless mode
2. **OTLP Event Schema**: Complete event types and payload structure
3. **Google API Behavior**: Rate limiting, error codes, retry logic
4. **Existing Patterns**: Review Claude/Mistral implementations for reuse

### Existing Files Inventory

#### Credential Management
- `/app/api/credentials/route.ts` - Credential API endpoints
- `/lib/credentials.ts` - Credential storage and validation logic
- `/components/settings/credentials-form.tsx` - Credential input form
- `/prisma/schema.prisma` - Database schema with Credential model

#### Agent Selection
- `/components/agent-selector.tsx` - Agent selection dropdown
- `/lib/agents.ts` - Agent definitions and metadata
- `/types/agent.ts` - Agent type definitions
- `/components/ticket/agent-badge.tsx` - Agent display on tickets

#### Workflow Execution
- `/scripts/run-agent.sh` - Agent execution script
- `/lib/workflows.ts` - Workflow dispatch logic
- `/app/api/workflows/route.ts` - Workflow API endpoints

#### Telemetry Collection
- `/lib/telemetry.ts` - Telemetry parsing and storage
- `/types/telemetry.ts` - Telemetry event types
- `/prisma/schema.prisma` - Job and Telemetry models

#### Analytics Dashboard
- `/components/analytics/dashboard.tsx` - Main dashboard component
- `/components/analytics/agent-filter.tsx` - Agent filter component
- `/lib/analytics.ts` - Analytics data fetching

#### Project Setup
- `/components/setup/setup-page-client.tsx` - Project setup page
- `/lib/setup.ts` - Setup logic and agent enumeration

### Patterns to Follow

#### Error Handling (from `/lib/workflows.ts`)
```typescript
try {
  // Operation logic
} catch (error) {
  logger.error('Workflow dispatch failed', { error, workflowName, ticketId });
  throw new Error('Failed to dispatch workflow');
}
```

#### Security (from `/lib/credentials.ts`)
```typescript
// Encryption using AES-256-GCM
export function encryptCredentials(credentials: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey, iv);
  // ... encryption logic
}
```

#### State Management (from `/lib/agents.ts`)
```typescript
// Atomic agent selection updates
export async function updateAgentSelection(projectId: string, agent: Agent) {
  return await prisma.project.update({
    where: { id: projectId },
    data: { defaultAgent: agent }
  });
}
```

## Phase 1: Design & Contracts

### Data Model

#### GoogleCredential Entity
```typescript
interface GoogleCredential {
  id: string;
  provider: 'GOOGLE';
  apiKey?: string;
  oauthToken?: string;
  validationStatus: 'PENDING' | 'VALID' | 'INVALID';
  encryptedData: string; // AES-256-GCM encrypted
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
```

#### AgentMetadata Entity
```typescript
interface AgentMetadata {
  agent: 'GEMINI' | 'CLAUDE' | 'CODEX' | 'MISTRAL';
  label: string;
  iconPath: string;
  description: string;
  isAvailable: boolean;
}
```

#### WorkflowDispatch Contract
```typescript
interface WorkflowDispatchRequest {
  workflowName: 'speckit.yml' | 'quick-impl.yml' | 'iterate.yml';
  agent: 'GEMINI' | 'CLAUDE' | 'CODEX' | 'MISTRAL';
  ticketId: string;
  projectId: string;
}
```

### Interface Contracts

#### Credential Storage API
**Endpoint**: `POST /api/credentials`
**Request**:
```typescript
{
  provider: 'GOOGLE',
  apiKey?: string,
  oauthToken?: string
}
```
**Response**:
```typescript
{
  success: boolean,
  credentialId: string,
  validationStatus: 'PENDING' | 'VALID' | 'INVALID'
}
```

#### Agent Selection API
**Endpoint**: `PUT /api/projects/:id/agent`
**Request**:
```typescript
{
  agent: 'GEMINI' | 'CLAUDE' | 'CODEX' | 'MISTRAL'
}
```
**Response**:
```typescript
{
  success: boolean,
  project: { id: string, defaultAgent: string }
}
```

### Workflow Artifacts

#### Gemini Workflow Dispatch
**File**: `/scripts/run-agent.sh`
**Changes**: Add GEMINI case
```bash
case "$AGENT" in
  GEMINI)
    # Install Gemini CLI if not present
    if ! command -v gemini &> /dev/null; then
      echo "Installing Gemini CLI..."
      # Installation logic
    fi
    
    # Set up environment
    export GEMINI_API_KEY="$GEMINI_API_KEY"
    export GEMINI_OAUTH_TOKEN="$GEMINI_OAUTH_TOKEN"
    export GEMINI_TELEMETRY_ENDPOINT="$TELEMETRY_ENDPOINT"
    export GEMINI_TELEMETRY_INTERVAL="60s"
    
    # Execute in headless mode
    gemini run --headless --workflow "$WORKFLOW_FILE"
    ;;
```

#### Telemetry Collection Workflow
**File**: `/lib/telemetry.ts`
**Changes**: Add Gemini event parsing
```typescript
export function parseTelemetryEvent(event: TelemetryEvent) {
  switch (event.type) {
    case 'gemini_cli.api_response':
      return {
        inputTokens: event.payload.input_token_count,
        outputTokens: event.payload.output_token_count
      };
    case 'gemini_cli.tool_call':
      return {
        toolName: event.payload.tool_name,
        duration: event.payload.duration_ms
      };
    // ... other cases
  }
}
```

## Testing Strategy

### Test File Inventory
- **Credentials**: Extend `/tests/credentials.test.ts`
- **Agent Selection**: Extend `/tests/agent-selector.test.tsx`
- **Workflow Dispatch**: Extend `/tests/workflows.test.ts`
- **Telemetry Parsing**: Extend `/tests/telemetry.test.ts`
- **Analytics**: Extend `/tests/analytics.test.tsx`
- **Project Setup**: Extend `/tests/setup.test.tsx`

### Test Coverage Plan
1. **Unit Tests**: Credential validation, agent selection logic
2. **Component Tests**: Agent selector UI, credential form interactions
3. **Integration Tests**: Workflow dispatch with Gemini, telemetry parsing
4. **E2E Tests**: Full workflow execution, analytics dashboard

## Implementation Phases

### Phase 1: Foundation (Days 1-3)
- [ ] Add GOOGLE provider to credential storage
- [ ] Implement Gemini credential validation
- [ ] Add GEMINI to Agent enum and metadata
- [ ] Update agent selector components
- [ ] Add Gemini icon assets

### Phase 2: Workflow Integration (Days 4-7)
- [ ] Extend run-agent.sh for Gemini CLI
- [ ] Add workflow availability checks
- [ ] Implement environment variable injection
- [ ] Set up telemetry configuration
- [ ] Add telemetry event parsing

### Phase 3: Analytics & Setup (Days 8-10)
- [ ] Make analytics agent filtering dynamic
- [ ] Add Gemini to dashboard filters
- [ ] Implement cost estimation logic
- [ ] Update project setup agent selection
- [ ] Fix Mistral inclusion issues

### Phase 4: Testing & Validation (Days 11-14)
- [ ] Write and run unit tests
- [ ] Write and run component tests
- [ ] Write and run integration tests
- [ ] Write and run E2E tests
- [ ] Manual validation of all user stories

## Risk Assessment

### High Risks
- **Gemini CLI Compatibility**: Unknown version requirements and behavior
- **OTLP Event Parsing**: Schema might differ from expectations
- **Google API Rate Limiting**: Could impact workflow reliability

### Mitigation Strategies
- Research Gemini CLI thoroughly before implementation
- Build flexible telemetry parser that handles unknown fields
- Implement robust error handling and retry logic
- Start with limited beta testing before full rollout

## Success Metrics

### Implementation Success
- All user stories implemented and tested
- 100% test coverage for new functionality
- No regressions in existing functionality
- Constitution compliance verified

### User Success
- Users can store and validate Google credentials successfully
- Gemini workflows complete with proper telemetry
- Analytics dashboard shows accurate Gemini metrics
- Project setup includes Gemini as option

## Generated Artifacts

- `research.md` - Research findings and decisions
- `data-model.md` - Entity definitions and relationships
- `/contracts/` - API and interface contracts
- `/workflows/` - Workflow definitions and command specs

## Next Steps

1. Complete Phase 0 research and resolve all NEEDS CLARIFICATION
2. Generate research.md with findings
3. Update agent context files
4. Begin Phase 1 implementation
