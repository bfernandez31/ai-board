# Feature Specification: Admin shell and access entry in user menu

**Feature Branch**: `AIB-796-admin-shell-and`
**Created**: 2026-05-12
**Status**: Draft
**Input**: Ticket AIB-796 — "Admin shell and access entry in user menu"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Render the "Admin" user-menu entry only when the server has confirmed the viewer is on the admin allowlist; non-admins must not receive the markup, link, or any conditional placeholder.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score +4, sensitive/security signal dominant)
- **Fallback Triggered?**: No — ticket text already mandates server-side gating ("Invisible aux autres dans le DOM reçu"). Decision restates and enforces it.
- **Trade-offs**:
  1. The current client-only `UserMenu` (driven by `useSession()`) must be adapted so admin status is resolved server-side and passed in, adding a small refactor cost.
  2. Slight increase in coupling between the global header and server-side admin allowlist resolution; avoids leaking allowlist membership to non-admins.
- **Reviewer Notes**: Validate that view-source on `/`, `/projects/*`, and any signed-in route returns no "Admin" link, no `data-admin` attribute, and no inline boolean for non-admin sessions. Test with `tests/unit/lib/auth/admin.test.ts`-style helpers and an integration test against rendered HTML.

- **Decision**: Mirror the avatar-dropdown "Admin" entry in the mobile hamburger menu (admins on small screens see it; non-admins never do, same server gating).
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score +3, parity with existing user-menu items)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Slightly more UI surface to maintain — but `MobileMenu` already duplicates every dropdown entry, so the marginal cost is low.
  2. Avoids the surprise of admins on mobile/tablet being unable to reach `/admin` without typing the URL, which would re-create the very pain the ticket fixes.
- **Reviewer Notes**: Confirm the mobile sheet renders the Admin link only for admins, between existing items and Sign Out, identical in placement to the dropdown ordering.

- **Decision**: Replace the placeholder `/admin` shell built in AIB-791 with the new shell, while preserving the existing 404-parity guard (`requireAdminPageOrNotFound`) and the `/admin → /admin/insights` root redirect *only* until the "Accueil admin" ticket lands. The default landing target after Accueil ships is `/admin` (Accueil).
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score +2, scope clarity)
- **Fallback Triggered?**: Yes — the ticket cross-references the Accueil and Insights LLM refresh tickets; this spec must not assume their delivery order. CONSERVATIVE choice: keep redirect-to-Insights for now, switch to Accueil page when that ticket merges.
- **Trade-offs**:
  1. Slight ordering coupling with sibling tickets — documented as a deferred behavioral change.
  2. Reduces risk of shipping a broken root page if Accueil lands after this shell.
- **Reviewer Notes**: When merging, verify whether AIB's "Accueil admin" ticket has shipped; if yes, remove the redirect and let `app/admin/page.tsx` render Accueil. Until then, redirect remains.

- **Decision**: Active-state matching uses prefix match with an exact-segment guard — an item with `href="/admin/insights"` is active for `/admin/insights` and `/admin/insights/...`, but not for `/admin/insights-other`. The "Accueil" item (root) is active only on the exact `/admin` path.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (well-known Next.js pattern)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Slightly more logic than naive `startsWith`, but prevents the well-known bug of "root" item glowing on every subpath.
- **Reviewer Notes**: Cover with unit tests over the matcher helper; include the `/admin/insights-fake` adversarial case.

- **Decision**: Sidebar items in V1 use Lucide icons consistent with the existing user-menu / navigation conventions: `Home` for Accueil, `Sparkles` (or `BarChart3`) for Insights LLM. Final icon choice is a stylistic call; spec only requires "icon + label".
- **Policy Applied**: AUTO → PRAGMATIC
- **Confidence**: Low (cosmetic)
- **Fallback Triggered?**: No (cosmetic, no security/scope impact)
- **Trade-offs**:
  1. Picking icons upfront avoids a bikeshed at implementation time; reviewers can swap during plan/build with no functional impact.
- **Reviewer Notes**: Acceptable to override during implementation if the design system has a preferred admin/insights glyph already in use.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Allowlisted admin discovers and enters the admin space (Priority: P1)

An allowlisted user signed into AI-BOARD opens their avatar menu on any authenticated page, sees an "Admin" entry between the existing items and "Sign out", clicks it, and lands on `/admin` with the new shell visible.

**Why this priority**: This is the entire reason the ticket exists. Until this works, admins must memorize the URL — the access-entry requirement is unmet.

**Independent Test**: With an admin user logged in (email matches `ADMIN_ALLOWLIST` env var), open the avatar dropdown, verify the "Admin" item is present and labeled, click it, and confirm the URL is `/admin` and the new shell renders.

**Acceptance Scenarios**:

1. **Given** an authenticated admin viewer on any non-admin page, **When** they open the avatar dropdown, **Then** an "Admin" item appears between the existing settings entries and "Sign out", with an icon and the label "Admin".
2. **Given** the avatar dropdown is open for an admin, **When** they click "Admin", **Then** the browser navigates to `/admin` and the admin shell (header + sidebar + main area) is rendered.
3. **Given** an admin on a small-screen device, **When** they open the hamburger/mobile menu, **Then** the "Admin" entry is also present and clickable, between the existing items and "Sign Out".

---

### User Story 2 - Non-admin user sees no admin surface (Priority: P1)

A signed-in user whose email is **not** in the admin allowlist never sees any reference to the admin space, neither in the avatar dropdown, the mobile menu, nor the HTML markup. Typing `/admin` directly still yields a 404 indistinguishable from a non-existent route.

**Why this priority**: This is the security contract inherited from AIB-791. Leaking the existence of an admin space (even via a hidden DOM node) is unacceptable.

**Independent Test**: With a non-admin user logged in, render any authenticated page, view source, and confirm there is no "Admin" link, no admin-related attribute, no commented-out admin block. Then GET `/admin`, confirm a byte-equivalent 404.

**Acceptance Scenarios**:

1. **Given** an authenticated non-admin viewer, **When** any authenticated page renders, **Then** the response body contains no "Admin" entry, no `/admin` href, and no admin-related conditional placeholder.
2. **Given** an authenticated non-admin viewer, **When** they open the avatar dropdown, **Then** they see only the previously existing entries (Profile, Billing, API Tokens, AI Credentials, Sign out) — count and order unchanged.
3. **Given** an authenticated non-admin viewer, **When** they navigate to `/admin`, **Then** the response is the byte-equivalent 404 already enforced by `requireAdminPageOrNotFound` (no regression).
4. **Given** an unauthenticated viewer, **When** any public page renders, **Then** no admin-related markup is emitted (server-side gate must run regardless of session state).

---

### User Story 3 - Admin navigates inside the admin shell (Priority: P1)

An admin already on an admin page uses the sidebar to switch between sections, sees the active item visually highlighted, and can return to the main app with one click.

**Why this priority**: Without working navigation inside the shell, the admin space is just a single page reachable by URL — the structural goal of the ticket fails.

**Independent Test**: As an admin on `/admin/insights`, confirm the "Insights LLM" sidebar item is visually marked active. Click "Accueil"; confirm navigation to `/admin` (or `/admin` redirecting per the deferred decision). Click "Retour à l'app"; confirm navigation to `/`.

**Acceptance Scenarios**:

1. **Given** an admin viewing `/admin/insights`, **When** the sidebar renders, **Then** the "Insights LLM" item has the active visual state (subtle background + lateral indicator) and no other sidebar item appears active.
2. **Given** an admin viewing `/admin` (Accueil), **When** the sidebar renders, **Then** the "Accueil" item is active and the "Insights LLM" item is not.
3. **Given** an admin viewing a hypothetical nested admin page (e.g., `/admin/insights/runs/123`), **When** the sidebar renders, **Then** "Insights LLM" remains active (prefix-with-segment matching), and "Accueil" is not active.
4. **Given** an admin on any admin page, **When** they click "Retour à l'app", **Then** the browser navigates to `/`.
5. **Given** an admin on any admin page, **When** the global header renders, **Then** the logo, notification bell, and avatar dropdown are visually intact (no missing or amputated elements compared to non-admin pages).

---

### Edge Cases

- A user is added to the admin allowlist mid-session. They see the "Admin" entry on the next request that re-renders the header (no need to sign out), because admin status is recomputed server-side per request.
- A user is removed from the allowlist mid-session. The next server-rendered response no longer includes the "Admin" entry, and direct navigation to `/admin` returns the 404.
- The viewport is below the mobile breakpoint. The desktop avatar dropdown is hidden; the mobile menu carries the "Admin" entry instead. The admin shell itself remains usable; sidebar behavior on narrow viewports is out of scope for V1 (sidebar may be stacked or scrollable — implementer's call, but must not break usability).
- A future sidebar entry needs to live in a separate semantic group (e.g., "Users", "Projets", "Jobs" below a divider). The shell's sidebar must accept additional items and at least one divider without code restructuring.
- `ADMIN_ALLOWLIST` env var is empty or unset. No user has admin status; the "Admin" entry is never rendered; `/admin` returns 404 for everyone.
- A non-admin clicks a stale browser-cached link pointing to `/admin`. The route still 404s; no admin surface leaks.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The avatar dropdown (`UserMenu`) MUST receive admin status determined server-side on each render and MUST render an "Admin" item if and only if that status is true.
- **FR-002**: For non-admin viewers (including unauthenticated viewers), the rendered HTML MUST NOT contain the "Admin" item, the `/admin` href, or any DOM attribute that signals the existence of the admin surface. Hidden-but-present markup is not acceptable.
- **FR-003**: The "Admin" item MUST appear between the existing settings entries and the "Sign out" entry, separated from "Sign out" by the existing menu separator.
- **FR-004**: The "Admin" item MUST display an icon and the label "Admin", clicking it MUST navigate to `/admin`.
- **FR-005**: The mobile hamburger menu (`MobileMenu`) MUST mirror the avatar-dropdown "Admin" item, with the same server-side admin gating and identical visibility rules.
- **FR-006**: `/admin` and all `/admin/*` pages MUST continue to call the existing admin guard (`requireAdminPageOrNotFound`) and produce a byte-equivalent 404 for non-admins. No regression to AIB-791 parity behavior.
- **FR-007**: The admin shell MUST keep the global application header (logo, notification bell, avatar dropdown) rendered unchanged on every `/admin/*` page. The shell wraps the header's content area, not the header itself.
- **FR-008**: The admin shell MUST render a left sidebar with: a visible label "Espace admin", a vertical list of navigation items (each with an icon, a label, and an active-state indicator), at least one visual divider to support future grouping, and a "Retour à l'app" link at the bottom.
- **FR-009**: The sidebar MUST mark exactly one item active per route. An item is active when the current path matches its `href` exactly (root case) or its `href` followed by a `/` segment (nested case). The matcher MUST NOT activate on incidental prefix collisions (`/admin/insights` MUST NOT match `/admin/insights-fake`).
- **FR-010**: The active visual state MUST include both a subtle background tint and a lateral indicator (e.g., a left-edge accent bar), per the ticket's "background subtil + indication latérale" requirement.
- **FR-011**: V1 sidebar items MUST include "Accueil" pointing to `/admin` and "Insights LLM" pointing to `/admin/insights`.
- **FR-012**: The sidebar MUST be structured so adding a new item (icon + label + href) requires only adding a data entry — no per-item layout edits. The structure MUST also support inserting a divider between groups of items without code restructuring.
- **FR-013**: The "Retour à l'app" link MUST navigate to `/` (application root). It MUST be visually distinguished from the navigation items above (e.g., sits below a divider at the bottom).
- **FR-014**: The main content area to the right of the sidebar MUST occupy the remaining horizontal space and apply consistent internal padding across all admin pages.
- **FR-015**: All sidebar visuals (typography, colors, hover, active state, divider, spacing) MUST use the project's existing design tokens (Tailwind semantic tokens, shadcn/ui conventions, Aurora-B+ utilities where applicable). No hardcoded hex/rgb colors.
- **FR-016**: The admin shell MUST continue to delegate authorization to `requireAdminPageOrNotFound` in the server layout. The new UI MUST NOT introduce a parallel admin check that could drift from the canonical allowlist resolver.
- **FR-017**: Existing admin routes (`/admin/insights`) MUST continue to render their current page content inside the new shell with no behavior regression (insights list, reconciliation, preflight snapshot still work).
- **FR-018**: Until the "Accueil admin" ticket ships, `/admin` MUST continue to redirect to `/admin/insights`. The redirect MUST be removable in a single edit (`app/admin/page.tsx`) once Accueil ships, with no other shell changes required.

### Key Entities *(include if feature involves data)*

- **AdminSidebarItem**: A displayable navigation entry. Attributes: `label` (string shown to the user), `href` (target path), `icon` (visual glyph), and derived `isActive` (computed from the current pathname). Items have no persistence; they are statically declared in the shell.
- **AdminViewerContext**: The server-resolved fact "is the current request from an admin?" — derived from the session email and `ADMIN_ALLOWLIST` env var, passed into client components that need to gate admin-only UI. No DB persistence.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of admin users (allowlisted accounts) can reach `/admin` from any authenticated page in two clicks (avatar → Admin) without typing a URL.
- **SC-002**: 0% of non-admin sessions receive any admin-related markup in the HTML response (verified by content-grep over a representative set of authenticated pages for both admin and non-admin fixtures).
- **SC-003**: 0 regressions in the 404-parity contract: byte comparison between `/admin` for a non-admin and `/this-route-does-not-exist` continues to match (test inherited from AIB-791).
- **SC-004**: On every `/admin/*` page, the sidebar correctly marks exactly one item active for each of the routes covered in V1 (Accueil, Insights LLM, and at least one nested Insights path) — verified by unit tests on the matcher and an integration test rendering each route.
- **SC-005**: Adding a hypothetical new sidebar item (e.g., "Users") in plan-time review requires editing only the sidebar items array and adding one new page — the shell, header, gating, and active-state logic require no additional changes.
- **SC-006**: The global header on `/admin/*` pages is visually identical to non-admin pages (logo, bell, avatar in expected positions) — no "amputated nav" appearance from the AIB-791 placeholder.
- **SC-007**: "Retour à l'app" successfully navigates an admin from any `/admin/*` page to `/` in one click, with perceived navigation latency under 300ms (no full page reload flash).
- **SC-008**: Toggling the application's light/dark theme updates every admin shell element (sidebar background, label, items, divider, active state, "Retour à l'app") in lockstep with the rest of the app — no element keeps a fixed color, indicating theme tokens (not hardcoded values) are used throughout.
