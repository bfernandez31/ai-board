# Data Model: Display Project Specifications

**Feature**: 027-display-project-specifications
**Date**: 2025-10-12

## Overview

This feature uses existing database entities with no schema changes. The only new "entity" is the file system resource (ProjectSpecification).

## Database Entities

### Project (Existing)

**Source**: Prisma schema (`prisma/schema.prisma`)

**Purpose**: Represents a project with associated GitHub repository information

**Fields**:
```prisma
model Project {
  id           Int      @id @default(autoincrement())
  name         String
  githubOwner  String   // GitHub repository owner
  githubRepo   String   // GitHub repository name
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relations
  tickets      Ticket[]
}
```

**Usage in Feature**:
- Query by `id` to fetch project details
- Use `githubOwner` and `githubRepo` to construct GitHub API request
- `name` displayed in board header

**Validation Rules**:
- `id`: Positive integer (validated via Zod schema)
- `githubOwner` and `githubRepo`: Non-empty strings (enforced at DB level)

**No Changes Required**: Feature uses existing Project model as-is

---

## File System Entities

### ProjectSpecification (Virtual Entity)

**Source**: Git repository file system

**Purpose**: Represents the project's specification document stored in Git

**Attributes**:
```typescript
interface ProjectSpecification {
  // Metadata
  projectId: number;          // Associated project ID
  githubOwner: string;        // Repository owner (from Project)
  githubRepo: string;         // Repository name (from Project)

  // File location
  filePath: string;           // Always "/specs/specifications/README.md"
  branch: string;             // Git branch (default: "main")

  // Content
  content: string;            // Markdown file contents (base64 decoded)
  size: number;               // File size in bytes
  lastModified: string;       // Git commit date (ISO 8601)
}
```

**Storage**: Git repository (not database)

**Retrieval**: Via GitHub API (Octokit)

**Lifecycle**:
1. Created: When README.md added to /specs/specifications/ in Git
2. Updated: When README.md modified via Git commit
3. Deleted: N/A (assumed to always exist per FR-009)

**Validation Rules**:
- `filePath`: Must be exactly `/specs/specifications/README.md`
- `content`: Valid markdown (syntax errors handled per FR-012)
- `size`: No maximum limit (per FR-013)

---

## API Response Models

### GET /api/projects/:projectId/spec

**Success Response** (200 OK):
```typescript
interface ProjectSpecResponse {
  content: string;              // Markdown file contents
  metadata: {
    projectId: number;          // Project ID from request
    projectName: string;        // Project name for display
    fileName: string;           // Always "README.md"
    filePath: string;           // Always "/specs/specifications/README.md"
    size: number;               // File size in bytes
    lastModified: string;       // ISO 8601 timestamp
    githubUrl: string;          // Link to file on GitHub
  };
}
```

**Error Response** (4xx/5xx):
```typescript
interface ProjectSpecError {
  error: string;                // Human-readable error message
  code: string;                 // Error code for client handling
  message?: string;             // Additional details (optional)
}
```

**Error Codes**:
- `VALIDATION_ERROR` (400): Invalid projectId
- `PROJECT_NOT_FOUND` (404): Project doesn't exist
- `FILE_NOT_FOUND` (404): README.md not found in repository
- `RATE_LIMIT` (429): GitHub API rate limit exceeded
- `GITHUB_API_ERROR` (500): GitHub API failure
- `INTERNAL_ERROR` (500): Unexpected server error

---

## Entity Relationships

```
┌─────────────────┐
│     Project     │ (Database)
│  (Existing)     │
├─────────────────┤
│ id              │◄──────┐
│ name            │       │
│ githubOwner     │───┐   │
│ githubRepo      │───┤   │ Used to fetch
├─────────────────┤   │   │
│ tickets[]       │   │   │
└─────────────────┘   │   │
                      │   │
                      ▼   ▼
           ┌──────────────────────────┐
           │  ProjectSpecification    │ (File System)
           │   (Virtual Entity)       │
           ├──────────────────────────┤
           │ filePath: /specs/...     │
           │ content: markdown        │
           │ size: bytes              │
           │ lastModified: timestamp  │
           └──────────────────────────┘
                      │
                      │ Retrieved via
                      ▼
           ┌──────────────────────────┐
           │     GitHub API           │
           │  (Octokit REST Client)   │
           └──────────────────────────┘
```

**Relationship Type**: 1:1 (One Project has one ProjectSpecification)

**Cardinality**:
- Project MUST exist (foreign key validation)
- ProjectSpecification SHOULD exist (assumed per FR-009)

**Integrity Constraints**:
- projectId must reference valid Project.id
- githubOwner + githubRepo must be valid GitHub repository
- README.md existence assumed (no explicit check before display)

---

## Data Access Patterns

### Pattern 1: Fetch Project Metadata

**Use Case**: Board header displays project name and doc icon

**Query**:
```typescript
const project = await prisma.project.findUnique({
  where: { id: projectId },
  select: { id: true, name: true }
});
```

**Performance**: O(1) - primary key lookup with index

---

### Pattern 2: Fetch Project Specification Content

**Use Case**: Specifications page displays markdown content

**Steps**:
1. Query Project (get githubOwner, githubRepo)
```typescript
const project = await prisma.project.findUnique({
  where: { id: projectId },
  select: { githubOwner: true, githubRepo: true, name: true }
});
```

2. Call GitHub API
```typescript
const content = await fetchProjectSpec({
  owner: project.githubOwner,
  repo: project.githubRepo
});
```

**Performance**:
- Database: O(1) - primary key lookup
- GitHub API: O(1) - single file fetch, ~100-200ms latency

---

## Data Validation

### Input Validation

**projectId** (Path Parameter):
```typescript
const ProjectIdSchema = z.string().regex(/^\d+$/).transform(Number);
```

**Validation Rules**:
- Must be numeric string
- Converts to positive integer
- Fails on negative numbers, zero, or non-numeric

---

### Content Validation

**Markdown Content**:
- No validation on server (raw markdown passed to client)
- Client-side: react-markdown handles invalid syntax gracefully
- Error display: "Unable to render specifications" (per FR-012)

---

## Caching Strategy

### Client-Side Caching

**Browser Cache**:
```typescript
// API route response headers
headers: {
  'Cache-Control': 'public, max-age=300, s-maxage=600' // 5 min client, 10 min CDN
}
```

**Rationale**: Specifications change infrequently, reduce GitHub API calls

---

### Server-Side Caching

**No server-side cache**:
- Specifications may update via Git commits
- GitHub API has built-in rate limiting (5000 req/hr)
- Vercel edge caching handles CDN layer

---

## Migration Notes

**Database Migrations**: None required

**Data Migration**: None required

**Backward Compatibility**: 100% compatible (no breaking changes)

---

## Future Considerations

### Potential Enhancements (Out of Scope)

1. **Specification History**: Track README.md versions over time
2. **Offline Mode**: Cache specifications in database for offline access
3. **Multiple Spec Files**: Support plan.md, tasks.md alongside README.md
4. **Version Pinning**: Allow viewing specs from specific Git commits

**Implementation**: Would require schema changes (new SpecificationCache table)
