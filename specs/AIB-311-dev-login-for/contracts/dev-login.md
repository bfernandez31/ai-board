# API Contract: Dev Login Authentication

## Endpoint: POST /api/auth/callback/credentials

This is NextAuth's built-in Credentials callback. No custom API route is needed.

### Request (handled by NextAuth internally)

The `signIn("credentials", ...)` call from `next-auth/react` posts to this endpoint automatically.

**Body** (form-encoded by NextAuth):
```
email=user@example.com&secret=the-shared-secret&csrfToken=...
```

### authorize() Callback Contract

The Credentials provider's `authorize` function receives:

```typescript
interface DevLoginCredentials {
  email: string;   // User email address
  secret: string;  // Shared secret for validation
}
```

**Success response** (returned from `authorize`):
```typescript
{
  id: string;       // Deterministic user ID (SHA-256 hash of email)
  email: string;    // Normalized lowercase email
  name: string;     // Email prefix (part before @)
}
```

**Failure response**: `authorize` returns `null` → NextAuth returns error to client.

### Client-Side signIn() Call

```typescript
import { signIn } from "next-auth/react";

const result = await signIn("credentials", {
  email: "user@example.com",
  secret: "the-shared-secret",
  redirect: false,  // Handle response client-side
});

// result.ok === true  → redirect to /projects
// result.ok === false → display error message
```

## Environment Variables

| Variable | Scope | Required | Description |
|----------|-------|----------|-------------|
| `DEV_LOGIN_SECRET` | Server-side only | No | Shared secret for dev login. If unset, Credentials provider is not registered. Min 32 chars recommended. |
| `NEXT_PUBLIC_DEV_LOGIN` | Client + Server | No | Set to `"true"` to show Dev Login form on signin page. |

## Security Constraints

- `DEV_LOGIN_SECRET` MUST never appear in client bundle
- Secret comparison MUST use `crypto.timingSafeEqual`
- Email MUST be normalized to lowercase before database operations
- Form MUST validate required fields client-side before submission
