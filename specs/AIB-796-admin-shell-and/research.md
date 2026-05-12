# Phase 0 Research — AIB-796 Admin Shell & User-Menu Entry

**Feature**: Admin shell and access entry in user menu
**Branch**: `AIB-796-admin-shell-and`
**Date**: 2026-05-12

This document resolves every "NEEDS CLARIFICATION" item from the plan's Technical
Context and captures the existing-file inventory and pattern references that the
implementation must honor. No new tech is introduced; the feature is pure UI
plumbing on top of the AIB-791 admin shell.

## Decisions

### D-1: How is "viewer is admin" resolved for the global header?

- **Decision**: Add a Server-Component helper `getViewerIsAdmin()` in
  `app/lib/auth/admin.ts` that calls `getCurrentUserOrNull()` and returns a
  plain boolean. Call it from `app/layout.tsx` (Server Component) and pass the
  result as a prop to `<Header />`. `Header` then forwards the boolean to
  `<UserMenu isAdmin />` and `<MobileMenu isAdmin />`. Both components render
  the "Admin" entry only when the prop is `true`.
- **Rationale**: The current `Header` is a Client Component (`'use client'`),
  and `UserMenu` uses `useSession()` purely on the client. A client-side admin
  check would either leak the allowlist (impossible to do safely) or require an
  extra round trip. Server-resolved-then-prop matches the existing pattern in
  `app/admin/layout.tsx` (FR-001 / FR-016) and keeps `requireAdminPageOrNotFound`
  as the single canonical resolver.
- **Alternatives considered**:
  1. A `/api/auth/viewer-is-admin` endpoint polled by the client. Rejected:
     introduces an extra request on every page load, and the response itself
     becomes a side-channel that leaks admin membership over time.
  2. Encoding `isAdmin` in the NextAuth session callback. Rejected: would
     persist admin status in the session cookie/JWT and bypass per-request
     re-evaluation (Edge Case in spec: "added to allowlist mid-session" must
     take effect on the next render).

### D-2: Where does the Admin entry sit in the menus?

- **Decision**: In both `UserMenu` and `MobileMenu`, the Admin entry renders
  **after** the existing "AI Credentials" entry and **before** the separator
  that precedes "Sign out" / "Sign Out". A separator divides settings group
  from the admin entry only when the admin entry is present (no separator drift
  for non-admins).
- **Rationale**: Matches FR-003 ("between the existing settings entries and the
  'Sign out' entry, separated from 'Sign out' by the existing menu separator")
  and SC-002 ("count and order unchanged" for non-admins).
- **Alternatives considered**: Placing Admin first, or above the user
  identity label. Rejected: the spec is explicit about position; admin tools
  are a destination, not a primary nav.

### D-3: Active-state matcher

- **Decision**: Create `lib/admin/active-path.ts` exporting
  `isAdminItemActive(pathname: string, href: string): boolean` with:
  - Exact match: `pathname === href`
  - Nested match: `pathname.startsWith(href + '/')`
  - Both cases use canonical forms (no trailing slash on `href`)
- **Rationale**: Implements FR-009 + Auto-Resolved Decision #4. The
  `startsWith(href + '/')` guard prevents the `/admin/insights-fake` adversarial
  case. Co-locating it in `lib/admin/` (not `app/lib/`) lets non-server client
  components import it without a server boundary.
- **Alternatives considered**:
  1. Naive `pathname.startsWith(href)` — rejected, well-known incidental-prefix
     bug.
  2. Regex per item — rejected, more code, harder to read, no benefit.

### D-4: Admin shell client/server split

- **Decision**: Keep `app/admin/layout.tsx` as the Server Component that runs
  `requireAdminPageOrNotFound`. Extract the visual shell into
  `components/admin/admin-shell.tsx` (Client Component) so it can read
  `usePathname()` for the active-state highlight. The Server Component renders
  `<AdminShell>{children}</AdminShell>`.
- **Rationale**: Pathname-driven active state is a hook (`usePathname`) and
  must run on the client. Authorization remains in the server layout — FR-016
  ("MUST NOT introduce a parallel admin check"). The sidebar receives a static
  items array; no fetch, no session reads from inside the client component.
- **Alternatives considered**:
  1. Read `headers()` server-side and compute active state from
     `x-invoke-path`. Rejected: brittle, and Next 16's RSC streaming makes the
     incoming path unreliable for active-state UI.

### D-5: `/admin` → `/admin/insights` redirect lifecycle

- **Decision**: Leave `app/admin/page.tsx` as-is (a `redirect('/admin/insights')`
  one-liner) until the "Accueil admin" ticket lands. When that ticket merges,
  `app/admin/page.tsx` is replaced by the Accueil server page in one edit; no
  shell changes required (Auto-Resolved Decision #3, FR-018).
- **Rationale**: Decouples this PR's scope from a sibling ticket's delivery
  order. The current redirect-to-Insights remains valid because the Accueil
  item in the sidebar simply points to `/admin`.
- **Alternatives considered**: Build a stub Accueil page now. Rejected — out of
  scope per Auto-Resolved Decision #3 fallback.

### D-6: Icons for V1 sidebar items

- **Decision**: `Home` (from `lucide-react`) for Accueil and `Sparkles` for
  Insights LLM. Both are already imported elsewhere in the codebase (no new
  deps). The "Retour à l'app" link uses `ArrowLeft`.
- **Rationale**: Auto-Resolved Decision #5; cosmetic, no functional impact.
- **Alternatives considered**: `BarChart3` for Insights — fine, reviewers may
  swap during build per the Auto-Resolved note.

### D-7: Visual active-state treatment

- **Decision**: Active items render with `bg-accent/30` (subtle background) and
  a `border-l-2 border-primary` accent bar inside the item. Inactive items use
  `hover:bg-accent` only. All colors come from Tailwind semantic tokens —
  zero hex/rgb.
- **Rationale**: Implements FR-010 ("subtle background + lateral indicator").
  Reuses existing accent/primary tokens already used by `MobileMenu` hover.
- **Alternatives considered**: `bg-primary/10` plus left bar. Equivalent; the
  exact opacity is a stylistic call the build phase may tune. Spec only
  requires "both signals present".

### D-8: Mobile-viewport behavior of the admin shell

- **Decision**: V1 keeps the sidebar visible on all viewports inside `/admin/*`
  (no collapse, no hamburger inside the shell). The shell uses
  `flex-col md:flex-row` so sidebar stacks above content on small viewports.
  This matches the spec's Edge Case clause that "sidebar behavior on narrow
  viewports is out of scope for V1 (sidebar may be stacked or scrollable)".
- **Rationale**: Smallest implementation that meets the spec; no future-proof
  collapse logic.
- **Alternatives considered**: Drawer/sheet for mobile. Rejected — explicitly
  out of scope for V1.

### D-9: Where does the `isAdmin` boolean enter the React tree?

- **Decision**: `app/layout.tsx` calls `getViewerIsAdmin()` once per render and
  passes it as `<Header isAdmin={…} />`. `Header` forwards to `UserMenu` and
  `MobileMenu` via props. No React Context is added.
- **Rationale**: Two consumers, both direct children of `Header`. A Context
  would be more machinery than needed and would obscure the data flow. If a
  third consumer appears (e.g., a notification bell with admin-only
  affordances), refactor to Context then — not now (anti-premature-abstraction
  rule).
- **Alternatives considered**: `ViewerContext` in the root layout. Rejected
  per above.

## Existing Files

### Files to modify (use the existing path; do not create a new file)

| Path | What it covers | Action |
|------|----------------|--------|
| `app/layout.tsx` | Root Server Component layout; renders `<Header />` | **Modify**: resolve admin once, pass `isAdmin` prop |
| `components/layout/header.tsx` | Client Component header; renders `UserMenu` + `MobileMenu` | **Modify**: accept `isAdmin` prop, forward to children |
| `components/auth/user-menu.tsx` | Avatar dropdown (Client) | **Modify**: accept `isAdmin?` prop, conditionally render Admin entry between AI Credentials and Sign out |
| `components/layout/mobile-menu.tsx` | Mobile sheet (Client) | **Modify**: accept `isAdmin?` prop, conditionally render Admin entry mirroring the dropdown |
| `app/admin/layout.tsx` | Admin Server Layout; allowlist guard + placeholder shell | **Modify**: replace inline sidebar with `<AdminShell>` import; keep `requireAdminPageOrNotFound` call |
| `app/lib/auth/admin.ts` | Admin allowlist resolver (`isUserAdmin`, `requireAdminPageOrNotFound`, etc.) | **Modify**: add `getViewerIsAdmin(request)` server helper for the root layout |
| `app/admin/page.tsx` | Root `/admin` redirect | **No change** in this ticket; FR-018 preserves existing redirect until Accueil ticket merges |
| `app/admin/insights/page.tsx` | Insights page | **No change**; FR-017 ("no behavior regression") |

### Files to create (verified no existing file already covers the responsibility)

| Path | Why this file is new |
|------|----------------------|
| `components/admin/admin-shell.tsx` | New Client Component for the sidebar + main-content scaffold. No existing admin shell component exists; the previous inline sidebar lived in `app/admin/layout.tsx`. |
| `components/admin/admin-sidebar-items.ts` | Static items array (label/href/icon). Separated from the shell component so SC-005 ("adding a new item edits one array") is satisfied with a single touch point. |
| `lib/admin/active-path.ts` | Pure function `isAdminItemActive(pathname, href)`. No existing helper does this; the closest is unrelated `NAVIGATION_ITEMS` in `components/navigation/nav-items.ts` which has no active-state logic. |

### Test files to extend (constitution III: "Search existing tests FIRST")

| Path | Coverage today | Extend with |
|------|----------------|-------------|
| `tests/unit/components/user-menu.test.tsx` | Renders Billing, API Tokens, Sign out | Add: renders Admin item when `isAdmin=true`; does NOT render Admin item when `isAdmin` is `false` or undefined; preserves existing items + order; Admin sits between AI Credentials and the Sign-out separator |
| `tests/unit/components/mobile-menu.test.tsx` | Renders Billing, API Tokens, Sign Out | Add: same admin-shown / admin-hidden cases, mirroring placement |
| `tests/unit/components/header.test.tsx` | Search trigger visibility, navigation icons removed | Add: when `isAdmin` prop is `true`, the rendered `UserMenu`/`MobileMenu` mocks receive `isAdmin=true`; when `false`, they receive `false` |
| `tests/unit/lib/auth/admin.test.ts` | Tests `getAdminAllowlist` + `isUserAdmin` | Add: `getViewerIsAdmin` returns `true` for an allowlisted email-only request and `false` for anonymous / non-allowlisted requests |
| `tests/integration/api/admin/insights/parity-404.test.ts` | Byte-equivalent 404 for non-admin API calls | **No change** — this contract MUST keep passing. Referenced as the regression gate for SC-003. |

### Test files to create

| Path | Why new |
|------|---------|
| `tests/unit/lib/admin/active-path.test.ts` | Unit tests for the new matcher (exact, nested, adversarial prefix, root case). No existing file covers active-path logic. |
| `tests/unit/components/admin/admin-shell.test.tsx` | RTL tests for the shell: sidebar items render with icons, active state highlights exactly one item per route, "Retour à l'app" navigates to `/`, divider present. Uses `usePathname` mocking. |
| `tests/integration/admin-shell-isolation.test.ts` | Integration test asserting that for a non-admin HTML response of any authenticated page, the body contains no `/admin` href, no "Admin" link text, and no admin-specific data-attribute (SC-002). |

## Patterns to Follow

### P-1: Server-resolves-then-prop pattern (NEW for global header)

- **Reference**: `app/admin/layout.tsx:21-32` — calls `await requireAdminPageOrNotFound(requestLike)` inside a Server Component and renders client children below it.
- **What to copy**: The pattern of building a minimal `requestLike` shape from `headers()` so the existing helper signature can be reused. The new `getViewerIsAdmin(request: NextRequest)` accepts the same `requestLike` shape and returns a boolean rather than throwing.
- **State management**: Resolve once per render, pass down the tree. Do not re-resolve in child components.

### P-2: Allowlist resolution stays canonical

- **Reference**: `app/lib/auth/admin.ts:43-52` — `resolveAdminEmail` does the lowercased trim + allowlist lookup. `requireAdminPageOrNotFound` (lines 78-84) calls `notFound()` when the result is null.
- **What to copy**: `getViewerIsAdmin` MUST call `resolveAdminEmail` (or refactor `resolveAdminEmail` to be exported and call it directly). It MUST NOT re-implement the lowercased-trim + allowlist lookup — that is the canonical drift surface FR-016 protects.
- **Security**: Same per-request `process.env.ADMIN_ALLOWLIST` read, no module-level caching, exception-safe (try/catch around `getCurrentUserOrNull`).

### P-3: Byte-equivalent 404 parity (regression gate)

- **Reference**: `tests/integration/api/admin/insights/parity-404.test.ts:45-83` and `app/lib/auth/admin.ts:36-41` (`adminNotFoundResponse`).
- **What to honor**: NOTHING in this ticket alters the 404 path. `/admin` and `/admin/*` continue to resolve through `requireAdminPageOrNotFound`; the new shell sits inside the success branch only. Verified by re-running the existing parity test unmodified.

### P-4: shadcn/ui primitives and design tokens

- **Reference**: `components/auth/user-menu.tsx:36-95` — uses `DropdownMenu`, `DropdownMenuItem asChild` with `Link`, `DropdownMenuSeparator`, `lucide-react` icons, semantic Tailwind tokens (`text-muted-foreground`, `text-destructive`).
- **What to copy**: The new Admin entries in both menus use the same `asChild` + `Link` composition. Icon margin is `mr-2 h-4 w-4`. No hardcoded colors anywhere in the admin shell or menu items (FR-015).

### P-5: Active-state with `usePathname`

- **Reference**: `components/navigation/nav-items.ts` defines a static items array consumed by `MobileMenu`; the active-state logic for project nav lives elsewhere (and uses naive `startsWith` in some legacy paths — do NOT copy that). The matcher must be the new function from D-3, used like `isAdminItemActive(pathname, item.href)`.
- **What to copy**: The static-items-array shape (`{ id, label, href, icon }`) so a new sidebar entry is a single object literal (SC-005).

### P-6: Error handling in the server admin helper

- **Reference**: `app/lib/auth/admin.ts:44-49` — `resolveAdminEmail` wraps `getCurrentUserOrNull` in try/catch and returns `null` on any throw, never letting an auth error leak through to the page.
- **What to copy**: `getViewerIsAdmin` MUST treat ANY exception from session resolution as "not admin" — never let a thrown error cause the global header to fail. The header renders for everyone; admins lose the Admin entry on session-resolver failure, which is the correct conservative behavior.
