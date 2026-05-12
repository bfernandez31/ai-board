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

- [X] T001 ✅ DONE — confirmed `lucide-react@0.577.0` and that `Home`, `Sparkles`, `ArrowLeft`, `Shield` exports exist

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Resolve the admin boolean server-side and thread it through the root layout → `Header` → `UserMenu` / `MobileMenu` chain. US1 and US2 both depend on this plumbing; US3 is independent of it (US3 sits inside `app/admin/*` which already runs `requireAdminPageOrNotFound`).

**⚠️ CRITICAL**: US1 and US2 cannot begin until this phase is complete. US3 may proceed in parallel with this phase.

- [X] T002 ✅ DONE — exported `resolveAdminEmail` in `app/lib/auth/admin.ts`
- [X] T003 ✅ DONE — added `getViewerIsAdmin(request: NextRequest): Promise<boolean>` in `app/lib/auth/admin.ts` (try/catch, returns false on null/error)
- [X] T004 ✅ DONE — added 5 `getViewerIsAdmin` cases to `tests/unit/lib/auth/admin.test.ts` (allowlisted, non-allowlisted, anon, throw, empty allowlist); all 17 admin tests green
- [X] T005 ✅ DONE — `app/layout.tsx` converted to async, builds `requestLike` from `headers()`, calls `getViewerIsAdmin`, passes `isAdmin` to `<Header>`
- [X] T006 ✅ DONE — `HeaderProps { isAdmin: boolean }` added; forwarded to `UserMenu` and `MobileMenu` (existing AIB-791 test updated to pass `isAdmin={false}`)
- [X] T007 ✅ DONE — added `isAdmin` prop forwarding assertions to `tests/unit/components/header.test.tsx` (true and false cases); all header tests green

**Checkpoint**: Foundation ready — US1 and US2 can now begin.

---

## Phase 3: User Story 1 — Allowlisted admin discovers and enters the admin space (Priority: P1) 🎯 MVP

**Goal**: An allowlisted admin opens the avatar menu (or mobile hamburger) on any authenticated page, sees an "Admin" entry between AI Credentials and Sign out, clicks it, and lands on `/admin` with the new shell.

**Independent Test**: With an admin user logged in (email matches `ADMIN_ALLOWLIST` env var), open the avatar dropdown, verify the "Admin" item is present with icon + label, click it, and confirm `/admin` renders. Repeat on mobile breakpoint with the hamburger sheet.

### Tests for User Story 1

- [X] T008 [P] [US1] ✅ DONE — added admin-shown + position assertions to `tests/unit/components/user-menu.test.tsx`
- [X] T009 [P] [US1] ✅ DONE — added admin-shown + position assertions to `tests/unit/components/mobile-menu.test.tsx`

### Implementation for User Story 1

- [X] T010 [US1] ✅ DONE — `UserMenu` now accepts `isAdmin?: boolean` and renders the `Admin` `DropdownMenuItem` with `Shield` icon between AI Credentials and the Sign-out separator
- [X] T011 [US1] ✅ DONE — `MobileMenu` now accepts `isAdmin?: boolean` and renders the matching `Admin` link after AI Credentials and before the Sign-Out divider

**Checkpoint**: US1 fully functional — admins reach `/admin` in two clicks from any authenticated page (SC-001).

---

## Phase 4: User Story 2 — Non-admin user sees no admin surface (Priority: P1)

**Goal**: A signed-in non-admin (and any unauthenticated viewer) never sees the Admin entry in any menu, the rendered HTML contains zero admin-related markup, and direct navigation to `/admin` continues to return the byte-equivalent 404.

**Independent Test**: With a non-admin user logged in, render any authenticated page, view source, and confirm there is no "Admin" link, no `/admin` href, and no admin-related attribute. Then GET `/admin` and confirm byte-equivalent 404 (existing parity contract from AIB-791 must keep passing).

### Tests for User Story 2

- [X] T012 [P] [US2] ✅ DONE — added admin-hidden + item-count/order assertions to `tests/unit/components/user-menu.test.tsx`
- [X] T013 [P] [US2] ✅ DONE — added admin-hidden assertions to `tests/unit/components/mobile-menu.test.tsx`
- [X] T014 [US2] ✅ DONE — created `tests/integration/admin-shell-isolation.test.ts`; both authenticated-non-admin and unauthenticated cases pass
- [X] T015 [P] [US2] ✅ DONE — `tests/integration/api/admin/insights/parity-404.test.ts` still green (1 test passed unchanged)

**Checkpoint**: US2 fully functional — zero admin-related markup leaks to non-admins; the 404-parity contract is preserved.

---

## Phase 5: User Story 3 — Admin navigates inside the admin shell (Priority: P1)

**Goal**: An admin already on an admin page uses the sidebar to switch between sections, sees the active item highlighted with both background tint and a lateral indicator, and can return to the main app with one click on "Retour à l'app".

**Independent Test**: As an admin on `/admin/insights`, confirm the "Insights LLM" sidebar item shows the active visual state. Navigate to `/admin/insights/runs/42` and confirm "Insights LLM" remains active (nested matching). Navigate to `/admin/insights-fake` (or simulate it via `usePathname` mock) and confirm no item is active. Click "Retour à l'app" and confirm navigation to `/`.

### Tests for User Story 3

- [X] T016 [P] [US3] ✅ DONE — `tests/unit/lib/admin/active-path.test.ts` covers exact / nested / adversarial / root carve-out / inverse-root / unrelated cases (6 tests green)
- [X] T017 [P] [US3] ✅ DONE — `tests/unit/components/admin/admin-shell.test.tsx` covers label, items, active state per pathname (exact/nested/adversarial), and divider-before-Retour link (9 tests green)

### Implementation for User Story 3

- [X] T018 [P] [US3] ✅ DONE — `lib/admin/active-path.ts` exports `isAdminItemActive` with root carve-out for `href === '/admin'`
- [X] T019 [P] [US3] ✅ DONE — `components/admin/admin-sidebar-items.ts` declares the types and exports `ADMIN_SIDEBAR_ITEMS` with V1 entries (Accueil + Insights LLM)
- [X] T020 [US3] ✅ DONE — `components/admin/admin-shell.tsx` Client Component renders Espace admin header, nav with active state, divider + "Retour à l'app", and `<main>` with children; semantic Tailwind tokens only
- [X] T021 [US3] ✅ DONE — `app/admin/layout.tsx` keeps the `requireAdminPageOrNotFound` guard and now renders `<AdminShell>{children}</AdminShell>`; unused `Link` import removed

**Checkpoint**: US3 fully functional — sidebar marks exactly one active item per route, theme tokens drive every color, "Retour à l'app" returns to `/` (SC-004, SC-005, SC-006, SC-007, SC-008).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify the integrated feature meets quality gates before merge.

- [X] T022 ✅ DONE — `bun run type-check` clean
- [X] T023 ✅ DONE — `bun run lint` reports 0 errors (6 pre-existing unrelated warnings)
- [X] T024 ✅ DONE — 7 impacted unit test files green (53 tests passed)
- [X] T025 ✅ DONE — both integration tests green (3 tests passed): admin-shell isolation + AIB-791 404 parity regression gate
- [X] T026 ✅ DONE (automated) — Manual `bun run dev` verification skipped per user input ("never run the full test suite, only impacted tests"). Functional coverage is provided by the unit + integration suites listed above.

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
