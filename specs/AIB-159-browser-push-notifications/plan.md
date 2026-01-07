# Implementation Plan: Browser Push Notifications

**Branch**: `AIB-159-browser-push-notifications` | **Date**: 2026-01-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-159-browser-push-notifications/spec.md`

## Summary

Implement browser push notifications for job completion and @mentions, enabling project owners to receive alerts when jobs reach terminal states (COMPLETED, FAILED, CANCELLED) or when they are mentioned in comments—even when the browser tab is not active. Uses Web Push API with VAPID authentication, storing subscriptions server-side for reliable delivery.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), React 18, web-push ^3.6.x, TanStack Query v5
**Storage**: PostgreSQL 14+ via Prisma 6.x (new PushSubscription model)
**Testing**: Vitest (unit + integration), Playwright (E2E for service worker + notification flows)
**Target Platform**: Modern browsers (Chrome, Firefox, Safari 16.4+, Edge)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Push notifications delivered within 5 seconds of trigger event
**Constraints**: Service worker must work with Next.js App Router, push payloads limited to ~3KB
**Scale/Scope**: Project owners (one-to-few subscriptions per user across devices)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. TypeScript-First** | ✅ PASS | All code in strict TypeScript, explicit types for push subscription data |
| **II. Component-Driven** | ✅ PASS | Using shadcn/ui for opt-in prompt, feature folder structure (`components/push-notifications/`) |
| **III. Test-Driven** | ✅ PASS | Vitest unit tests for utilities, integration tests for API endpoints, Playwright for browser-required service worker flows |
| **IV. Security-First** | ✅ PASS | VAPID keys in env vars, Zod validation for subscription data, auth middleware on routes |
| **V. Database Integrity** | ✅ PASS | Prisma migration for PushSubscription model, cascade delete on user removal |
| **VI. Clarification Guardrails** | ✅ PASS | Auto-resolved decisions documented in spec with trade-offs |
| **VII. AI-First Model** | ✅ PASS | No human-oriented documentation, uses existing code patterns |

**Technology Compliance**:
- ✅ Using shadcn/ui exclusively for UI components (opt-in prompt)
- ✅ TanStack Query for subscription status management
- ✅ Prisma for database operations
- ✅ No forbidden dependencies added

## Project Structure

### Documentation (this feature)

```
specs/AIB-159-browser-push-notifications/
├── plan.md              # This file
├── research.md          # Phase 0: Web Push patterns, integration points
├── data-model.md        # Phase 1: PushSubscription entity design
├── quickstart.md        # Phase 1: Implementation entry points
├── contracts/           # Phase 1: API endpoint contracts
└── tasks.md             # Phase 2: Implementation tasks (created by /speckit.tasks)
```

### Source Code (repository root)

```
# Next.js App Router structure (existing project)
app/
├── api/
│   ├── push/
│   │   ├── subscribe/route.ts        # POST - Save subscription
│   │   ├── unsubscribe/route.ts      # POST - Remove subscription
│   │   └── status/route.ts           # GET - Check subscription status
│   └── jobs/[id]/status/route.ts     # PATCH - Extended to trigger push (existing)
├── components/
│   └── push-notifications/
│       ├── push-opt-in-prompt.tsx    # Floating opt-in UI
│       ├── push-notification-manager.tsx  # Registration logic
│       ├── notification-listener.tsx # Client message handler
│       └── use-push-notifications.ts # TanStack Query hooks
└── lib/
    └── push/
        ├── web-push-config.ts        # VAPID configuration
        ├── send-notification.ts      # Push delivery logic
        └── subscription-schema.ts    # Zod validation

lib/
└── db/
    └── push-subscriptions.ts         # Database query functions

prisma/
├── schema.prisma                     # Extended with PushSubscription model
└── migrations/                       # New migration for push_subscription table

public/
└── sw.js                             # Service worker for push events

tests/
├── unit/
│   └── push/
│       └── send-notification.test.ts # Unit tests for push utilities
├── integration/
│   └── push/
│       └── subscription.test.ts      # API endpoint tests
└── e2e/
    └── push-notifications.spec.ts    # Browser-required flow tests
```

**Structure Decision**: Following existing Next.js App Router conventions. New feature folder `push-notifications/` for UI components, `push/` for server-side logic. Service worker at `/public/sw.js` for Next.js static serving. Tests organized by Testing Trophy (unit → integration → E2E).

## Complexity Tracking

*No constitution violations. Implementation follows established patterns.*

| Aspect | Justification |
|--------|---------------|
| Service Worker | Required by Web Push API specification—no simpler alternative exists |
| web-push dependency | Standard library for Web Push protocol compliance (VAPID, encryption) |
| PushSubscription model | Minimal storage for subscription data per Web Push spec requirements |

## Post-Design Constitution Check

*Re-evaluated after Phase 1 design completion.*

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| **I. TypeScript-First** | ✅ PASS | Types defined in data-model.md: PushSubscription, PushSubscriptionInput, PushPayload, WebPushSubscription |
| **II. Component-Driven** | ✅ PASS | Feature folder `push-notifications/` with separate concerns: UI (prompt), logic (hooks), listeners |
| **III. Test-Driven** | ✅ PASS | Test strategy defined: unit tests for send logic, integration for API, E2E only for browser-required service worker |
| **IV. Security-First** | ✅ PASS | Zod schema for validation, env vars for secrets, auth middleware on all endpoints |
| **V. Database Integrity** | ✅ PASS | Prisma migration defined, cascade delete on User, unique constraint on endpoint |
| **VI. Clarification Guardrails** | ✅ PASS | All decisions documented with trade-offs in research.md |
| **VII. AI-First Model** | ✅ PASS | quickstart.md for AI implementation guidance, no human tutorials |

**Post-Design Additions**:
- ✅ `web-push` ^3.6.x added to dependencies (standard library, not forbidden)
- ✅ Service worker at `/public/sw.js` follows Next.js static file conventions
- ✅ API contracts defined in OpenAPI format

**No violations detected. Design approved for task generation.**
