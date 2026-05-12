# Implementation Plan: Admin shell and access entry in user menu

**Branch**: `AIB-796-admin-shell-and` | **Date**: 2026-05-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/AIB-796-admin-shell-and/spec.md`

## Summary

Surface the admin space to allowlisted operators by (1) adding an "Admin" entry
to the avatar dropdown and the mobile hamburger menu — server-gated so non-admins
never receive the markup — and (2) replacing the placeholder shell from AIB-791
with a proper layout: header (unchanged, from root layout) + left sidebar
("Espace admin" label, V1 items Accueil + Insights LLM, divider, "Retour à
l'app") + main content. No new HTTP endpoints, no new DB tables, no new env
vars. The admin allowlist resolver (`app/lib/auth/admin.ts`) stays the single
source of truth; the global header consumes a new `getViewerIsAdmin(request)`
helper resolved once per render in the root Server Component layout and passes
the boolean as a prop down to the (Client) `Header` → `UserMenu` / `MobileMenu`
chain. The `/admin → /admin/insights` redirect from AIB-791 is preserved
verbatim until the sibling Accueil ticket lands (FR-018). All 404-parity
guarantees from AIB-791 remain intact and are re-asserted by the existing
integration test (SC-003).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router) + React 18 + NextAuth.js + shadcn/ui + Radix + Tailwind 3.4 + lucide-react. No new deps.
**Storage**: N/A — feature is UI-only. `ADMIN_ALLOWLIST` env var continues to be the sole gating input (no schema change).
**Testing**: Vitest (unit + RTL component tests + integration), Playwright (E2E browser tests). Extends existing `tests/unit/components/user-menu.test.tsx`, `tests/unit/components/mobile-menu.test.tsx`, `tests/unit/components/header.test.tsx`, `tests/unit/lib/auth/admin.test.ts`; adds two new unit files (matcher + admin shell) and one integration file (non-admin HTML grep).
**Target Platform**: Vercel (Next.js App Router) deployed via existing pipeline.
**Project Type**: web (single Next.js app — `app/` for UI + API routes, `components/` for shared UI, `lib/` for shared modules, `tests/` for all test suites).
**Performance Goals**: "Retour à l'app" navigation completes in <300ms (SC-007 — client-side route change, no full reload). Admin/non-admin code paths add zero measurable latency to the global header (server helper executes once per render alongside the existing session resolution).
**Constraints**: 0 admin-related bytes in non-admin HTML responses (SC-002). 0 regressions in 404-parity (SC-003). All visuals use Tailwind semantic tokens — no hardcoded hex (FR-015). Active-state matcher MUST reject incidental prefix collisions (FR-009).
**Scale/Scope**: Small operator allowlist (single-digit). Two V1 sidebar items, designed for trivial extension (SC-005).

## Constitution Check

The repo's constitution lives at `.ai-board/memory/constitution.md` (v1.8.0). The
non-negotiable rules and how this plan satisfies them:

| Principle | How this plan complies |
|-----------|------------------------|
| **I. TypeScript-First Development** — strict, no `any`, explicit types | `getViewerIsAdmin` returns `Promise<boolean>`; new `AdminSidebarItem` / `AdminSidebarDivider` / `AdminSidebarEntry` types are explicitly declared; `isAdminItemActive` has explicit `(string, string) => boolean` signature. No `any` introduced. |
| **II. Component-Driven Architecture** — shadcn/ui, Server Components by default | `app/layout.tsx` and `app/admin/layout.tsx` stay Server Components. `<AdminShell>` is the only new Client Component (justified: needs `usePathname` for active state). Admin entries reuse existing `DropdownMenuItem` + `Link` (UserMenu) and existing styled `<Link>` (MobileMenu) — no custom primitives. Feature folder structure: `components/admin/*`, `lib/admin/*`. |
| **III. TDD — Search FIRST, extend not duplicate** | Phase 0 inventory explicitly identifies the four existing test files to extend (`user-menu.test.tsx`, `mobile-menu.test.tsx`, `header.test.tsx`, `admin.test.ts`) and the three new test files that cover *new* domains with no existing coverage (`active-path.test.ts`, `admin-shell.test.tsx`, `admin-shell-isolation.test.ts`). |
| **IV. Security-First Design** | Admin gating is server-side only (FR-001/FR-002/FR-016). The `Admin` entry's existence is decided by `getViewerIsAdmin(request)` — same allowlist resolver as the page guard, no parallel check. Non-admin responses contain zero admin-related markup (asserted by new integration test). No secrets in responses, no new env vars. |
| **V. Database Integrity** | N/A — no DB changes. Constitution rule about not reusing pre-mutation rows is moot (no mutation). |
| **V. Specification Clarification Guardrails** | `spec.md` includes the Auto-Resolved Decisions block; this plan documents how each Decision is implemented (D-1/D-2/D-3 in research, FR-018 redirect-preservation in this plan and the contract). |

**Forbidden tech check**: No new UI lib (shadcn/ui + Radix only). No new state lib. No new ORM (no DB at all). All requirements met by existing deps.

**Gate evaluation**: **PASS**. No violations to justify in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```
specs/AIB-796-admin-shell-and/
├── plan.md                               # This file
├── spec.md                               # Feature specification (already created)
├── research.md                           # Phase 0 output — existing files, patterns, decisions
├── data-model.md                         # Phase 1 output — entity shapes (no DB)
├── contracts/
│   └── component-contracts.md            # Phase 1 output — props/signatures contracts
└── checklists/
    └── requirements.md                   # Created by /ai-board.checklist (already exists)
```

### Source Code (repository root)

```
app/
├── layout.tsx                            # MODIFY: resolve isAdmin server-side, pass to <Header>
├── lib/auth/admin.ts                     # MODIFY: add getViewerIsAdmin(request); export resolveAdminEmail
└── admin/
    ├── layout.tsx                        # MODIFY: replace inline sidebar with <AdminShell> wrapper; keep requireAdminPageOrNotFound
    ├── page.tsx                          # NO CHANGE (FR-018) — keep redirect('/admin/insights')
    └── insights/page.tsx                 # NO CHANGE (FR-017) — same content rendered inside new shell

components/
├── layout/
│   ├── header.tsx                        # MODIFY: accept isAdmin prop; forward to UserMenu + MobileMenu
│   └── mobile-menu.tsx                   # MODIFY: accept isAdmin?; render Admin entry when true
├── auth/
│   └── user-menu.tsx                     # MODIFY: accept isAdmin?; render Admin entry when true
└── admin/
    ├── admin-shell.tsx                   # NEW Client Component: sidebar + main scaffold, active state
    └── admin-sidebar-items.ts            # NEW: static AdminSidebarItem[] (Accueil, Insights LLM)

lib/admin/
└── active-path.ts                        # NEW: pure isAdminItemActive(pathname, href) matcher

tests/
├── unit/
│   ├── components/
│   │   ├── user-menu.test.tsx            # EXTEND: admin-shown / admin-hidden / placement
│   │   ├── mobile-menu.test.tsx          # EXTEND: admin-shown / admin-hidden / placement
│   │   ├── header.test.tsx               # EXTEND: isAdmin prop propagation
│   │   └── admin/
│   │       └── admin-shell.test.tsx      # NEW: shell renders sidebar items, active state, Retour à l'app
│   └── lib/
│       ├── auth/admin.test.ts            # EXTEND: getViewerIsAdmin cases (admin, non-admin, anon, throwing resolver)
│       └── admin/active-path.test.ts     # NEW: exact / nested / adversarial prefix / root
└── integration/
    └── admin-shell-isolation.test.ts     # NEW: SC-002 — non-admin HTML response contains no admin markup
```

**Structure Decision**: Single Next.js app — sidebar nav, server helper, and
shell component land in their canonical directories per the existing
convention (`components/admin/*`, `lib/admin/*`, `app/lib/auth/*`). No new
top-level structure introduced.

## Implementation Phases

### Phase A — Server helper + UI prop plumbing (P1 unblocker)

1. Extend `app/lib/auth/admin.ts`:
   - Export `resolveAdminEmail` (currently un-exported).
   - Add `getViewerIsAdmin(request: NextRequest): Promise<boolean>` per **P-2** in research. Wraps any exception → `false` per **P-6**.
2. Update `app/layout.tsx`:
   - Resolve `isAdmin` via `getViewerIsAdmin(requestLike)` (same `headers()` → `requestLike` shape used by `app/admin/layout.tsx`).
   - Pass `<Header isAdmin={isAdmin} />`.
3. Update `components/layout/header.tsx`:
   - Add `HeaderProps { isAdmin: boolean }`; forward to `<UserMenu>` and `<MobileMenu>`.
4. Update `components/auth/user-menu.tsx`:
   - Add `isAdmin?: boolean` prop (default `false`).
   - Render the Admin `DropdownMenuItem` between "AI Credentials" and the existing `DropdownMenuSeparator` only when `session?.user && isAdmin`. Use the `Shield` icon and `Link href="/admin"`.
5. Update `components/layout/mobile-menu.tsx`:
   - Add `isAdmin?: boolean` prop (default `false`).
   - Render the matching Admin link after "AI Credentials" only when `session?.user && isAdmin`.
6. Extend existing tests:
   - `user-menu.test.tsx`: admin-shown / admin-hidden / position.
   - `mobile-menu.test.tsx`: admin-shown / admin-hidden / position.
   - `header.test.tsx`: prop is forwarded (mock UserMenu/MobileMenu and assert prop received).
   - `admin.test.ts`: new `getViewerIsAdmin` cases.

### Phase B — Active-state matcher (pure utility)

1. Create `lib/admin/active-path.ts` implementing `isAdminItemActive` per **D-3**.
2. Create `tests/unit/lib/admin/active-path.test.ts`:
   - Exact match: `('/admin', '/admin')` → `true`.
   - Nested match: `('/admin/insights/runs/42', '/admin/insights')` → `true`.
   - Adversarial prefix: `('/admin/insights-fake', '/admin/insights')` → `false`.
   - Root carve-out: `('/admin/insights', '/admin')` → `false`.
   - Inverse root: `('/admin', '/admin/insights')` → `false`.

### Phase C — Admin shell + sidebar items

1. Create `components/admin/admin-sidebar-items.ts` with the V1 entries (Accueil, Insights LLM) per data-model.
2. Create `components/admin/admin-shell.tsx` (Client Component):
   - `'use client'`.
   - Imports `ADMIN_SIDEBAR_ITEMS`, `isAdminItemActive`, `usePathname`, lucide icons, `Link`.
   - Renders the layout per contract §6, using semantic Tailwind tokens only.
   - Renders "Espace admin" label (`text-xs uppercase tracking-wide text-muted-foreground`).
   - Iterates items: a `<Link>` per `AdminSidebarItem`, applying active styles when `isAdminItemActive(pathname, item.href)` is true. Renders an `<hr class="border-border" />` for divider entries.
   - Renders an `<hr>` plus the "Retour à l'app" `<Link href="/">` block at the bottom of the aside (FR-008, FR-013).
3. Update `app/admin/layout.tsx`:
   - Keep `requireAdminPageOrNotFound(requestLike)` call as the first statement (do NOT remove — FR-016).
   - Replace the inline `<aside>` block with `<AdminShell>{children}</AdminShell>`.
   - Strip the unused `Link` import (it now lives in the shell).
4. Create `tests/unit/components/admin/admin-shell.test.tsx`:
   - Renders the "Espace admin" label.
   - Renders Accueil + Insights LLM items with icons.
   - On `usePathname='/admin'`, only Accueil is marked active.
   - On `usePathname='/admin/insights'`, only Insights LLM is marked active.
   - On `usePathname='/admin/insights/runs/42'`, only Insights LLM is marked active (nested).
   - On `usePathname='/admin/insights-fake'`, no item is active (adversarial — though this path won't render in practice, the shell's matcher MUST hold).
   - The "Retour à l'app" link points to `/` and is rendered after a divider.

### Phase D — Cross-cutting isolation guarantee (SC-002)

1. Create `tests/integration/admin-shell-isolation.test.ts`:
   - Render the root layout for a non-admin authenticated session (mock `getViewerIsAdmin` to return `false`).
   - Assert the rendered HTML string contains no `"/admin"` href, no `"Admin"` text inside `<a>` or `<button>` elements, no `data-admin` attribute.
   - Repeat for an unauthenticated session — same assertion.
2. Re-run `tests/integration/api/admin/insights/parity-404.test.ts` (no changes) — confirms SC-003.

### Phase E — Manual verification

- Run `bun run dev` with `ADMIN_ALLOWLIST` set to a seeded admin email.
- Sign in as the admin → confirm Admin entry visible in dropdown; click it → `/admin/insights` renders inside the new shell.
- Open dev tools, switch to a non-admin seed user, repeat: confirm no Admin entry, view-source `grep` for `/admin` returns 0 admin-link matches.
- Verify each sidebar item's active state by manually navigating to `/admin` and `/admin/insights`.
- Verify "Retour à l'app" returns to `/`.
- Toggle the app theme (if a theme toggle exists) and confirm sidebar reflects the change in lockstep — no fixed-color elements (SC-008).

## Testing Strategy

Per constitution §III ("Search existing tests FIRST — extend, don't duplicate"), the
Phase 0 inventory is the contract: four existing test files are extended in
place; three new test files are added only where no existing file covers the
domain.

| Test type | Location | Coverage |
|-----------|----------|----------|
| Unit (RTL component) — EXTEND | `tests/unit/components/user-menu.test.tsx` | Admin entry shown when `isAdmin`; hidden when not; position between AI Credentials and Sign out |
| Unit (RTL component) — EXTEND | `tests/unit/components/mobile-menu.test.tsx` | Same for mobile sheet |
| Unit (RTL component) — EXTEND | `tests/unit/components/header.test.tsx` | `isAdmin` prop is forwarded to UserMenu/MobileMenu |
| Unit (pure logic) — EXTEND | `tests/unit/lib/auth/admin.test.ts` | `getViewerIsAdmin` returns `true`/`false` per session shape; never throws |
| Unit (pure logic) — NEW | `tests/unit/lib/admin/active-path.test.ts` | Matcher: exact, nested, adversarial prefix, root carve-out |
| Unit (RTL component) — NEW | `tests/unit/components/admin/admin-shell.test.tsx` | Shell renders label, items, active state, divider, Retour link |
| Integration — NEW | `tests/integration/admin-shell-isolation.test.ts` | Non-admin HTML contains zero admin markup (SC-002) |
| Integration — UNCHANGED (regression gate) | `tests/integration/api/admin/insights/parity-404.test.ts` | 404 byte-parity preserved (SC-003) |
| E2E | None added | Existing `tests/e2e/admin/insights-flow.spec.ts` continues to gate the `/admin/insights` happy path. The user-menu Admin click → shell render is covered by the integration + unit tests above; no new E2E warranted (constitution: "E2E is expensive — default to integration when unsure"). |

## Complexity Tracking

*Constitution Check passes — no violations to justify.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | — | — |
