# Research: Add Project Model

**Feature**: 012-add-project-model
**Date**: 2025-10-04

## Research Overview

This feature involves creating a database model to organize tickets by GitHub repository. All technical context was specified upfront with no unknowns requiring research.

## Technology Decisions

### 1. Prisma ORM for Database Schema

**Decision**: Use Prisma 6.x for schema definition, migrations, and type-safe database access

**Rationale**:
- Already established in project tech stack (constitution requirement)
- Type-safe client generation ensures TypeScript strict mode compliance
- Migration system provides version control for schema changes
- Supports PostgreSQL 14+ with full feature set
- Built-in support for unique constraints, indexes, and foreign keys

**Alternatives Considered**:
- Raw SQL migrations: Rejected - lacks type safety and violates constitution
- TypeORM: Rejected - not in approved tech stack
- Sequelize: Rejected - not in approved tech stack

### 2. Environment Variables for Configuration

**Decision**: Use process.env for GITHUB_OWNER and GITHUB_REPO in seed script

**Rationale**:
- Follows security-first design principle (constitution IV)
- Enables per-environment configuration (local, staging, production)
- Prevents hardcoding sensitive repository information
- Standard Node.js practice with Next.js support

**Alternatives Considered**:
- Hardcoded values: Rejected - violates security principles
- Database configuration table: Rejected - adds complexity for single-value config
- Config file: Rejected - harder to manage across environments

### 3. Idempotent Seed Implementation

**Decision**: Check for existing project before creation using findUnique

**Rationale**:
- Prevents duplicate projects on repeated seed execution
- Uses unique constraint (githubOwner, githubRepo) for lookup
- Enables safe re-running of seed script during development
- Follows database integrity principle (constitution V)

**Alternatives Considered**:
- upsert operation: Considered but findUnique + conditional create provides clearer intent
- Truncate and reseed: Rejected - data loss risk
- Skip seed if any data exists: Rejected - less precise, prevents partial seeding

### 4. Index Strategy

**Decision**: Add composite index on [githubOwner, githubRepo]

**Rationale**:
- Optimizes lookups by repository (common operation for GitHub integration)
- Supports unique constraint enforcement efficiently
- Improves query performance for <200ms target
- Small index size (two varchar fields)

**Alternatives Considered**:
- Separate indexes: Rejected - composite index serves both uniqueness and lookup
- No additional index: Rejected - would rely only on unique constraint index
- Full-text search index: Rejected - overkill for exact matches

## Best Practices Applied

### Prisma Schema Design
- Explicit field types with database modifiers (@db.VarChar(100))
- Auto-increment primary keys for simplicity
- Timestamp fields (createdAt, updatedAt) for audit trail
- Cascade delete for referential integrity (Ticket → Project)
- Descriptive model and field names

### Migration Workflow
- Use `prisma migrate dev` for development
- Use `prisma migrate deploy` for production
- Migration files version-controlled in `/prisma/migrations`
- Never manually alter production schema

### Seed Script Patterns
- Error handling for missing environment variables
- Idempotency checks before data creation
- Informative console logging for operations
- Proper Prisma client cleanup (disconnect)
- TypeScript strict mode compliance

## Integration Considerations

### GitHub Workflow Integration
- GitHub owner and repo fields enable future GitHub API calls
- Spec-kit workflow can use project.githubOwner and project.githubRepo
- Supports multiple repositories (multi-project scenarios)
- No GitHub token storage (security concern, future ticket)

### Ticket Association
- Every ticket must belong to a project (required foreign key)
- Cascade delete ensures cleanup when project removed
- Index on projectId for efficient ticket queries
- Default project created during seed for existing workflow

## Performance Characteristics

### Database Operations
- Project creation: Single INSERT operation
- Idempotency check: Single SELECT with composite index lookup
- Ticket queries by project: Indexed lookup via projectId
- Expected query time: <10ms for indexed lookups

### Scaling Considerations
- Model supports multiple projects/repositories
- Indexes ensure query performance scales with data volume
- Unique constraint prevents data anomalies at scale
- No N+1 query issues (proper foreign key relations)

## Security Analysis

### Threat Model
- **Threat**: Environment variable exposure
  - **Mitigation**: .env files in .gitignore, never committed
- **Threat**: SQL injection via repository names
  - **Mitigation**: Prisma parameterized queries only
- **Threat**: Duplicate project creation
  - **Mitigation**: Database-level unique constraint
- **Threat**: Orphaned tickets after project deletion
  - **Mitigation**: Cascade delete foreign key

### Security Compliance
- No authentication required (internal data model)
- No API endpoints exposing project data yet
- Environment variables never logged or exposed
- All database operations type-safe via Prisma

## Testing Strategy

### E2E Test Scenarios
1. **Seed Idempotency**: Run seed multiple times, verify single project created
2. **Environment Validation**: Missing env vars should throw clear error
3. **Unique Constraint**: Attempt duplicate project creation should fail
4. **Ticket Association**: Create ticket with projectId, verify relationship
5. **Cascade Delete**: Delete project, verify tickets deleted

### Test Implementation
- Playwright E2E tests in `/tests/foundation.spec.ts`
- Test database setup/teardown for isolation
- Verify actual database state, not mocked responses
- Follow TDD: tests before implementation (constitution III)

## Open Questions & Future Work

### Resolved
- ✅ How to prevent duplicate projects? → Unique constraint on (githubOwner, githubRepo)
- ✅ How to handle missing env vars? → Throw error with clear message
- ✅ How to support multiple repositories? → Multiple Project records with unique repos
- ✅ Where to store GitHub tokens? → Not in this feature (security concern, future ticket)

### Future Enhancements
- GitHub token encryption and storage (separate security-focused ticket)
- API endpoints for project CRUD operations
- Project selection UI for multi-repository support
- GitHub repository validation (verify repo exists and accessible)
- Webhook integration for repository events

## References

- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization/prisma-client-transactions-guide)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [PostgreSQL Unique Constraints](https://www.postgresql.org/docs/14/ddl-constraints.html#DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS)
