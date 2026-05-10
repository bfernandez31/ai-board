# Research: Admin Section with Claude Code Insights Report

## Technical Context

### Existing Files Analysis

#### 1. Authentication & Authorization
- **File**: `lib/db/users.ts`
  - Contains `requireAuth()` function used for protecting API routes
  - Supports both session-based and token-based authentication
  - **Pattern**: Use `requireAuth(request)` in API routes to enforce authentication

- **File**: `app/api/settings/profile/route.ts`
  - Example of protected API route using `requireAuth()`
  - Returns 401 for unauthorized access
  - **Pattern**: Wrap route logic in try-catch, return structured error responses

#### 2. API Route Structure
- **Directory**: `app/api/`
  - Follows Next.js App Router convention with `route.ts` files
  - Organized by resource domain (settings, projects, tickets, etc.)
  - **Pattern**: Create `app/api/admin/insights/route.ts` for insights API

#### 3. Component Architecture
- **Directory**: `components/`
  - Feature-based organization (settings, projects, tickets)
  - Uses shadcn/ui components exclusively
  - Client components marked with `'use client'` directive
  - **Pattern**: Create `components/admin/` directory for admin-specific components

#### 4. Job Management
- **File**: `components/board/job-status-indicator.tsx`
  - Complex component showing job status with animations
  - Supports multiple job types and statuses
  - **Pattern**: Reuse for showing analysis job status

- **Model**: `Job` in `prisma/schema.prisma`
  - Contains status, telemetry, timestamps
  - **Pattern**: Extend with new job type for insights analysis

#### 5. Database Models
- **File**: `prisma/schema.prisma`
  - Contains `Job`, `Session`, `Ticket`, `User` models
  - Uses Prisma ORM with PostgreSQL
  - **Pattern**: Add new model for insights reports or extend existing Job model

#### 6. Testing Patterns
- **File**: `tests/integration/jobs/ticket-jobs.test.ts`
  - Uses Vitest for integration testing
  - Follows Testing Trophy architecture
  - **Pattern**: Create integration tests for admin API endpoints

### Patterns to Follow

#### 1. Error Handling Pattern
**Reference**: `app/api/settings/profile/route.ts:70-81`
```typescript
try {
  // Route logic
} catch (error) {
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  console.error("API error:", error)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}
```

**Application**: All admin API routes must follow this try-catch pattern with structured error responses.

#### 2. Authentication Pattern
**Reference**: `lib/db/users.ts:245-250`
```typescript
export async function requireAuth(request?: NextRequest): Promise<string> {
  if (request) {
    const user = await getCurrentUserOrToken(request)
    return user.id
  }
  const user = await getCurrentUser()
  return user.id
}
```

**Application**: Use `requireAuth(request)` in all protected admin routes.

#### 3. Component Organization Pattern
**Reference**: `components/settings/` directory
- Feature-based folder structure
- Multiple related components in same directory
- Client components marked with `'use client'`

**Application**: Create `components/admin/` with:
- `insights-page.tsx` - Main admin insights page
- `report-viewer.tsx` - Report rendering component
- `analysis-controls.tsx` - Run analysis controls

#### 4. API Response Structure
**Reference**: `app/api/settings/profile/route.ts:15-24`
```typescript
interface ProfileResponse {
  name: string
  email: string
  // ... other fields
}

export async function GET(request: NextRequest) {
  // ... logic
  const response: ProfileResponse = { /* ... */ }
  return NextResponse.json(response)
}
```

**Application**: Define TypeScript interfaces for all API responses.

#### 5. Job Status Display Pattern
**Reference**: `components/board/job-status-indicator.tsx`
- Complex status indicator with animations
- Supports multiple job types
- Accessible with ARIA labels

**Application**: Reuse this component for showing analysis job status.

### Technology Decisions

#### 1. Report Storage: Blob Storage
**Decision**: Store HTML reports in blob storage (e.g., S3, Vercel Blob)
**Rationale**: 
- Better scalability for large HTML reports
- Consistent with existing artifact storage patterns
- Cost-effective for read-heavy workloads
**Alternatives considered**: Database storage (rejected due to size limitations)

#### 2. Authentication: Config-Driven Allowlist
**Decision**: Use configuration file for admin user allowlist
**Rationale**:
- No database schema changes required
- Easy to manage and audit
- Can be environment-specific
**Alternatives considered**: Database role system (rejected due to complexity)

#### 3. Job Execution: Background Processing
**Decision**: Use existing job system with new job type
**Rationale**:
- Leverages existing infrastructure
- Consistent monitoring and error handling
- Familiar patterns for developers
**Alternatives considered**: Separate queue system (rejected due to complexity)

#### 4. Frontend Framework: Next.js with shadcn/ui
**Decision**: Use Next.js App Router with shadcn/ui components
**Rationale**:
- Consistent with existing codebase
- Good developer experience
- Accessible components out of the box
**Alternatives considered**: Custom UI library (rejected due to inconsistency)

### Constitution Compliance Check

✅ **TypeScript-First**: All code will use strict TypeScript with explicit types
✅ **Component-Driven**: Follows shadcn/ui patterns and feature-based organization
✅ **Test-Driven**: Will include integration tests following Testing Trophy
✅ **Security-First**: Input validation, authentication middleware, structured errors
✅ **Database Integrity**: Uses Prisma migrations for any schema changes

### Open Questions (NEEDS CLARIFICATION)

1. **Admin User Configuration**: Where should the admin allowlist be stored? (.env, config file, database?)
2. **Report Generation**: What specific Claude API endpoint/method generates insights reports?
3. **Session Filtering**: How to identify "Claude Code agent sessions" vs other agent sessions?
4. **Blob Storage Provider**: Which specific blob storage provider to use (S3, Vercel Blob, etc.)?
5. **Job Type Classification**: What job type constant should be used for insights analysis jobs?
