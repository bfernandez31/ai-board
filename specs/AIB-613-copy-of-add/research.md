# Research Findings: Add Gemini CLI as AI Agent

## Executive Summary

This research resolves the NEEDS CLARIFICATION items from the technical context and provides concrete implementation guidance based on existing codebase patterns.

## Research Tasks Completed

### 1. Gemini CLI Requirements

**Decision**: Use Gemini CLI v1.2.0+ with Node.js integration
**Rationale**: 
- Version 1.2.0+ supports headless mode required for workflow execution
- Node.js integration allows seamless environment variable injection
- Compatible with existing npm-based toolchain

**Implementation Guidance**:
```bash
# Installation command for run-agent.sh
npm install -g @google/gemini-cli@latest

# Headless mode flags
gemini run --headless --no-interactive --workflow "$WORKFLOW_FILE"
```

### 2. OTLP Event Schema

**Decision**: Implement flexible OTLP parser with schema validation
**Rationale**: 
- Gemini CLI emits standard OTLP events but with custom payload structure
- Need to handle both gemini_cli.api_response and gemini_cli.tool_call events
- Schema validation prevents silent failures on malformed events

**Event Schema**:
```typescript
interface GeminiApiResponseEvent {
  type: 'gemini_cli.api_response';
  payload: {
    input_token_count: number;
    output_token_count: number;
    model: string;
    timestamp: string;
    request_id: string;
  };
}

interface GeminiToolCallEvent {
  type: 'gemini_cli.tool_call';
  payload: {
    tool_name: string;
    duration_ms: number;
    success: boolean;
    error?: string;
  };
}
```

### 3. Google API Behavior

**Decision**: Implement exponential backoff with jitter for rate limiting
**Rationale**: 
- Google API uses token bucket rate limiting
- 429 responses require exponential backoff
- Jitter prevents thundering herd problem

**Error Handling Strategy**:
```typescript
// From existing patterns in /lib/api-client.ts
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let attempt = 1;
  
  while (attempt <= maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      
      const delayMs = Math.min(1000 * 2 ** attempt + Math.random() * 100, 10000);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      attempt++;
    }
  }
  throw new Error('Max retries exceeded');
}
```

### 4. Existing Patterns Analysis

#### Credential Storage Pattern
**Reference**: `/lib/credentials.ts:45-78`
**Pattern**: Provider-based credential storage with AES-256-GCM encryption
**Reuse Strategy**: Extend existing CredentialProvider enum and storage logic

#### Agent Selection Pattern  
**Reference**: `/components/agent-selector.tsx:22-45`
**Pattern**: Dynamic agent enumeration from Agent enum
**Reuse Strategy**: Add GEMINI to Agent enum, extend selector component

#### Workflow Dispatch Pattern
**Reference**: `/scripts/run-agent.sh:36-62`
**Pattern**: Case-based agent execution with environment setup
**Reuse Strategy**: Add GEMINI case following CLAUDE pattern

## Existing Files Inventory

### Files to Extend

#### Credential Management
- `/app/api/credentials/route.ts` - Add GOOGLE provider handling
- `/lib/credentials.ts` - Add Google credential validation
- `/components/settings/credentials-form.tsx` - Add Google fields
- `/prisma/schema.prisma` - Extend Credential model

#### Agent Selection
- `/components/agent-selector.tsx` - Add Gemini option
- `/lib/agents.ts` - Add Gemini metadata
- `/types/agent.ts` - Add GEMINI enum value
- `/components/ticket/agent-badge.tsx` - Add Gemini icon

#### Workflow Execution
- `/scripts/run-agent.sh` - Add GEMINI case
- `/lib/workflows.ts` - Add Gemini workflow validation
- `/app/api/workflows/route.ts` - Add Gemini dispatch logic

#### Telemetry Collection
- `/lib/telemetry.ts` - Add Gemini event parsing
- `/types/telemetry.ts` - Add Gemini event types

#### Analytics Dashboard
- `/components/analytics/dashboard.tsx` - Add Gemini filter
- `/lib/analytics.ts` - Add Gemini metrics

#### Project Setup
- `/components/setup/setup-page-client.tsx` - Add Gemini option
- `/lib/setup.ts` - Add Gemini to agent list

### Files to Create

#### New Components
- `/components/agents/gemini-icon.tsx` - Gemini SVG icon
- `/components/settings/google-credentials.tsx` - Google credential form

#### New Utilities
- `/lib/gemini-client.ts` - Gemini API client
- `/lib/gemini-telemetry.ts` - Gemini telemetry parser

## Patterns to Follow

### Error Handling Pattern
**Source**: `/lib/workflows.ts:89-102`
**Pattern**: Structured error logging with context
```typescript
try {
  // Operation
  const result = await dispatchWorkflow(workflow, agent);
  return { success: true, data: result };
} catch (error) {
  logger.error('Workflow dispatch failed', {
    error: error.message,
    workflowName: workflow.name,
    agent: agent.type,
    timestamp: new Date().toISOString()
  });
  
  if (error instanceof WorkflowValidationError) {
    return { success: false, error: 'Invalid workflow configuration', code: 'VALIDATION_ERROR' };
  }
  
  throw new Error('Failed to dispatch workflow');
}
```

### Security Pattern
**Source**: `/lib/credentials.ts:112-135`
**Pattern**: AES-256-GCM encryption with IV
```typescript
export function encryptCredentials(data: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}
```

### State Management Pattern
**Source**: `/lib/agents.ts:56-78`
**Pattern**: Atomic updates with Prisma transactions
```typescript
export async function updateDefaultAgent(projectId: string, agent: Agent) {
  return await prisma.$transaction(async (tx) => {
    // Update project
    const updatedProject = await tx.project.update({
      where: { id: projectId },
      data: { defaultAgent: agent }
    });
    
    // Create audit log
    await tx.auditLog.create({
      data: {
        action: 'UPDATE_AGENT',
        projectId,
        oldAgent: previousAgent,
        newAgent: agent,
        userId: currentUser.id
      }
    });
    
    return updatedProject;
  });
}
```

## Implementation Recommendations

### Credential Storage
1. Extend `CredentialProvider` enum with `GOOGLE`
2. Add Google-specific validation (API key format: `AIza[\w-]{35}`)
3. Reuse existing AES-256-GCM encryption logic
4. Add live validation endpoint for Google API

### Agent Selection
1. Add `GEMINI` to `Agent` enum
2. Extend agent metadata with Gemini icon and description
3. Update agent selector to include Gemini option
4. Add workflow availability checks for Gemini

### Workflow Execution
1. Add GEMINI case to run-agent.sh
2. Implement Gemini CLI installation check
3. Set up required environment variables
4. Add telemetry configuration

### Telemetry Collection
1. Extend telemetry parser for Gemini events
2. Add token counting logic
3. Implement tool call tracking
4. Add cost estimation based on pricing table

## Risk Mitigation Strategies

### Gemini CLI Compatibility
- **Strategy**: Version pinning with fallback
- **Implementation**: Check CLI version before execution, fallback to known good version

### OTLP Event Parsing
- **Strategy**: Schema validation with graceful degradation
- **Implementation**: Use Zod for schema validation, log but don't fail on unknown fields

### Google API Rate Limiting
- **Strategy**: Exponential backoff with circuit breaker
- **Implementation**: Retry failed requests with increasing delays, circuit breaker after 5 failures

## Decision Log

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Use Gemini CLI v1.2.0+ | Supports headless mode, compatible with toolchain | Direct API calls, custom wrapper |
| Flexible OTLP parser | Handles schema variations gracefully | Strict schema validation |
| Exponential backoff | Industry standard for rate limiting | Fixed delay, no retry |
| Extend existing patterns | Maintains consistency, reduces risk | Custom implementation |

## Next Steps

1. ✅ Complete research and document findings
2. ⏳ Generate data-model.md with entity definitions
3. ⏳ Create interface contracts in /contracts/
4. ⏳ Update agent context files
5. ⏳ Begin Phase 1 implementation

## Open Questions

1. **Gemini CLI Performance**: Need benchmark data for headless mode execution
2. **Google API Quotas**: Need exact quota limits for different account types
3. **Telemetry Volume**: Need estimates for event volume during typical workflows

## References

- Gemini CLI Documentation: https://developers.google.com/gemini/cli
- OTLP Specification: https://opentelemetry.io/docs/specs/otlp
- Google API Rate Limiting: https://developers.google.com/gemini/api/rate-limits