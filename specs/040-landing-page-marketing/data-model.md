# Data Model: Marketing Landing Page

**Feature**: 040-landing-page-marketing
**Date**: 2025-10-21
**Status**: N/A

## Overview

**This feature has no data model requirements.**

The marketing landing page is a **presentation-only feature** that:
- Displays static marketing content (text, images, icons)
- Uses existing authentication state from NextAuth.js session API
- Does not create, read, update, or delete any database entities
- Does not persist any user data or analytics

---

## Authentication State (Existing)

The landing page consumes existing authentication state but does not modify it.

**API Used**: NextAuth.js `getServerSession()`

**Session Shape** (read-only):
```typescript
interface Session {
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
  expires: string;
}
```

**Usage**:
```typescript
// app/page.tsx (Server Component)
const session = await getServerSession(authOptions);

if (session) {
  redirect('/projects'); // User already authenticated
} else {
  // Render landing page
}
```

**No database queries, mutations, or state changes occur in this feature.**

---

## Component State (Client-Side Only)

The following state is ephemeral and exists only in browser memory during page visit:

### Scroll Position State
```typescript
// lib/hooks/use-scroll-to-section.ts (optional)
// Tracks current scroll position for smooth navigation
// No persistence required
```

### Hover State
```typescript
// components/landing/feature-card.tsx
// CSS hover states only (no JavaScript state)
// No persistence required
```

---

## Static Assets (File System)

The following assets exist as static files in the repository:

```
/public/landing/
├── hero-screenshot.webp    # Optimized kanban board screenshot
└── hero-screenshot.png     # Fallback for older browsers
```

**Asset Characteristics**:
- Read-only (served by Next.js static file handler)
- No versioning or dynamic updates
- No CDN integration (served from Vercel edge network)

---

## API Contracts (None)

**No new API endpoints are created for this feature.**

**Existing APIs consumed**:
- `GET /api/auth/session` (NextAuth.js, read-only)
- `GET /api/auth/signin` (NextAuth.js redirect target)

---

## Database Schema Changes

**No database migrations required.**

**No Prisma schema changes.**

---

## Conclusion

This feature is **100% stateless** from a data persistence perspective. All content is hardcoded in React components, and authentication state is consumed (not produced) from existing infrastructure.

**Data model documentation intentionally minimal as there is no data to model.**

For implementation details, see:
- [research.md](./research.md) - Technology decisions
- [quickstart.md](./quickstart.md) - Development guide
- [spec.md](./spec.md) - Feature requirements
