# AI Board Development Guidelines - Gemini CLI

Auto-generated from all feature plans. Last updated: 2024-07-14

## Active Technologies
- TypeScript + Next.js (AIB-613-copy-of-add)
- Prisma ORM + PostgreSQL (AIB-613-copy-of-add)
- Gemini CLI v1.2.0+ (AIB-613-copy-of-add)
- OpenTelemetry Protocol (AIB-613-copy-of-add)

## Project Structure
```
backend/
  api/
    credentials/
    workflows/
    telemetry/
  lib/
    agents.ts
    credentials.ts
    workflows.ts
    telemetry.ts
frontend/
  components/
    agents/
    settings/
    analytics/
    setup/
  lib/
    agents.ts
    setup.ts
scripts/
  run-agent.sh
prisma/
  schema.prisma
tests/
  credentials.test.ts
  workflows.test.ts
  telemetry.test.ts
```

## Commands
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start

# Run Gemini workflow
./scripts/run-agent.sh GEMINI speckit.yml
```

## Code Style
- TypeScript strict mode with explicit types
- shadcn/ui components for UI
- Prisma ORM for database operations
- TanStack Query for server state
- Vitest + React Testing Library for testing
- AES-256-GCM for credential encryption

## Recent Changes
- AIB-613-copy-of-add: Added Gemini CLI as AI Agent
  - Google credential storage with validation
  - Gemini agent selection and workflow dispatch
  - Gemini CLI integration with telemetry
  - Analytics dashboard with Gemini metrics
  - Project setup with Gemini option

## Gemini CLI Specific Guidelines

### Credential Management
- Store Google API keys and OAuth tokens securely
- Validate credentials before workflow execution
- Encrypt all credentials at rest using AES-256-GCM
- Never log credentials in plaintext

### Workflow Execution
- Only support speckit.yml, quick-impl.yml, and iterate.yml workflows
- Inject GEMINI_API_KEY or GEMINI_OAUTH_TOKEN environment variables
- Configure telemetry with OTLP endpoint and 60s interval
- Execute in headless mode: `gemini run --headless --no-interactive`

### Telemetry Collection
- Parse gemini_cli.api_response events for token counts
- Parse gemini_cli.tool_call events for tool usage
- Store raw OTLP events for debugging
- Calculate costs using pricing table

### Error Handling
- Implement exponential backoff for Google API rate limiting
- Retry transient failures up to 3 times
- Fail fast for unsupported workflows
- Log all errors with context

## Testing Requirements
- 100% test coverage for new functionality
- Extend existing test files where possible
- Unit tests for credential validation
- Integration tests for workflow dispatch
- E2E tests for complete user flows

## Security Requirements
- All inputs validated with Zod schemas
- Credentials encrypted at rest and in transit
- TLS 1.2+ for all network communications
- Regular security audits and dependency updates

## Performance Requirements
- Workflow dispatch < 5 seconds setup
- Gemini CLI execution < 30 minutes
- Telemetry processing < 1 second per event
- Analytics queries < 2 seconds

## Deployment Requirements
- Node.js v18.0.0+
- PostgreSQL 14+
- Redis 6+
- OpenTelemetry Collector

<!-- MANUAL ADDITIONS START -->
<!-- Add any manual additions here -->
<!-- MANUAL ADDITIONS END -->