# Data Model: Sign-In Page Redesign

**Feature**: 041-sign-in-page
**Date**: 2025-10-22
**Status**: N/A - UI-Only Feature

## Overview

This feature is a **UI redesign with no data model changes**. The sign-in page redesign affects only the presentation layer and does not introduce new entities, database tables, or data structures.

## Existing Data Model (No Changes)

The feature relies on the existing NextAuth.js data model, which is already implemented and requires no modifications:

### User Entity (Existing)
Managed by NextAuth.js and Prisma adapter.

**Schema** (`prisma/schema.prisma`):
```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  accounts      Account[]
  sessions      Session[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  projects      Project[]
}
```

**Usage in Feature**: No changes required. User authentication handled by NextAuth.js GitHub provider.

---

### Session Entity (Existing)
Managed by NextAuth.js.

**Schema** (`prisma/schema.prisma`):
```prisma
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**Usage in Feature**: No changes required. Session creation handled by NextAuth.js after successful OAuth.

---

### Account Entity (Existing)
Stores OAuth provider connection details.

**Schema** (`prisma/schema.prisma`):
```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String  // "github" for GitHub OAuth
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}
```

**Usage in Feature**: No changes required. GitHub account linking handled by NextAuth.js.

---

## UI State Model (Client-Side Only)

While there are no database changes, the sign-in page has client-side UI state:

### OAuth Provider State (Component-Level)

**Type Definition**:
```typescript
interface OAuthProvider {
  id: 'github' | 'gitlab' | 'bitbucket';
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
  comingSoon: boolean;
}
```

**Example Data**:
```typescript
const providers: OAuthProvider[] = [
  {
    id: 'github',
    name: 'GitHub',
    icon: Github, // from lucide-react
    enabled: true,
    comingSoon: false
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    icon: SiGitlab, // from react-icons/si
    enabled: false,
    comingSoon: true
  },
  {
    id: 'bitbucket',
    name: 'BitBucket',
    icon: SiBitbucket, // from react-icons/si
    enabled: false,
    comingSoon: true
  }
];
```

**State Management**: Hardcoded in component (no external state needed)

**Rationale**: Provider configuration is static and doesn't change at runtime. Future enhancement could move this to a config file if needed.

---

## Validation Rules (No Changes)

All validation is handled by existing NextAuth.js implementation:

1. **GitHub OAuth Flow**: NextAuth.js validates OAuth tokens and callbacks
2. **Session Management**: NextAuth.js validates session tokens
3. **CallbackUrl Validation**: NextAuth.js validates redirect URLs (internal routes only)

**No New Validation Required**: Feature uses existing server action without modifications.

---

## State Transitions (No Changes)

OAuth authentication flow (existing, unchanged):

```
1. User clicks "Continue with GitHub"
   → Server action: signIn("github", { redirectTo: callbackUrl })

2. NextAuth.js redirects to GitHub OAuth
   → User authenticates on GitHub.com

3. GitHub redirects back to application
   → NextAuth.js creates session + account record

4. User redirected to callbackUrl
   → Default: /projects
   → Preserved from query param if present
```

**No State Machine Required**: Linear flow with no branching logic in UI layer.

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Sign-In Page                        │
│  (app/auth/signin/page.tsx - UI REDESIGN ONLY)         │
└─────────────────────────────────────────────────────────┘
                          │
                          │ User clicks OAuth button
                          ▼
┌─────────────────────────────────────────────────────────┐
│             Server Action: signIn()                     │
│          (lib/auth.ts - NO CHANGES)                     │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Redirect to GitHub
                          ▼
┌─────────────────────────────────────────────────────────┐
│              GitHub OAuth (External)                    │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Callback with token
                          ▼
┌─────────────────────────────────────────────────────────┐
│           NextAuth.js Callback Handler                  │
│          (lib/auth.ts - NO CHANGES)                     │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Create/update records
                          ▼
┌─────────────────────────────────────────────────────────┐
│            PostgreSQL Database                          │
│  User, Session, Account tables (NO SCHEMA CHANGES)     │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Redirect to callbackUrl
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Projects Dashboard                         │
│             (/projects - Authenticated)                 │
└─────────────────────────────────────────────────────────┘
```

**Key Points**:
- **No database writes from sign-in page**: All persistence handled by NextAuth.js
- **No API endpoints**: Uses existing NextAuth.js routes
- **No data validation in UI**: Server handles all security

---

## Relationship Diagram

**N/A**: No new entities or relationships introduced by this feature.

**Existing Relationships** (unchanged):
- `User` → `Account` (one-to-many): One user can have multiple OAuth providers
- `User` → `Session` (one-to-many): One user can have multiple active sessions
- `User` → `Project` (one-to-many): One user can own multiple projects

---

## Migration Requirements

**None**: This feature requires **zero database migrations**.

**Verification**:
```bash
# No new migration files expected
prisma migrate status
# Should show: "Database schema is up to date!"
```

---

## Summary

This is a **presentation-layer feature** with no data model impact:

- ✅ No new database tables
- ✅ No schema changes
- ✅ No new API endpoints
- ✅ No new validation rules
- ✅ No migrations required

**Complexity**: Minimal (UI-only changes)

**Risk**: Low (no data integrity concerns)

**Testing Focus**: Visual consistency and OAuth flow (E2E tests), not data validation
