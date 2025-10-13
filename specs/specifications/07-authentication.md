# Authentication & Authorization

## Overview

This domain covers user authentication and authorization. The system uses NextAuth.js with mock authentication in development/test environments to support multi-user access while maintaining data isolation between users.

**Current Capabilities**:
- NextAuth.js-based authentication system
- Mock authentication bypass for development and E2E tests
- User ownership of projects
- Session-based authentication
- Server-side authentication checks

---

## User Authentication

**Purpose**: Users need to authenticate to access the system and manage their projects. The system provides a flexible authentication layer that supports both real authentication in production and mock authentication for development and testing.

### What It Does

The system provides authentication through NextAuth.js:

**Authentication Methods**:
- Production: Configurable authentication providers (OAuth, credentials, etc.)
- Development/Test: Mock authentication with hardcoded test user
- E2E Tests: Automatic authentication via global request headers

**Session Management**:
- Server-side session validation on all protected routes
- Session stored securely with NextAuth.js
- Automatic session refresh
- Session invalidation on logout

**User Management**:
- User records stored in database
- Email-based user identification
- Email verification status tracking
- User creation timestamp

### Requirements

**User Model**:
- Email: Unique user identifier (required)
- Name: Display name (optional, nullable)
- Email Verified: Timestamp of email verification (nullable)
- Created/Updated: Automatic timestamps

**Authentication Flow**:
- Unauthenticated users redirected to login
- Authenticated users get session token
- Session validated on each request
- Protected API routes check session

**Test Environment**:
- Mock authentication enabled via `NODE_ENV !== 'production'`
- Test user auto-created with email 'test@e2e.local'
- E2E tests bypass auth with global request context

### Data Model

**User Entity**:
- `id`: Unique identifier (string)
- `email`: User email address (unique, required)
- `name`: Display name (string, nullable)
- `emailVerified`: Email verification timestamp (DateTime, nullable)
- `createdAt`: Account creation timestamp
- `updatedAt`: Last modification timestamp

**Session Integration**:
- NextAuth.js manages session storage
- User ID stored in session
- Session validated server-side
- Automatic session cleanup on expiry

---

## Project Ownership

**Purpose**: Projects must belong to users to ensure proper data isolation and access control. Each user can only access their own projects, preventing unauthorized cross-user data access.

### What It Does

The system enforces user ownership of projects:

**Ownership Model**:
- Every project belongs to exactly one user
- Projects created automatically assigned to authenticated user
- User can only access their own projects
- No cross-user project access

**Access Control**:
- API routes validate project ownership before operations
- User ID extracted from session
- Project ownership verified against user ID
- Unauthorized access returns 403 Forbidden

**Data Isolation**:
- Users only see their own projects
- Ticket operations inherit project ownership validation
- No way to access another user's data
- Complete separation between users

### Requirements

**Project-User Relationship**:
- Project must have userId (required foreign key)
- User can have multiple projects (one-to-many)
- Project queries filtered by user ID
- Index on userId for query performance

**Authorization Checks**:
- Extract user ID from session
- Verify project belongs to user
- Return 401 if not authenticated
- Return 403 if project belongs to different user
- Return 404 if project doesn't exist

**Default Behavior**:
- New projects automatically assigned to current user
- No manual user selection required
- User context derived from session

### Data Model

**Project Relationship**:
- `userId`: Required foreign key to User.id
- **Index**: userId for efficient filtering
- **Constraint**: NOT NULL (every project must have owner)

**Authorization Flow**:
1. Extract user ID from NextAuth session
2. Query project with projectId + userId
3. If not found: check if project exists at all
4. Return 404 if project doesn't exist
5. Return 403 if project belongs to different user
6. Proceed with operation if ownership validated

---

## Test Authentication Strategy

**Purpose**: E2E tests need reliable authentication without manual login flows. The system provides mock authentication and consistent test user management to enable automated testing while maintaining authentication requirements.

### What It Does

The system provides special authentication handling for tests:

**Mock Authentication**:
- Enabled when `NODE_ENV !== 'production'`
- Always returns authenticated session with test user
- No actual login required in test environment
- Same security model enforced (just with auto-login)

**Test User Management**:
- Consistent test user: 'test@e2e.local'
- Auto-created during global test setup
- Used across all test files
- Never deleted (stable fixture)

**E2E Test Configuration**:
- Playwright global setup creates test user
- Global request context includes mock auth headers
- All API requests automatically authenticated
- No per-test authentication setup needed

**Test Data Isolation**:
- Test user (ID from global setup) owns test projects
- Projects 1 and 2 reserved for E2E tests
- Project 3 reserved for development
- All test projects linked to test user

### Requirements

**Mock Auth Implementation**:
- Check `NODE_ENV` to enable mock mode
- Return session with test user ID
- Maintain same API contract as real auth
- No security bypass (just simplified auth)

**Test User Pattern**:
- Email: 'test@e2e.local'
- Name: 'E2E Test User'
- Email verified: current timestamp
- Upsert pattern: create if not exists, skip if exists

**Global Test Setup**:
- Clean database before test suite
- Create test user
- Create test projects (1, 2) with test user ID
- Store user ID for test access
- Configure Playwright with auth context

**Test Helper Functions**:
- Consistent user creation across test files
- Same upsert pattern in all helpers
- User ID linked to projects on creation
- User ID linked to projects on upsert (update branch)

### Data Model

**Test User Record**:
```typescript
{
  email: 'test@e2e.local',
  name: 'E2E Test User',
  emailVerified: new Date()
}
```

**Test Project Pattern**:
```typescript
await prisma.user.upsert({
  where: { email: 'test@e2e.local' },
  update: {},
  create: {
    email: 'test@e2e.local',
    name: 'E2E Test User',
    emailVerified: new Date(),
  },
});

await prisma.project.upsert({
  where: { id: 1 },
  update: { userId: testUser.id },
  create: {
    id: 1,
    name: '[e2e] Test Project',
    description: 'Project for automated tests',
    githubOwner: 'test',
    githubRepo: 'test',
    userId: testUser.id,
  },
});
```

**Global Setup Pattern**:
```typescript
// tests/global-setup.ts
export default async function globalSetup() {
  await cleanupDatabase();

  const testUser = await prisma.user.upsert({
    where: { email: 'test@e2e.local' },
    update: {},
    create: {
      email: 'test@e2e.local',
      name: 'E2E Test User',
      emailVerified: new Date(),
    },
  });

  // Store user ID for tests to access
  process.env.TEST_USER_ID = testUser.id;

  return async () => {
    // Cleanup if needed
  };
}
```

---

## Current State Summary

### Available Features

**Authentication**:
- ✅ NextAuth.js integration
- ✅ Mock authentication for development
- ✅ Session-based auth
- ✅ Server-side validation
- ✅ Automatic session management

**Authorization**:
- ✅ User ownership of projects
- ✅ Project access control
- ✅ Cross-user isolation
- ✅ Proper error responses (401, 403, 404)

**Test Support**:
- ✅ Mock authentication in tests
- ✅ Global test user setup
- ✅ Consistent test user pattern
- ✅ E2E authentication context
- ✅ Helper function consistency

### User Workflows

**Production Authentication**:
1. User visits protected route
2. Not authenticated → redirect to login
3. User logs in via NextAuth provider
4. Session created and stored
5. User can access protected resources
6. Projects filtered by user ID

**Development/Test Authentication**:
1. Developer starts app in dev mode
2. Mock auth automatically provides test user session
3. No login required
4. Same security model enforced
5. Test user owns all projects

**E2E Test Flow**:
1. Global setup runs before all tests
2. Database cleaned
3. Test user created ('test@e2e.local')
4. Test projects (1, 2) created with user ID
5. Playwright configured with auth headers
6. All tests run with authenticated context
7. Each test's beforeEach ensures user exists
8. Projects upserted with correct userId

### Business Rules

**Authentication**:
- All routes require authentication
- Session must be valid for API access
- Mock auth only in non-production
- Session validated server-side

**Authorization**:
- Projects belong to users (required)
- Users can only access own projects
- Cross-user access blocked
- Tickets inherit project ownership validation

**Test Environment**:
- Test user consistent across all tests
- Projects 1-2 reserved for tests with test user
- Project 3 for development with test user
- All test helpers use same user pattern

### Technical Details

**Authentication Stack**:
- NextAuth.js for authentication
- PostgreSQL for user storage
- Prisma ORM for user queries
- Session cookies for state

**Security Model**:
- Server-side session validation
- User ID extracted from session
- Database queries filtered by user ID
- No client-side authorization

**Test Configuration**:
- `tests/global-setup.ts`: Test user creation
- `tests/helpers/db-setup.ts`: Helper functions
- All helpers create test user before operations
- Playwright: Global auth context configuration

**Error Handling**:
- 401: Not authenticated (no session)
- 403: Not authorized (wrong user)
- 404: Resource not found
- Clear error messages for debugging

---

## Technical Decisions

### Why Mock Authentication for Tests?

**Problem**: E2E tests need to verify business logic without dealing with authentication complexity in every test.

**Solution**: Mock authentication automatically authenticates as test user in non-production environments.

**Benefits**:
- Tests focus on business logic, not auth flows
- Consistent test user across all tests
- Same security model enforced
- No per-test authentication setup
- Tests remain fast and reliable

**Trade-offs**:
- Doesn't test actual authentication flows
- Different code path than production (but same validation logic)
- Separate auth tests would be needed for auth flows

### Why Consistent Test User Pattern?

**Problem**: Different test files creating users differently led to missing userId causing Prisma validation errors.

**Solution**: Standardize test user creation pattern across all test files.

**Pattern**:
```typescript
// Always do this before creating/upserting projects
const testUser = await prisma.user.upsert({
  where: { email: 'test@e2e.local' },
  update: {},
  create: {
    email: 'test@e2e.local',
    name: 'E2E Test User',
    emailVerified: new Date(),
  },
});

// Then use testUser.id for projects
```

**Benefits**:
- Prevents Prisma validation errors
- Consistent across all test files
- Self-documenting test code
- Easy to maintain

**Implementation**:
- Global setup creates user once
- Each test helper recreates if needed (upsert is safe)
- Both create and update branches include userId
- Pattern documented in CLAUDE.md

### Why User-Project Relationship?

**Problem**: Need to isolate user data and prevent unauthorized access.

**Solution**: Every project has a required userId foreign key.

**Benefits**:
- Clear ownership model
- Database-enforced relationship
- Simple authorization logic
- Prevents orphaned projects

**Trade-offs**:
- More complex test setup
- Every project must have owner
- Migration required for existing data
