# Authentication & Authorization

## Overview

This domain covers user authentication and authorization. The system uses NextAuth.js with mock authentication in development/test environments to support multi-user access while maintaining data isolation between users.

**Current Capabilities**:
- NextAuth.js-based authentication system
- GitHub OAuth provider with automatic User/Account creation
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

---

## Sign-In Page (Feature 041)

**Purpose**: Provide users with a visually consistent and accessible sign-in experience that supports multiple OAuth providers while clearly communicating which authentication methods are currently available.

### What It Does

The sign-in page provides a user-facing authentication interface:

**Visual Design**:
- Dark background matching site theme (#1e1e2e)
- Centered authentication card with violet border (#8B5CF6)
- Application header with logo and branding
- Responsive layout for mobile, tablet, and desktop
- Accessibility-compliant design (WCAG 2.1 AA)

**OAuth Provider Display**:
- GitHub: Active OAuth provider (clickable, functional)
- GitLab: Disabled state with "Coming soon" indication
- BitBucket: Disabled state with "Coming soon" indication
- Provider-specific icons and branding colors
- Clear visual distinction between enabled and disabled states

**Authentication Flow**:
- Unauthenticated users see sign-in card with provider options
- Authenticated users automatically redirected to dashboard
- OAuth flow preserves callbackUrl for return navigation
- Loading indicators during authentication process
- User-friendly error messages for authentication failures

**Navigation and Redirects**:
- After successful auth: redirect to original destination (callbackUrl)
- Default redirect: projects dashboard (/projects)
- Authenticated user accessing /auth/signin: redirect to dashboard
- Failed OAuth: user remains on sign-in page with error message

### Requirements

**Visual Consistency**:
- Header component displayed on sign-in page (matches other pages)
- Background color matches site theme (#1e1e2e)
- Authentication card uses violet border (#8B5CF6)
- Typography and spacing consistent with design system
- Responsive breakpoints match other pages

**OAuth Provider Requirements**:
- GitHub OAuth button: Enabled, functional, initiates OAuth flow
- GitLab OAuth button: Disabled, non-interactive, shows "Coming soon" tooltip
- BitBucket OAuth button: Disabled, non-interactive, shows "Coming soon" tooltip
- Provider icons displayed with appropriate branding
- Disabled buttons show visual feedback (grayed, opacity reduced, cursor not-allowed)

**User Experience**:
- Page loads in under 2 seconds on standard connection
- OAuth flow completes in under 10 seconds (excluding external authorization)
- Loading spinner shown during authentication process
- Error messages are actionable and user-friendly
- Keyboard navigation fully supported
- Screen reader compatible (ARIA labels, semantic HTML)

**Authentication Security**:
- CallbackUrl validated against allowed patterns (internal routes only)
- Malicious callback URLs rejected with redirect to default (/projects)
- OAuth state parameter validated for CSRF protection
- Session cookies set with secure flags

**Edge Cases**:
- Failed OAuth: Error message with retry option
- Cancelled OAuth: Return to sign-in with "Authentication cancelled" message
- Network failure: Connection error message with retry option
- Invalid callback URL: Redirect to default destination
- Already authenticated: Immediate redirect to dashboard (<500ms)

### Data Model

**OAuth Provider Configuration** (Frontend):
```typescript
{
  id: 'github' | 'gitlab' | 'bitbucket',
  name: string,
  icon: LucideIcon,
  enabled: boolean,
  signInHandler: () => Promise<void>
}
```

**Authentication Flow**:
1. User clicks enabled OAuth provider (GitHub)
2. NextAuth.js signIn() called with provider ID and callbackUrl
3. User redirected to OAuth provider (GitHub)
4. User authorizes application
5. OAuth provider redirects back with authorization code
6. NextAuth.js exchanges code for tokens
7. User session created in database
8. User redirected to callbackUrl or default (/projects)

**Error States**:
- OAuth authorization failed: User sees error, remains on sign-in page
- Network error: Connection error message displayed
- Invalid callback: Redirect to default with warning
- Rate limited: Error message with retry guidance

### User Workflows

**New User Sign-In Flow**:
1. User navigates to /auth/signin
2. Page loads with header and OAuth provider card
3. User clicks "Sign in with GitHub"
4. Redirected to GitHub authorization page
5. User authorizes AI-BOARD application
6. Redirected back to AI-BOARD
7. Session created, user record created if new
8. Redirected to projects dashboard

**Returning User with Protected Page**:
1. Unauthenticated user visits /projects/1/board
2. Middleware redirects to /auth/signin?callbackUrl=/projects/1/board
3. User signs in with GitHub
4. After successful auth, redirected to /projects/1/board
5. User continues from where they left off

**Already Authenticated User**:
1. Authenticated user navigates to /auth/signin
2. Middleware detects existing session
3. User immediately redirected to /projects
4. No sign-in UI shown

**Failed Authentication**:
1. User clicks "Sign in with GitHub"
2. OAuth flow initiated
3. User cancels or error occurs
4. User returned to /auth/signin
5. Error message displayed: "Authentication failed. Please try again."
6. User can retry authentication

### Business Rules

**Provider Availability**:
- Only GitHub OAuth enabled in initial release
- GitLab and BitBucket shown as disabled (roadmap visibility)
- Future provider activation requires only configuration change
- No structural changes needed to add new providers

**Redirect Logic**:
- CallbackUrl must be internal route (validated)
- Default redirect: /projects
- Authenticated users cannot access /auth/signin
- Failed auth: user stays on /auth/signin

**Accessibility Requirements**:
- WCAG 2.1 AA compliance mandatory
- Keyboard navigation: Tab, Enter, Space supported
- Focus indicators clearly visible
- ARIA labels for all interactive elements
- Color contrast ratios meet standards (4.5:1 minimum)

**Performance Requirements**:
- Initial page load: <2 seconds (standard broadband)
- Time to interactive: <3 seconds
- OAuth redirect: <500ms after authorization callback
- Dashboard redirect for authenticated users: <500ms

### Technical Details

**Implementation Files**:
- Sign-in page: `/app/auth/signin/page.tsx` (Next.js App Router)
- OAuth configuration: NextAuth.js configuration file
- Provider components: shadcn/ui Button components
- Icons: lucide-react (GitHub, GitLab, BitBucket icons)

**NextAuth.js Configuration**:
- Providers: GitHub OAuth configured
- Callbacks: Session, JWT, redirect callbacks
- Pages: Custom sign-in page (`/auth/signin`)
- Session strategy: Database sessions (PostgreSQL)

**Styling**:
- TailwindCSS utility classes
- Dark theme colors from design system
- Responsive breakpoints: mobile (sm), tablet (md), desktop (lg)
- Component variants: enabled, disabled states

**Testing Requirements**:
- E2E test: Successful GitHub OAuth flow
- E2E test: Authenticated user redirect
- E2E test: CallbackUrl preservation
- E2E test: Disabled provider buttons non-interactive
- Visual regression test: UI matches design system
- Accessibility audit: WCAG 2.1 AA compliance

**Browser Compatibility**:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile Safari (iOS 14+)
- Mobile Chrome (Android 10+)

### Success Metrics

**User Experience**:
- 95% of users complete authentication on first attempt
- Average authentication time: <10 seconds (excluding external OAuth)
- Page load time: <2 seconds (p95)
- Authenticated user redirect: <500ms (p95)

**Accessibility**:
- WCAG 2.1 AA compliance: 100%
- Keyboard navigation coverage: 100% of interactive elements
- Screen reader compatibility: All content accessible
- Color contrast: All text meets 4.5:1 minimum ratio

**Design Consistency**:
- Visual audit: 100% compliance with design system
- Cross-browser rendering: Identical across 5 major browsers
- Responsive design: No layout issues on mobile/tablet/desktop

**Error Handling**:
- Zero confusion about disabled providers (clear messaging)
- Error messages actionable in 100% of failure cases
- No user-reported issues with callback URL handling

---

## Automatic User Account Creation

**Purpose**: Users can sign in with GitHub OAuth and immediately create projects without manual account setup.

### What It Does

When a user authenticates with GitHub, the system automatically:

**First-Time Sign-In**:
- Creates a user account using the GitHub email address
- Stores the user's display name and profile information
- Links the GitHub account to the user profile
- Marks the email as verified
- Allows immediate project creation after sign-in

**Returning Sign-In**:
- Identifies existing users by their email address
- Updates the user's name and profile picture if changed on GitHub
- Refreshes the GitHub account linkage
- Preserves access to all existing projects
- Synchronizes user data with current GitHub profile

**Error Handling**:
- Shows clear error message if sign-in cannot complete
- Prevents access if user account cannot be created
- Allows users to retry authentication
- Never creates partial or incomplete accounts

### Requirements

**User Account Behavior**:
- New users automatically get an account on first GitHub sign-in
- Email address uniquely identifies each user
- Returning users are recognized by their email address
- User profile information stays synchronized with GitHub
- Users can create projects immediately after signing in
- Multiple sign-ins by the same user never create duplicate accounts
- Concurrent sign-ins are handled without errors

**Account Security**:
- Email addresses must be verified through GitHub
- Access tokens are securely stored
- Token expiration is tracked
- Authentication fails if account creation fails
- No partial accounts are ever created

### User Workflows

**First-Time User Sign-In**:
1. User clicks "Sign in with GitHub"
2. Redirected to GitHub for authorization
3. User authorizes the application
4. System creates user account automatically
5. User is redirected to the projects dashboard
6. User can immediately create their first project

**Returning User Sign-In**:
1. User clicks "Sign in with GitHub"
2. System recognizes user by email address
3. User profile updated with current GitHub information
4. User redirected to dashboard
5. User sees all their existing projects

**If Sign-In Fails**:
1. User sees clear error message
2. User can try signing in again
3. No incomplete account is created
4. User can contact support if problem persists

### Business Rules

**User Identity**:
- Email address uniquely identifies each user
- One user account per email address
- User profile information synchronized with GitHub on every sign-in
- Email verification status comes from GitHub

**Data Updates**:
- Name and profile picture refreshed on each sign-in
- Changes made on GitHub are reflected in the application
- User's existing projects are always preserved
- Account credentials refreshed automatically

### Success Criteria

**User Experience**:
- New users can create their first project immediately after sign-in
- Returning users see all their existing projects after sign-in
- Profile information stays current with GitHub
- Sign-in process completes in under 3 seconds
- Clear error messages if something goes wrong

**System Behavior**:
- No duplicate accounts created for the same email
- Multiple concurrent sign-ins complete successfully
- System handles authentication failures gracefully
- All user data remains consistent
- Projects are never orphaned or inaccessible
