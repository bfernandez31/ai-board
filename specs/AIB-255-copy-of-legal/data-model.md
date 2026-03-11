# Data Model: Legal Pages - Terms of Service & Privacy Policy

**Branch**: `AIB-255-copy-of-legal` | **Date**: 2026-03-11

## Database Changes

**None required.** This feature consists entirely of static UI pages and components. No new database tables, fields, or migrations are needed.

## Entities

### Static Content (Source Code Only)

These are not database entities — they are static content structures embedded in page components.

#### Terms of Service Page Content

| Section | Required By | Description |
|---------|------------|-------------|
| Effective Date | FR-008 | Date when content was last updated |
| Conditions of Use | FR-003 | General terms for using the platform |
| Limitation of Liability | FR-003 | Liability disclaimers |
| BYOK API Cost Responsibility | FR-003 | User responsibility for API costs (Bring Your Own Key) |
| AI-Generated Code Responsibility | FR-003 | Disclaimer for AI-generated code quality |

#### Privacy Policy Page Content

| Section | Required By | Description |
|---------|------------|-------------|
| Effective Date | FR-008 | Date when content was last updated |
| Data Collected | FR-004 | GitHub profile, email address |
| Cookies Used | FR-004 | NextAuth session cookies |
| No Data Resale | FR-004 | Commitment not to sell user data |
| GDPR Rights | FR-004 | Right to request data deletion |

## Component Model

### New Components

| Component | Path | Type | Purpose |
|-----------|------|------|---------|
| Footer | `/components/layout/footer.tsx` | Client Component | Global footer with legal links, rendered on all pages |
| Terms of Service Page | `/app/legal/terms/page.tsx` | Server Component | Static ToS content page |
| Privacy Policy Page | `/app/legal/privacy/page.tsx` | Server Component | Static Privacy Policy content page |

### Modified Components

| Component | Path | Change |
|-----------|------|--------|
| Root Layout | `/app/layout.tsx` | Add `<Footer />` after `{children}` |
| Sign-In Page | `/app/auth/signin/page.tsx` | Add consent notice with legal links |

## State

No client-side state management changes. No TanStack Query hooks. No API calls. All content is static and server-rendered.

## Validation Rules

- Legal page URLs must be accessible without authentication (public routes)
- Footer must render on all pages regardless of auth state
- All content must be in English (FR-007)
- Effective date must be visible on each legal page (FR-008)
