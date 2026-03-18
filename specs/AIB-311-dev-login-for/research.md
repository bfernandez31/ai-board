# Research: Dev Login for Preview Environments

## Decision 1: NextAuth Credentials Provider Integration

**Decision**: Add `CredentialsProvider` from `next-auth/providers/credentials` conditionally when `DEV_LOGIN_SECRET` is set.

**Rationale**: NextAuth v5 supports Credentials provider natively. The provider is added to the `providers` array only when the env var exists, so production builds never include it. NextAuth v5 uses the `authorize` callback to validate credentials and return a user object.

**Alternatives considered**:
- Custom API route for login (rejected: would bypass NextAuth session management, requiring manual session/JWT handling)
- Middleware-based auth bypass (rejected: doesn't create proper NextAuth sessions)

**Key constraint**: NextAuth v5 with JWT strategy does NOT call the `signIn` callback for Credentials provider in the same way as OAuth. The `authorize` function must return the user object directly, and the `jwt` callback must handle setting `token.id` from the returned user.

## Decision 2: Timing-Safe Secret Comparison

**Decision**: Use Node.js `crypto.timingSafeEqual` for comparing the submitted secret against `DEV_LOGIN_SECRET`.

**Rationale**: Prevents timing attacks that could leak information about the secret value. This is a security best practice for secret comparison (FR-003).

**Implementation**: Both strings must be converted to `Buffer` of equal length. If lengths differ, comparison should still run against a dummy buffer to avoid timing leaks on length.

## Decision 3: Signin Page Architecture

**Decision**: Keep the signin page as a server component. Add a separate client component `DevLoginForm` that renders only when `NEXT_PUBLIC_DEV_LOGIN` is set. The server component passes the env var check result as a prop.

**Rationale**: Minimizes changes to existing page. The dev login form needs client-side interactivity (form state, error display) while the GitHub OAuth button uses server actions. Server component reads env var at render time and conditionally renders the client component.

**Alternatives considered**:
- Convert entire page to client component (rejected: breaks existing server action for GitHub signIn)
- Use server action for dev login too (rejected: need to show inline error messages without full page reload)

## Decision 4: User Upsert for Credentials Login

**Decision**: Create a new `createOrUpdateDevUser` function in `user-service.ts` that upserts by email (case-insensitive), using a deterministic ID derived from email hash, display name from email prefix.

**Rationale**: Reuses the existing upsert pattern but doesn't require GitHub-specific fields. The deterministic ID (SHA-256 of lowercase email, truncated) ensures the same email always maps to the same user ID. No Account record needed since there's no OAuth provider to link.

**Alternatives considered**:
- Use UUID for user ID (rejected: non-deterministic, would create duplicate users on repeated logins without prior lookup)
- Reuse `createOrUpdateUser` (rejected: tightly coupled to GitHub profile schema)

## Decision 5: API Route for Dev Login

**Decision**: Create a dedicated API route `POST /api/auth/dev-login` that validates credentials and calls `signIn("credentials", ...)` server-side, OR use NextAuth's built-in Credentials flow which posts to `/api/auth/callback/credentials`.

**Decision (revised)**: Use NextAuth's built-in Credentials provider flow. The client form calls `signIn("credentials", { email, secret, redirect: false })` from `next-auth/react`, which posts to the NextAuth callback endpoint. The `authorize` function handles validation and user upsert.

**Rationale**: Leverages NextAuth's built-in session/JWT management. No custom API route needed. The `signIn` function from `next-auth/react` handles the client-side flow.

## Decision 6: Email Case Insensitivity

**Decision**: Normalize email to lowercase before database lookup and storage.

**Rationale**: FR-010 requires case-insensitive email handling. Normalizing at input prevents duplicate records (e.g., "John@test.com" vs "john@test.com").
