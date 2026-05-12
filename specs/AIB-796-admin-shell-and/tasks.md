# Tasks: Admin shell and access entry in user menu

**Branch**: `AIB-796-admin-shell-and`
**Input**: Design documents from `/specs/AIB-796-admin-shell-and/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/component-contracts.md

**Tests**: Included by default (constitution III). Test files are EXTENDED in place when they already cover the domain; NEW files are added only where research.md confirms no existing file covers the responsibility.

**Organization**: Tasks are grouped by user story so each story (US1, US2, US3) can be implemented, tested, and shipped independently.

## Format

`- [ ] [TaskID] [P?] [Story?] Description with exact file path`

- `[P]` — task touches a different file from all other unfinished tasks at the same point in the dependency graph and has no incomplete prerequisites
- `[US#]` — required on user-story phase tasks only; omitted on Setup, Foundational, and Polish

---

## Phase 1: Setup

**Purpose**: Confirm the workspace is ready. No new dependencies, no new directories required — `components/admin/`, `lib/admin/`, and `tests/unit/lib/` already exist; `tests/unit/components/admin/` will be created implicitly when the first shell test is written.

- [ ] T001 Confirm no new dependencies are required and that `lucide-react` already exports `Home`, `Sparkles`, `ArrowLeft`, and `Shield` (per research D-6) by running `bun pm ls lucide-react`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Resolve the admin boolean server-side and thread it through the root layout → `Header` → `UserMenu` / `MobileMenu` chain. US1 and US2 both depend on this plumbing; US3 is independent of it (US3 sits inside `app/admin/*` which already runs `requireAdminPageOrNotFound`).

**⚠️ CRITICAL**: US1 and US2 cannot begin until this phase is complete. US3 may proceed in parallel with this phase.

- [ ] T002 Export the existing `resolveAdminEmail` helper (currently private) in `app/lib/auth/admin.ts` so it can be reused by the new viewer helper (P-2)
- [ ] T003 Add `export async function getViewerIsAdmin(request: NextRequest): Promise<boolean>` in `app/lib/auth/admin.ts` — wraps `resolveAdminEmail` in try/catch, returns `false` on any thrown error or null email (D-1, P-6, contract §1)
- [ ] T004 Extend `tests/unit/lib/auth/admin.test.ts` with `getViewerIsAdmin` cases: allowlisted email → `true`; non-allowlisted email → `false`; null user (anonymous) → `false`; thrown error from session resolver → `false`; empty `ADMIN_ALLOWLIST` → `false`
- [ ] T005 Convert `app/layout.tsx` `RootLayout` to `async`, build the `requestLike` shape from `headers()` (mirroring `app/admin/layout.tsx:21-29`), call `await getViewerIsAdmin(requestLike)`, and pass `<Header isAdmin={isAdmin} />` (D-9, contract §3)
- [ ] T006 Add `HeaderProps { isAdmin: boolean }` to `components/layout/header.tsx`, forward `isAdmin` to `<UserMenu isAdmin={isAdmin} />` and `<MobileMenu isAdmin={isAdmin} />` — do NOT branch any other layout on it (SC-006, contract §3)
- [ ] T007 Extend `tests/unit/components/header.test.tsx` with assertions that the `isAdmin` prop is forwarded to both `UserMenu` and `MobileMenu` (mock both, assert received props for `isAdmin={true}` and `isAdmin={false}`)

**Checkpoint**: Foundation ready — US1 and US2 can now begin.

---

## Phase 3: User Story 1 — Allowlisted admin discovers and enters the admin space (Priority: P1) 🎯 MVP

**Goal**: An allowlisted admin opens the avatar menu (or mobile hamburger) on any authenticated page, sees an "Admin" entry between AI Credentials and Sign out, clicks it, and lands on `/admin` with the new shell.

**Independent Test**: With an admin user logged in (email matches `ADMIN_ALLOWLIST` env var), open the avatar dropdown, verify the "Admin" item is present with icon + label, click it, and confirm `/admin` renders. Repeat on mobile breakpoint with the hamburger sheet.

### Tests for User Story 1

- [ ] T008 [P] [US1] Extend `tests/unit/components/user-menu.test.tsx` with admin-shown cases: rendering with `isAdmin={true}` shows an `<a href="/admin">` with text `Admin` and a `Shield` icon, positioned between the "AI Credentials" item and the `DropdownMenuSeparator` that precedes "Sign out" (contract §4)
- [ ] T009 [P] [US1] Extend `tests/unit/components/mobile-menu.test.tsx` with admin-shown cases: rendering with `isAdmin={true}` shows an `<a href="/admin">` styled like the other menu links, positioned after "AI Credentials" and before the "Sign Out" divider/button block (contract §5)

### Implementation for User Story 1

- [ ] T010 [US1] Add `isAdmin?: boolean` (default `false`) prop to `components/auth/user-menu.tsx`; when `session?.user && isAdmin` is true, render a `DropdownMenuItem asChild` containing `<Link href="/admin"><Shield className="mr-2 h-4 w-4" />Admin</Link>` between the existing "AI Credentials" item and the `DropdownMenuSeparator` preceding "Sign out" (contract §4, D-2, P-4)
- [ ] T011 [US1] Add `isAdmin?: boolean` (default `false`) prop to `components/layout/mobile-menu.tsx`; when `session?.user && isAdmin` is true, render `<Link href="/admin" className="flex items-center px-2 py-2 text-sm rounded-md hover:bg-accent" onClick={() => setOpen(false)}><Shield className="mr-2 h-4 w-4" />Admin</Link>` after the existing "AI Credentials" link and before the "Sign Out" divider/button block (contract §5, D-2)

**Checkpoint**: US1 fully functional — admins reach `/admin` in two clicks from any authenticated page (SC-001).

---

## Phase 4: User Story 2 — Non-admin user sees no admin surface (Priority: P1)

**Goal**: A signed-in non-admin (and any unauthenticated viewer) never sees the Admin entry in any menu, the rendered HTML contains zero admin-related markup, and direct navigation to `/admin` continues to return the byte-equivalent 404.

**Independent Test**: With a non-admin user logged in, render any authenticated page, view source, and confirm there is no "Admin" link, no `/admin` href, and no admin-related attribute. Then GET `/admin` and confirm byte-equivalent 404 (existing parity contract from AIB-791 must keep passing).

### Tests for User Story 2

- [ ] T012 [P] [US2] Extend `tests/unit/components/user-menu.test.tsx` with admin-hidden cases: rendering with `isAdmin={false}` and rendering with `isAdmin` undefined both yield NO Admin item, NO `/admin` href anywhere in the DOM, and preserve the pre-existing item count and order (Profile → Billing → API Tokens → AI Credentials → separator → Sign out) (FR-002, SC-002, contract §4)
- [ ] T013 [P] [US2] Extend `tests/unit/components/mobile-menu.test.tsx` with admin-hidden cases mirroring T012 (FR-002, contract §5)
- [ ] T014 [US2] Create `tests/integration/admin-shell-isolation.test.ts` — renders the root layout for (a) a non-admin authenticated session by mocking `getViewerIsAdmin` to return `false`, and (b) an unauthenticated session; asserts the rendered HTML string contains no `"/admin"` href, no "Admin" text inside `<a>` / `<button>` / `DropdownMenuItem`, and no `data-admin` attribute (SC-002, Phase D)
- [ ] T015 [P] [US2] Run `tests/integration/api/admin/insights/parity-404.test.ts` unchanged and confirm it still passes — this is the regression gate for the AIB-791 404 byte-parity contract (SC-003, P-3); if it fails, fix the regression in the implementation rather than the test

**Checkpoint**: US2 fully functional — zero admin-related markup leaks to non-admins; the 404-parity contract is preserved.

---

## Phase 5: User Story 3 — Admin navigates inside the admin shell (Priority: P1)

**Goal**: An admin already on an admin page uses the sidebar to switch between sections, sees the active item highlighted with both background tint and a lateral indicator, and can return to the main app with one click on "Retour à l'app".

**Independent Test**: As an admin on `/admin/insights`, confirm the "Insights LLM" sidebar item shows the active visual state. Navigate to `/admin/insights/runs/42` and confirm "Insights LLM" remains active (nested matching). Navigate to `/admin/insights-fake` (or simulate it via `usePathname` mock) and confirm no item is active. Click "Retour à l'app" and confirm navigation to `/`.

### Tests for User Story 3

- [ ] T016 [P] [US3] Create `tests/unit/lib/admin/active-path.test.ts` covering `isAdminItemActive(pathname, href)`: exact match `('/admin', '/admin')` → `true`; nested `('/admin/insights/runs/42', '/admin/insights')` → `true`; adversarial prefix `('/admin/insights-fake', '/admin/insights')` → `false`; root carve-out `('/admin/insights', '/admin')` → `false`; inverse root `('/admin', '/admin/insights')` → `false` (FR-009, D-3, contract §2)
- [ ] T017 [P] [US3] Create `tests/unit/components/admin/admin-shell.test.tsx` covering: renders the "Espace admin" label; renders both V1 items with their icons; on `usePathname='/admin'` only "Accueil" is marked active; on `usePathname='/admin/insights'` only "Insights LLM" is marked active; on `usePathname='/admin/insights/runs/42'` only "Insights LLM" is active (nested); on `usePathname='/admin/insights-fake'` no item is active; the "Retour à l'app" link points to `/` and is rendered after a divider (FR-008, FR-010, FR-013, contract §6)

### Implementation for User Story 3

- [ ] T018 [P] [US3] Create `lib/admin/active-path.ts` exporting `export function isAdminItemActive(pathname: string, href: string): boolean` — returns `true` when `pathname === href`, else when `pathname.startsWith(href + '/')`, else `false` (D-3, contract §2)
- [ ] T019 [P] [US3] Create `components/admin/admin-sidebar-items.ts` declaring `AdminSidebarItem`, `AdminSidebarDivider`, and `AdminSidebarEntry` types (data-model §2) and exporting `ADMIN_SIDEBAR_ITEMS: ReadonlyArray<AdminSidebarEntry>` with V1 entries `{ id: 'accueil', label: 'Accueil', href: '/admin', icon: Home }` and `{ id: 'insights', label: 'Insights LLM', href: '/admin/insights', icon: Sparkles }` (contract §7, D-6)
- [ ] T020 [US3] Create `components/admin/admin-shell.tsx` as a Client Component (`'use client'`) that: imports `ADMIN_SIDEBAR_ITEMS`, `isAdminItemActive`, `usePathname`, `Link`, and `ArrowLeft` from lucide-react; renders `<div class="flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">` with an `<aside>` containing a `text-xs uppercase tracking-wide text-muted-foreground` "Espace admin" header, a `<nav>` iterating `ADMIN_SIDEBAR_ITEMS` (`<Link>` per item with active styles `bg-accent/30 border-l-2 border-primary` and inactive `hover:bg-accent`, divider entries render as `<hr className="border-border" />`), a final `<hr>` plus `<Link href="/"><ArrowLeft …/>Retour à l'app</Link>`, and a `<main className="flex-1 p-6">{children}</main>` (FR-008/FR-010/FR-013/FR-014/FR-015, D-4/D-7/D-8, contract §6)
- [ ] T021 [US3] Update `app/admin/layout.tsx` to keep the `requireAdminPageOrNotFound(requestLike)` call as the first awaited statement (do NOT remove — FR-016), then render `<AdminShell>{children}</AdminShell>` in place of the inline `<aside>` block; remove the now-unused `Link` import (it lives inside the shell) and the inline sidebar JSX (FR-007, contract §6 authorization invariant, P-3)

**Checkpoint**: US3 fully functional — sidebar marks exactly one active item per route, theme tokens drive every color, "Retour à l'app" returns to `/` (SC-004, SC-005, SC-006, SC-007, SC-008).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify the integrated feature meets quality gates before merge.

- [ ] T022 Run `bun run type-check` in repository root and resolve any TypeScript errors (constitution I)
- [ ] T023 Run `bun run lint` in repository root and resolve any ESLint errors
- [ ] T024 Run `bun run test:unit` for all modified/created unit tests (`tests/unit/lib/auth/admin.test.ts`, `tests/unit/components/header.test.tsx`, `tests/unit/components/user-menu.test.tsx`, `tests/unit/components/mobile-menu.test.tsx`, `tests/unit/lib/admin/active-path.test.ts`, `tests/unit/components/admin/admin-shell.test.tsx`) and confirm green
- [ ] T025 Run `bun run test:integration tests/integration/admin-shell-isolation.test.ts tests/integration/api/admin/insights/parity-404.test.ts` and confirm both green (SC-002, SC-003)
- [ ] T026 Manual verification per plan Phase E in `bun run dev`: (a) sign in as admin → Admin entry visible in dropdown → click → `/admin/insights` renders inside new shell; (b) sign in as non-admin → no Admin entry → view-source grep for `/admin` returns 0 admin-link matches; (c) navigate to `/admin` and `/admin/insights` → verify active state on the correct sidebar item; (d) click "Retour à l'app" → land on `/`; (e) toggle the app theme → sidebar elements switch in lockstep with the rest of the UI (SC-008)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately
- **Phase 2 (Foundational)**: Depends on Setup — BLOCKS US1 and US2 (does NOT block US3)
- **Phase 3 (US1)**: Depends on Foundational
- **Phase 4 (US2)**: Depends on Foundational
- **Phase 5 (US3)**: Independent of Foundational — can start after Setup, in parallel with Phase 2/3/4
- **Phase 6 (Polish)**: Depends on all chosen user-story phases

### User Story Dependencies

- **US1 (P1, MVP)**: Requires Foundational (T002–T007). No dependency on US2 or US3.
- **US2 (P1)**: Requires Foundational (T002–T007). Shares the `UserMenu` / `MobileMenu` files with US1, so US2 test extensions must land in the same files US1 modified — sequence US1 implementation before US2 tests, or write both sets of tests up front and let the single implementation satisfy both.
- **US3 (P1)**: Independent. Touches only `app/admin/layout.tsx`, new files in `components/admin/`, `lib/admin/`, and new test files. Can be developed in parallel with US1/US2.

### Within Each User Story

- Tests (extended or new) are written FIRST and confirmed failing before implementation tasks land
- Pure utilities (matcher) before consumers (shell component)
- Data array (`ADMIN_SIDEBAR_ITEMS`) before the shell that reads it
- Server helper and prop threading before menu component conditional rendering

### Parallel Opportunities

- T008, T009 (US1 tests) — different files, run in parallel
- T012, T013 (US2 tests) — different files, run in parallel
- T015 (regression gate) is read-only and may run any time after the implementation lands; flagged [P] within US2
- T016, T017 (US3 tests) — different files, run in parallel
- T018, T019 (US3 pure utility + items array) — different files, run in parallel
- T020 must wait for T018 + T019 (imports both)
- T021 must wait for T020 (imports `<AdminShell>`)
- Phase 5 (US3) entirely independent of Phase 2/3/4 — full parallelism across stories

---

## Parallel Example: User Story 3 (independent of US1/US2)

```bash
# After T001 (Setup), launch the US3 utility + items + tests in parallel:
Task: "Create lib/admin/active-path.ts isAdminItemActive matcher"          # T018 [P]
Task: "Create components/admin/admin-sidebar-items.ts items array"         # T019 [P]
Task: "Create tests/unit/lib/admin/active-path.test.ts"                    # T016 [P]
Task: "Create tests/unit/components/admin/admin-shell.test.tsx"            # T017 [P]

# Then sequentially:
Task: "Implement components/admin/admin-shell.tsx (depends on T018, T019)" # T020
Task: "Wire AdminShell into app/admin/layout.tsx (depends on T020)"        # T021
```

## Parallel Example: Foundational (Phase 2)

```bash
# T002 must land before T003. After T003, the helper test and the layout/header
# changes touch different files and can proceed in parallel:
Task: "Extend tests/unit/lib/auth/admin.test.ts with getViewerIsAdmin cases" # T004 [implicitly parallelizable with T005/T006]
Task: "Convert app/layout.tsx to async and pass isAdmin to <Header>"         # T005
Task: "Add HeaderProps and forward isAdmin in components/layout/header.tsx"  # T006
Task: "Extend tests/unit/components/header.test.tsx with prop forwarding"    # T007
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational) — server helper + prop threading.
3. Complete Phase 3 (US1) — admin sees the Admin entry in both menus.
4. **STOP and VALIDATE**: Sign in as an allowlisted admin and confirm two-click access to `/admin` (SC-001).
5. Deploy or demo.

### Incremental Delivery

1. Setup + Foundational → wiring ready.
2. US1 → admins reach the admin space. Validate. Deploy/demo (MVP).
3. US2 → security contract verified by integration test. Validate. Deploy/demo.
4. US3 (can also be started in parallel after Setup) → admin shell + sidebar navigation. Validate. Deploy/demo.
5. Polish phase → type-check, lint, integration suite, manual checks.

### Parallel Execution Strategy

ai-board can execute the three P1 stories with the following parallelism:

- After Setup completes, dispatch US3 in parallel with Phase 2 (Foundational); US3 does not need the foundational helper.
- After Foundational completes, US1 and US2 can run in parallel — they touch the same two component files (`user-menu.tsx`, `mobile-menu.tsx`), so coordinate the file edits: write US1's implementation tasks (T010/T011) first, then US2's test-only tasks (T012/T013/T014/T015) can run in parallel with anything else.

---

## Notes

- `[P]` tasks operate on different files with no incomplete prerequisites at the time of dispatch.
- `[US#]` traceability lets per-story regression triage skip unrelated changes.
- Tests are written or extended before implementation — confirm they fail in the expected way (e.g., "Admin entry not found") before adding the conditional render.
- The constitution rule "Search existing tests FIRST — extend, don't duplicate" is honored: 4 existing test files are extended (T004, T007, T008+T012, T009+T013); 3 new test files are added only for new domains with no existing coverage (T014, T016, T017).
- No new dependencies. No new env vars. No DB or Prisma changes. No new HTTP endpoints.
- `app/admin/page.tsx` is INTENTIONALLY untouched per FR-018; the `redirect('/admin/insights')` one-liner remains until the sibling "Accueil admin" ticket lands.
- All visuals use Tailwind semantic tokens (`bg-accent`, `border-border`, `text-muted-foreground`, `border-primary`, etc.) — zero hardcoded hex (FR-015, constitution).
- Commit after each task or logical group; never use `--no-verify` (CLAUDE.md).
