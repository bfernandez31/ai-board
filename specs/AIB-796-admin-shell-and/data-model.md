# Phase 1 Data Model — AIB-796 Admin Shell & User-Menu Entry

**Branch**: `AIB-796-admin-shell-and`
**Date**: 2026-05-12

This feature introduces **no persistent storage** changes — no Prisma migrations,
no new DB tables or columns, no enum additions. All "entities" below are
in-memory request-scoped values or static client constants.

## Entities

### 1. `AdminViewerContext` *(request-scoped boolean, server-resolved)*

The server's per-render answer to "is this request from an admin?". Lives only
for the lifetime of a single render of the root layout.

**Shape**: `boolean`

**Source**: `getViewerIsAdmin(request)` in `app/lib/auth/admin.ts` (new helper added in this ticket).

**Resolution rules**:
- If `getCurrentUserOrNull(request)` throws, returns `false`.
- If the resolved user is `null` (unauthenticated), returns `false`.
- If the resolved user's email is not in `getAdminAllowlist()` (case-insensitive, trimmed), returns `false`.
- Otherwise returns `true`.
- `ADMIN_ALLOWLIST` is re-read on every call (no module-level cache) — same contract as `getAdminAllowlist`.

**Lifecycle**:
- Created once per request inside `app/layout.tsx`.
- Passed as `isAdmin` prop down to `<Header isAdmin={…} />`, then to `<UserMenu isAdmin={…} />` and `<MobileMenu isAdmin={…} />`.
- Never persisted, never serialized to the client beyond the prop's `true|false` literal, never read from a cookie or local storage.

**Security invariants**:
- Allowlist resolution is the **only** source of truth. UI components do not call any independent admin check. (FR-016)
- When `false`, the rendered HTML contains zero references to `/admin` from these components. No hidden DOM, no commented-out blocks, no `data-admin="false"` attributes. (FR-002)

---

### 2. `AdminSidebarItem` *(static client constant)*

A displayable navigation entry in the admin shell sidebar. Items are statically
declared in `components/admin/admin-sidebar-items.ts` so adding a new entry is a
single-array edit (SC-005, FR-012).

**Shape** (TypeScript):

```ts
import type { LucideIcon } from 'lucide-react';

export interface AdminSidebarItem {
  id: string;          // stable key (used for React key + tests)
  label: string;       // user-visible text
  href: string;        // target path (canonical form: no trailing slash, no query)
  icon: LucideIcon;    // lucide-react glyph component
}

export interface AdminSidebarDivider {
  id: string;          // stable key (e.g., 'div-admin-features')
  kind: 'divider';     // discriminant
}

export type AdminSidebarEntry = AdminSidebarItem | AdminSidebarDivider;
```

**Validation rules** (enforced by TypeScript types, no runtime Zod needed for static data):
- `href` MUST start with `/admin` (so the active-state matcher's exact/nested behavior is meaningful) OR be exactly `/admin` (root case).
- `label` MUST be non-empty.
- `id` MUST be unique across the array.

**V1 contents** (initial array):

```ts
[
  { id: 'accueil',     label: 'Accueil',      href: '/admin',          icon: Home },
  { id: 'insights',    label: 'Insights LLM', href: '/admin/insights', icon: Sparkles },
]
```

A divider entry (e.g., `{ id: 'div-1', kind: 'divider' }`) is supported by the
shell but is not present in V1; FR-008 requires "at least one visual divider"
between the items and the "Retour à l'app" footer link — that one IS rendered
unconditionally by the shell.

**Derived runtime fact**:
- `isActive: boolean` — computed by `isAdminItemActive(pathname, href)` from `lib/admin/active-path.ts`. Not stored on the item.

**Active-state matcher rules** (FR-009):
- Exact match: `pathname === item.href`
- Nested match: `pathname.startsWith(item.href + '/')`
- The trailing `/` segment guard prevents `/admin/insights` matching `/admin/insights-fake`.
- For `href === '/admin'`, only the exact `/admin` is active (FR-009 explicitly carves out the root case).

---

### 3. `AdminMenuEntryDescriptor` *(implicit, conceptual)*

Not a separate file or type — describes the *shape* of the Admin entry as it
appears in both `UserMenu` and `MobileMenu`. Kept here so future maintainers
understand the intent without re-reading the spec.

**Description**:
- Label: `"Admin"`
- Icon: `Shield` from `lucide-react` (consistent with admin-area glyph convention; cosmetic — may be swapped during build)
- Href: `/admin`
- Position (UserMenu): `DropdownMenuItem` placed after the "AI Credentials" item, followed by a `DropdownMenuSeparator`, then the existing "Sign out" item.
- Position (MobileMenu): Equivalent placement after the "AI Credentials" link, before the existing "Sign Out" divider/button block.
- Visibility: Rendered if and only if the parent's `isAdmin` prop is `true`. Markup is gated by an `if` expression, not CSS — there is no hidden DOM for non-admins. (FR-002)

---

## Persistence Summary

| Layer | Change |
|-------|--------|
| Prisma schema | None |
| Database migrations | None |
| Cookies / session | None |
| Env vars | None new. Continues to read `ADMIN_ALLOWLIST` exactly as `getAdminAllowlist()` does today. |
| Vercel Blob | None |
| TanStack Query cache | None |

## State Transitions

None. There is no stateful workflow in this feature — only:

1. Per-request server resolution of `isAdmin` (read-only).
2. Per-render pathname-driven active-state highlight (pure function).

Both are recomputed on every render; neither persists.
