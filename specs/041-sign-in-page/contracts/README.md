# API Contracts: Sign-In Page Redesign

**Feature**: 041-sign-in-page
**Date**: 2025-10-22
**Status**: N/A - No New API Endpoints

## Overview

This feature is a **UI redesign with no API contract changes**. The sign-in page uses existing NextAuth.js routes and server actions without modifications.

## Existing API Endpoints (No Changes)

The feature relies on the following existing endpoints, which require no modifications:

### NextAuth.js Authentication Routes (Existing)

#### POST /api/auth/signin/github
**Description**: GitHub OAuth initiation endpoint (provided by NextAuth.js)

**Request**: N/A (handled by form action)
```tsx
<form action={async () => {
  "use server"
  await signIn("github", { redirectTo: callbackUrl })
}}>
```

**Response**: HTTP 302 redirect to GitHub OAuth
```
Location: https://github.com/login/oauth/authorize?client_id=...
```

**No Changes Required**: Endpoint provided by NextAuth.js, fully functional

---

#### GET /api/auth/callback/github
**Description**: GitHub OAuth callback handler (provided by NextAuth.js)

**Request**: Query parameters from GitHub OAuth
```
GET /api/auth/callback/github?code=abc123&state=xyz789
```

**Response**: HTTP 302 redirect to application
```
Location: /projects (or callbackUrl from state)
```

**No Changes Required**: Endpoint provided by NextAuth.js, fully functional

---

#### GET /api/auth/session
**Description**: Session validation endpoint (provided by NextAuth.js)

**Request**: Includes session cookie
```
GET /api/auth/session
Cookie: next-auth.session-token=...
```

**Response**: JSON session object or null
```json
{
  "user": {
    "id": "cuid123",
    "name": "John Doe",
    "email": "john@example.com",
    "image": "https://avatars.githubusercontent.com/..."
  },
  "expires": "2025-11-22T00:00:00.000Z"
}
```

**No Changes Required**: Used by header component to check auth state

---

## Server Actions (Existing)

### signIn("github", options)
**Description**: Server action for initiating GitHub OAuth flow

**Implementation** (`lib/auth.ts`):
```typescript
export const { signIn } = NextAuth({
  providers: [GitHub({ ... })],
  // ... config
});
```

**Usage in Feature** (`app/auth/signin/page.tsx`):
```tsx
<form action={async () => {
  "use server"
  await signIn("github", {
    redirectTo: callbackUrl
  })
}}>
  <Button type="submit">Continue with GitHub</Button>
</form>
```

**Parameters**:
- `provider`: `"github"` (string literal)
- `options`: `{ redirectTo: string }` (optional, defaults to "/")

**No Changes Required**: Existing implementation meets all requirements

---

## Component Props Contracts

Since this is a UI-only feature, the "contracts" are TypeScript interfaces for component props:

### SignInPage Props
```typescript
interface SignInPageProps {
  searchParams: Promise<{
    callbackUrl?: string;
  }>;
}
```

**Validation**: NextAuth.js validates callbackUrl (internal routes only)

---

### Header Component Props
```typescript
// No props - uses usePathname() and useSession() hooks
export function Header(): React.ReactElement | null;
```

**Changes**: Modify return logic to allow rendering on /auth/signin

---

### OAuthButton Props (New Component)
```typescript
interface OAuthButtonProps {
  provider: 'github' | 'gitlab' | 'bitbucket';
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
  comingSoon?: boolean;
  onSubmit?: () => Promise<void>;
}
```

**Usage**:
```tsx
<OAuthButton
  provider="github"
  icon={Github}
  label="Continue with GitHub"
  disabled={false}
  onSubmit={async () => await signIn("github", { redirectTo: callbackUrl })}
/>

<OAuthButton
  provider="gitlab"
  icon={SiGitlab}
  label="Continue with GitLab"
  disabled={true}
  comingSoon={true}
/>
```

**Validation**: TypeScript enforces prop types at compile time

---

## Error Responses (Existing)

All error handling is managed by NextAuth.js with redirect to `/auth/error`:

### Error Page Route
**Path**: `/auth/error`

**Implementation** (`app/auth/error/page.tsx`): Already exists

**Error Types** (from NextAuth.js):
- `OAuthSignin`: Error during OAuth initiation
- `OAuthCallback`: Error during OAuth callback
- `OAuthAccountNotLinked`: Account already linked to different provider
- `Default`: Generic authentication error

**No Changes Required**: Error page already styled and functional

---

## No OpenAPI/GraphQL Schema Required

This feature does not introduce REST or GraphQL APIs, so no schema definitions are needed.

**Rationale**:
- Uses Next.js server actions (RPC-style, not REST)
- Relies on NextAuth.js built-in endpoints (no custom API routes)
- All endpoints are type-safe via TypeScript (no runtime schema needed)

---

## Security Considerations (Existing Implementation)

### CSRF Protection
**Provided by**: NextAuth.js (built-in CSRF token validation)
**Status**: ✅ Already implemented

### Redirect URL Validation
**Provided by**: NextAuth.js (validates callbackUrl against basePath)
**Status**: ✅ Already implemented

### OAuth State Parameter
**Provided by**: NextAuth.js (prevents CSRF on OAuth flow)
**Status**: ✅ Already implemented

### Session Cookie Security
**Provided by**: NextAuth.js (httpOnly, secure, sameSite flags)
**Status**: ✅ Already implemented

**No New Security Measures Required**: All protections handled by NextAuth.js

---

## Contract Testing

Since there are no new API endpoints, contract testing focuses on:

1. **NextAuth.js Integration Tests**: Verify existing endpoints still work
2. **Component Integration Tests**: Verify form submission triggers server action
3. **E2E Tests**: Verify OAuth flow completes successfully

**No API Contract Tests Required**: No new endpoints to test

---

## Summary

This feature introduces **zero new API contracts**:

- ✅ No new REST endpoints
- ✅ No new GraphQL mutations
- ✅ No new WebSocket connections
- ✅ No modifications to existing API routes
- ✅ Only TypeScript interfaces for UI components

**Complexity**: Minimal (reuses existing infrastructure)

**Testing Focus**: E2E OAuth flow validation, not API contract testing
