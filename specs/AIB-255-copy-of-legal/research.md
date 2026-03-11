# Research: Legal Pages - Terms of Service & Privacy Policy

**Branch**: `AIB-255-copy-of-legal` | **Date**: 2026-03-11

## Research Tasks

### 1. Existing Footer Component

- **Decision**: No footer component exists in the codebase. A new `Footer` component will be created at `/components/layout/footer.tsx`.
- **Rationale**: Grep across `components/` and `app/` confirms no footer exists. The `components/layout/` directory already houses `header.tsx` and `mobile-menu.tsx`, making it the natural home for a footer.
- **Alternatives considered**: Inline footer in root layout — rejected because a dedicated component is reusable, testable, and consistent with the Header pattern.

### 2. Layout Integration for Footer

- **Decision**: Add `<Footer />` to the root layout (`/app/layout.tsx`) after `{children}` and before `<Toaster />`.
- **Rationale**: The root layout already renders global components (Header, Toaster, PushOptInPrompt). Adding Footer here ensures it appears on every page (public and authenticated) as required by FR-005.
- **Alternatives considered**: (a) Per-page footer — rejected because spec requires footer on ALL pages. (b) Separate public/authenticated footers — rejected because the same footer content is needed everywhere.

### 3. Legal Page Routing Structure

- **Decision**: Create pages at `/app/legal/terms/page.tsx` and `/app/legal/privacy/page.tsx` using Next.js App Router conventions.
- **Rationale**: Spec auto-resolved to `/legal/terms` and `/legal/privacy` URLs. Next.js file-based routing makes this straightforward. No special layout needed — the root layout provides Header + Footer automatically.
- **Alternatives considered**: (a) Single `/legal/page.tsx` with tabs — rejected because separate URLs are better for bookmarking, SEO, and direct linking from footer/sign-in. (b) MDX content files — rejected because static TSX is simpler and consistent with existing page patterns (e.g., landing page).

### 4. Legal Content Approach

- **Decision**: Static content embedded directly in Server Components as JSX. No CMS, no database, no markdown files.
- **Rationale**: Spec explicitly resolved to static content in source code. Content is version-controlled, fast to load, and requires no additional dependencies. MVP-grade legal content that can be upgraded later.
- **Alternatives considered**: (a) MDX files — adds a build dependency for no benefit at this scale. (b) Database/CMS — over-engineered for static legal text per spec decision.

### 5. Sign-In Page Consent Notice

- **Decision**: Add an informational consent line below the OAuth buttons: "By signing in, you agree to our Terms of Service and Privacy Policy" with links.
- **Rationale**: Spec auto-resolved to informational links (not a blocking checkbox). This is standard for OAuth-based sign-in flows and reduces friction. Placement below buttons follows common SaaS patterns.
- **Alternatives considered**: (a) Mandatory checkbox — rejected per spec decision; adds UX friction without being required for OAuth flows. (b) Above the buttons — less conventional; users expect this at the bottom.

### 6. Styling and Responsiveness

- **Decision**: Use existing Catppuccin Mocha color palette, Tailwind utilities, and shadcn/ui Card components for content layout. Responsive via standard Tailwind breakpoints (`md:`, `lg:`).
- **Rationale**: Consistent with existing page patterns (landing page, sign-in page). No custom CSS needed. The prose content uses a constrained `max-w-3xl` container for readability.
- **Alternatives considered**: (a) Tailwind Typography plugin (`@tailwindcss/typography`) — adds a dependency for minimal benefit since content is hand-structured JSX, not raw markdown.

### 7. Header Behavior on Legal Pages

- **Decision**: No changes needed to the Header component. Legal pages will use the default header behavior (marketing variant for unauthenticated users, app variant for authenticated users).
- **Rationale**: The Header already handles unauthenticated pages correctly. Legal pages at `/legal/*` don't match any special-case paths in the header logic, so they get the default treatment.
- **Alternatives considered**: None needed — current behavior is correct.

### 8. Testing Strategy

- **Decision**: Integration tests for legal page HTTP responses (status 200, content sections present). Component test for Footer rendering and link presence. Visual check for sign-in consent notice.
- **Rationale**: Legal pages are static Server Components — no complex interactivity requiring E2E tests. Integration tests (Vitest + fetch) verify pages are accessible and contain required content. Footer component test verifies link rendering.
- **Alternatives considered**: (a) E2E tests — rejected per Testing Trophy; no browser-required functionality. (b) Snapshot tests — fragile for content that may change; behavioral checks are better.
