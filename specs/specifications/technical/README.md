# Technical Documentation

Comprehensive technical reference for the AI Board application. This documentation consolidates all technical implementation details extracted from feature specifications.

## Purpose

This documentation serves as the definitive technical reference for:
- **New Developers**: Understanding how the system works
- **Maintainers**: Finding implementation patterns and conventions
- **DevOps**: Deployment and CI/CD configuration
- **QA Engineers**: Testing infrastructure and patterns

## Documentation Structure

### Architecture

Complete system architecture, design patterns, and technology stack.

**[overview.md](architecture/overview.md)**
- Application architecture and framework structure
- Project organization and directory layout
- Data flow patterns and request lifecycle
- Multi-tenancy and authorization patterns
- External integrations overview
- Performance optimization strategies
- Security architecture
- Scalability considerations

**[data-model.md](architecture/data-model.md)**
- Complete Prisma schema reference
- Database relationships and constraints
- Indexes and query optimization
- Enums and type definitions
- JSON field structures
- Migration strategy
- Data validation rules

**[stack.md](architecture/stack.md)**
- Technology stack with exact versions
- Runtime and framework configuration
- Database and ORM setup
- UI libraries and styling
- Authentication and state management
- Testing frameworks
- CI/CD tooling
- Environment variables
- Browser support matrix

### API

RESTful API documentation with complete endpoint reference.

**[endpoints.md](api/endpoints.md)**
- Complete endpoint reference (50+ endpoints)
- HTTP methods, authentication, authorization
- Request/response formats with examples
- Error response structures and codes
- Transition logic and workflow automation
- Stage-based permissions and validation
- Performance requirements (<100ms p95)

**[schemas.md](api/schemas.md)**
- Zod validation schemas
- Request/response type definitions
- Optimistic concurrency control patterns
- Character validation rules
- Stage-based editing restrictions
- Error formatting and handling
- Type inference patterns

### Implementation

Core implementation patterns and code organization.

**[state-management.md](implementation/state-management.md)**
- TanStack Query v5.90.5 configuration
- Query hooks and mutation hooks
- Optimistic updates with rollback
- Real-time polling patterns
- Cache invalidation strategies
- Error handling patterns
- Performance optimization
- Testing patterns

**[authentication.md](implementation/authentication.md)**
- NextAuth.js configuration
- Preview-only credentials login
- Session management (JWT in app runtime, database in tests)
- Guarded test-user override for automated tests
- Authorization patterns (project ownership)
- Test user management
- Sign-in page implementation
- AI-BOARD system user
- Security considerations

**[plugin-architecture.md](implementation/plugin-architecture.md)**
- Plugin structure (commands, templates, scripts, skills)
- Complete command catalog with stage mapping
- Workflow loading mechanism (sparse double checkout + symlinks)
- Multi-agent command execution (Claude Code vs Codex)
- Plugin installation (local, self-management, CI/CD)
- External project requirements

**[integrations.md](implementation/integrations.md)**
- GitHub Actions integration (Octokit)
- Workflow dispatch patterns
- Cloudinary CDN integration
- Image upload/delete operations
- Vercel deployment integration
- Auto-ship workflow
- Environment variables
- Error handling and retries

**[utilities.md](implementation/utilities.md)**
- Job display name mapping
- Conversation event transformation
- Timeline merging and sorting
- Authorization helpers
- Date utilities
- Common helper functions

### Quality

Testing infrastructure and deployment processes.

**[testing.md](quality/testing.md)**
- Test organization (Playwright + Vitest)
- Data isolation patterns (`[e2e]` prefix)
- Reserved project IDs (1-2 for tests)
- Test user management
- API contract tests
- E2E workflow tests
- Unit tests
- Test utilities and helpers
- CI/CD integration
- Coverage targets

**[deployment.md](quality/deployment.md)**
- GitHub Actions workflows (4 workflows)
- Environment configuration (secrets/variables)
- Vercel deployment strategy
- Database migration process
- Branch strategy and protection
- Monitoring and logging
- Performance optimization
- Security best practices
- Disaster recovery
- Cost optimization

## Quick Navigation

### By Role

**Backend Developer**:
- [architecture/data-model.md](architecture/data-model.md) - Database schema
- [api/endpoints.md](api/endpoints.md) - API reference
- [api/schemas.md](api/schemas.md) - Validation schemas
- [implementation/authentication.md](implementation/authentication.md) - Auth patterns

**Frontend Developer**:
- [architecture/stack.md](architecture/stack.md) - UI libraries and tools
- [implementation/state-management.md](implementation/state-management.md) - TanStack Query patterns
- [implementation/utilities.md](implementation/utilities.md) - Helper functions and utilities
- [api/endpoints.md](api/endpoints.md) - API contracts
- [api/schemas.md](api/schemas.md) - Request/response types

**DevOps Engineer**:
- [quality/deployment.md](quality/deployment.md) - CI/CD and deployment
- [implementation/integrations.md](implementation/integrations.md) - External services
- [architecture/overview.md](architecture/overview.md) - System architecture

**QA Engineer**:
- [quality/testing.md](quality/testing.md) - Testing infrastructure
- [api/endpoints.md](api/endpoints.md) - API contracts for testing
- [architecture/data-model.md](architecture/data-model.md) - Test data models

### By Feature

**Tickets**:
- CRUD operations: [api/endpoints.md](api/endpoints.md#ticket-endpoints)
- Data model: [architecture/data-model.md](architecture/data-model.md#ticket)
- State management: [implementation/state-management.md](implementation/state-management.md#tickets-query)
- Validation: [api/schemas.md](api/schemas.md#ticket-schemas)

**Comments**:
- API endpoints: [api/endpoints.md](api/endpoints.md#comment-endpoints)
- Real-time updates: [implementation/state-management.md](implementation/state-management.md#comments-query-with-polling)
- Timeline utilities: [implementation/utilities.md](implementation/utilities.md#conversation-events)
- Data model: [architecture/data-model.md](architecture/data-model.md#comment)

**Workflow Automation**:
- GitHub Actions: [quality/deployment.md](quality/deployment.md#github-actions-workflows)
- Job tracking: [architecture/data-model.md](architecture/data-model.md#job)
- Workflow dispatch: [implementation/integrations.md](implementation/integrations.md#github-actions-integration)

**Image Attachments**:
- Cloudinary integration: [implementation/integrations.md](implementation/integrations.md#cloudinary-cdn-integration)
- API endpoints: [api/endpoints.md](api/endpoints.md#image-attachment-endpoints)
- Data structure: [architecture/data-model.md](architecture/data-model.md#json-fields)

**Authentication**:
- NextAuth setup: [implementation/authentication.md](implementation/authentication.md#nextauthjs-configuration)
- Authorization patterns: [implementation/authentication.md](implementation/authentication.md#authorization-patterns)
- Test auth: [implementation/authentication.md](implementation/authentication.md#mock-authentication-developmenttest)

### By Task

**Adding a New API Endpoint**:
1. Define schema: [api/schemas.md](api/schemas.md)
2. Check auth pattern: [implementation/authentication.md](implementation/authentication.md#authenticated-api-route)
3. Follow conventions: [api/endpoints.md](api/endpoints.md#error-response-format)
4. Add tests: [quality/testing.md](quality/testing.md#api-contract-test)

**Adding a New Feature**:
1. Check architecture: [architecture/overview.md](architecture/overview.md)
2. Update data model: [architecture/data-model.md](architecture/data-model.md)
3. Create API endpoints: [api/endpoints.md](api/endpoints.md)
4. Implement state management: [implementation/state-management.md](implementation/state-management.md)
5. Add tests: [quality/testing.md](quality/testing.md)

**Debugging Production Issues**:
1. Check monitoring: [quality/deployment.md](quality/deployment.md#monitoring--logging)
2. Review error patterns: [api/endpoints.md](api/endpoints.md#error-response-format)
3. Check workflow logs: [quality/deployment.md](quality/deployment.md#github-actions-logs)
4. Verify environment: [quality/deployment.md](quality/deployment.md#environment-configuration)

**Optimizing Performance**:
1. Review targets: [architecture/stack.md](architecture/stack.md#performance-targets)
2. Check indexes: [architecture/data-model.md](architecture/data-model.md#indexes-strategy)
3. Optimize queries: [implementation/state-management.md](implementation/state-management.md#performance-optimization)
4. Monitor builds: [quality/deployment.md](quality/deployment.md#build-performance)

## Documentation Conventions

### Code Examples

All code examples use TypeScript with exact syntax from the codebase:

```typescript
// ✅ Good: Actual code pattern
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();
  // ...
}

// ❌ Bad: Pseudocode or simplified
function getStuff() {
  // check auth
  // return data
}
```

### File Paths

All file paths are absolute from project root:

```
✅ app/api/projects/[projectId]/tickets/route.ts
❌ api/projects/tickets/route.ts
❌ ../api/tickets/route.ts
```

### Version Numbers

Exact versions specified where critical:

```
✅ Next.js 16
✅ Node.js 22.20.0 LTS
✅ TanStack Query v5.90.5
❌ Next.js (latest)
❌ Node.js 22.x
```

### External References

Links to specifications when appropriate:

```markdown
See [Feature 048](../../specifications/048-description-ticket-change/spec.md) for UTF-8 character support details.
```

## Maintenance

### Updating Documentation

When implementing features:
1. Update relevant technical doc files
2. Keep code examples synchronized with actual code
3. Add new patterns to appropriate sections
4. Update version numbers when dependencies change

### Validation

Before committing documentation updates:
- [ ] Code examples compile/run
- [ ] File paths are correct
- [ ] Version numbers are current
- [ ] Links work (both internal and external)
- [ ] Examples match codebase conventions

## Contributing

### Adding New Sections

When adding new implementation patterns:
1. Choose appropriate file (architecture/api/implementation/quality)
2. Follow existing structure and conventions
3. Include code examples with actual syntax
4. Add to Quick Navigation if significant

### File Organization

- **architecture/**: System design and data models
- **api/**: API contracts and schemas
- **implementation/**: Core implementation patterns
- **quality/**: Testing and deployment

Keep files focused and avoid duplication. Cross-reference other files when needed.

## Support

For questions about:
- **Implementation Patterns**: See [implementation/](implementation/)
- **API Contracts**: See [api/endpoints.md](api/endpoints.md)
- **Data Models**: See [architecture/data-model.md](architecture/data-model.md)
- **Deployment**: See [quality/deployment.md](quality/deployment.md)
- **Testing**: See [quality/testing.md](quality/testing.md)

For feature specifications, see [../specifications/](../specifications/)
