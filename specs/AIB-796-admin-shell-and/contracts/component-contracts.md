# Component & Module Contracts — AIB-796

This feature is **UI-only**: no new HTTP endpoints, no new database tables, no
new env vars. The "contracts" exposed are the prop shapes of the modified /
created components, the signature of the new server helper, and the signature
of the new pure matcher.

## 1. Server helper: `getViewerIsAdmin`

**Location**: `app/lib/auth/admin.ts` (extend this file; do NOT create a parallel module — FR-016).

**Signature**:

```ts
export async function getViewerIsAdmin(request: NextRequest): Promise<boolean>;
```

**Behavior**:
- Calls `resolveAdminEmail(request)` (refactor: export this internal helper).
- Returns `true` when `resolveAdminEmail` returns a non-null email; `false` otherwise.
- NEVER throws. Any exception inside session resolution is caught and converted to `false`.

**Callers** (in this ticket):
- `app/layout.tsx` — root Server Component, called once per render.

**Non-callers** (do NOT call from):
- Any Client Component (`'use client'`).
- Any API route — those use `requireAdminOrNotFound` directly.

---

## 2. Pure matcher: `isAdminItemActive`

**Location**: `lib/admin/active-path.ts` (new file, ~10 lines).

**Signature**:

```ts
export function isAdminItemActive(pathname: string, href: string): boolean;
```

**Behavior** (deterministic, no side effects):
- Returns `true` if `pathname === href`.
- Else returns `true` if `pathname.startsWith(href + '/')`.
- Else returns `false`.

**Inputs and edge cases**:
- `pathname` is the value returned by Next.js `usePathname()` (always begins with `/`, no trailing slash except for root `/`).
- `href` is the item's `href` (canonical form: begins with `/admin`, no trailing slash).
- `pathname === '/admin'` and `href === '/admin'` → `true`.
- `pathname === '/admin/insights'` and `href === '/admin'` → `false` (the `+ '/'` guard prevents the root from claiming nested paths).
- `pathname === '/admin/insights/runs/42'` and `href === '/admin/insights'` → `true`.
- `pathname === '/admin/insights-fake'` and `href === '/admin/insights'` → `false`.

---

## 3. Component: `<Header>` (modified)

**Location**: `components/layout/header.tsx`.

**New prop**:

```ts
interface HeaderProps {
  isAdmin: boolean;
}
```

**Required behavior**:
- Forwards `isAdmin` to `<UserMenu isAdmin={isAdmin} />` and `<MobileMenu isAdmin={isAdmin} />`.
- Does NOT branch its own layout on `isAdmin`. The header itself is identical for admins and non-admins (SC-006).
- The marketing variant (landing page, unauthenticated) MUST still render and MUST receive `isAdmin=false` from the layout (FR-002, last acceptance scenario).

**Breaking change**: The component is no longer pure-Client-state. The caller (`app/layout.tsx`) MUST pass `isAdmin`.

---

## 4. Component: `<UserMenu>` (modified)

**Location**: `components/auth/user-menu.tsx`.

**New prop** (optional with safe default for tests/storybook):

```ts
interface UserMenuProps {
  isAdmin?: boolean; // default: false
}
```

**Required behavior**:
- When the user is unauthenticated (`!session?.user`), render the existing "Sign In" button. Do NOT render Admin even if `isAdmin=true` (defensive: should never happen, but unauthenticated must be non-admin).
- When authenticated AND `isAdmin === true`:
  - Render an extra `DropdownMenuItem` between the existing "AI Credentials" item and the `DropdownMenuSeparator` that precedes the "Sign out" item.
  - The item uses `asChild` + `Link href="/admin"`, with `<Shield className="mr-2 h-4 w-4" />` and text `Admin`.
- When authenticated AND `isAdmin !== true`:
  - The rendered HTML contains NO Admin link, NO `/admin` href, NO `data-admin`-style attribute. The conditional `if` skips the entire JSX node. (FR-002)
- Item order MUST be: Profile → Billing → API Tokens → AI Credentials → **Admin (if admin)** → separator → Sign out.

---

## 5. Component: `<MobileMenu>` (modified)

**Location**: `components/layout/mobile-menu.tsx`.

**New prop** (optional with safe default):

```ts
interface MobileMenuProps {
  // existing props preserved
  projectId?: number | undefined;
  projectName?: string | undefined;
  isAdmin?: boolean; // default: false
}
```

**Required behavior**:
- Mirrors `<UserMenu>` admin gating exactly. When authenticated AND `isAdmin === true`, an "Admin" link renders after "AI Credentials" and before the "Sign Out" divider/button block.
- The link is a plain `<Link href="/admin">` styled identically to other items (`flex items-center px-2 py-2 text-sm rounded-md hover:bg-accent`).
- Closing the sheet on click follows the existing pattern (`onClick={() => setOpen(false)}`).
- When `isAdmin !== true`, no Admin markup is emitted (FR-002).

---

## 6. Component: `<AdminShell>` (new)

**Location**: `components/admin/admin-shell.tsx` (Client Component).

**Props**:

```ts
interface AdminShellProps {
  children: React.ReactNode;
}
```

**Required behavior**:
- Reads `usePathname()` to compute active state.
- Renders the layout:
  ```
  <div class="flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
    <aside aria-label="Espace admin">
      <header>Espace admin</header>
      <nav>
        {items.map(item => <SidebarItem … active={isAdminItemActive(pathname, item.href)} />)}
      </nav>
      <hr />
      <Link href="/">Retour à l'app</Link>
    </aside>
    <main class="flex-1 p-6">{children}</main>
  </div>
  ```
- Sidebar uses semantic Tailwind tokens only. No hardcoded hex. (FR-015)
- Active item visual state: `bg-accent/30` + `border-l-2 border-primary` accent (D-7).
- Items are read from `components/admin/admin-sidebar-items.ts`; the shell knows nothing project-specific beyond that array.
- Renders a divider (`<hr class="border-border" />` or equivalent) between the items list and the "Retour à l'app" link (FR-008).
- The "Retour à l'app" link is visually distinguished (lower placement, no accent indicator, no active state).

**Authorization invariant**:
- The shell does NOT call any admin check. The Server Layout (`app/admin/layout.tsx`) has already gated via `requireAdminPageOrNotFound`. Rendering the shell without that prior call would violate FR-016.

---

## 7. Static items module: `admin-sidebar-items.ts` (new)

**Location**: `components/admin/admin-sidebar-items.ts`.

**Exports**:

```ts
export const ADMIN_SIDEBAR_ITEMS: ReadonlyArray<AdminSidebarItem> = [
  { id: 'accueil',  label: 'Accueil',      href: '/admin',          icon: Home },
  { id: 'insights', label: 'Insights LLM', href: '/admin/insights', icon: Sparkles },
] as const;
```

**Contract**:
- Adding a new admin sidebar entry requires editing only this array and adding the corresponding `app/admin/<slug>/page.tsx` (SC-005). No shell, gating, header, or active-state code edits.
- A future divider is added inline as a `{ id, kind: 'divider' }` entry. The shell handles both shapes.

---

## 8. Backwards compatibility / Regression invariants

- `app/admin/layout.tsx` continues to call `requireAdminPageOrNotFound` BEFORE rendering the shell. Removing that call is a security regression.
- `app/admin/insights/page.tsx` is unchanged: same reconciler call, same `InsightsReportView` render. (FR-017, SC-006)
- `app/admin/page.tsx` keeps its `redirect('/admin/insights')` until the Accueil ticket merges. (FR-018, Auto-Resolved D-3)
- `tests/integration/api/admin/insights/parity-404.test.ts` must keep passing untouched. (SC-003)
- `tests/unit/lib/auth/admin.test.ts` keeps passing; new cases for `getViewerIsAdmin` are *additions*.
