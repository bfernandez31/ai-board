# API Contracts: Project Model

**Feature**: 012-add-project-model
**Date**: 2025-10-04

## Overview

This feature is database-layer only with no API endpoints. Contracts will be defined in future features when project CRUD APIs are implemented.

## Current Scope

### Database Schema Contract

The Project model is accessible via Prisma Client with the following TypeScript interface:

```typescript
interface Project {
  id: number;
  name: string;
  description: string;
  githubOwner: string;
  githubRepo: string;
  createdAt: Date;
  updatedAt: Date;
  tickets: Ticket[];
}
```

### Seed Contract

The seed operation guarantees:
- **Idempotency**: Running multiple times produces same result (one default project)
- **Validation**: Throws error if GITHUB_OWNER or GITHUB_REPO missing
- **Atomicity**: Project creation succeeds or fails completely
- **Consistency**: Unique constraint enforced at database level

### Database Constraints Contract

```typescript
// Unique constraint on repository
@@unique([githubOwner, githubRepo])

// Index for efficient lookups
@@index([githubOwner, githubRepo])

// Foreign key with cascade delete
Ticket.projectId → Project.id (CASCADE)
```

## Future API Contracts

When project CRUD APIs are added, they will follow these patterns:

### GET /api/projects (Future)
```typescript
// Response
{
  projects: Project[];
  total: number;
}
```

### GET /api/projects/:id (Future)
```typescript
// Response
{
  project: Project;
  tickets: Ticket[];
}
```

### POST /api/projects (Future)
```typescript
// Request
{
  name: string;           // 1-100 chars
  description: string;    // 1-1000 chars
  githubOwner: string;    // 1-100 chars
  githubRepo: string;     // 1-100 chars
}

// Response
{
  project: Project;
}

// Errors
400 - Invalid input (validation error)
409 - Duplicate repository (unique constraint)
```

### PATCH /api/projects/:id (Future)
```typescript
// Request (all fields optional)
{
  name?: string;
  description?: string;
}

// Response
{
  project: Project;
}

// Errors
400 - Invalid input
404 - Project not found
```

### DELETE /api/projects/:id (Future)
```typescript
// Response
204 - No Content

// Errors
404 - Project not found
// Note: Cascade deletes all tickets
```

## Contract Testing

### Current Tests (Seed Operation)
- Seed idempotency: Run seed twice, verify single project
- Environment validation: Missing env vars throw error
- Unique constraint: Duplicate repo creation fails

### Future Tests (API Endpoints)
- Schema validation tests for each endpoint
- Status code verification
- Error response format validation
- Relationship integrity tests
