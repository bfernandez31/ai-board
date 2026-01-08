# Implementation Summary: Browser Push Notifications for Job Completion and Mentions

**Branch**: `AIB-159-browser-push-notifications` | **Date**: 2026-01-07
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented browser push notifications using Web Push API with VAPID authentication. Users can opt-in via floating prompt, receive notifications when jobs reach terminal states (COMPLETED/FAILED/CANCELLED) or when mentioned in comments. Includes settings UI in notification dropdown for managing subscriptions across devices.

## Key Decisions

- Used static service worker at `/public/sw.js` for Next.js App Router compatibility
- Stored push subscriptions in new PushSubscription model with cascade delete on User
- Integrated triggers as non-blocking side effects in existing job status and comment routes
- Added push settings to notification dropdown (collapsible section) for easy access

## Files Modified

**Created**: `app/lib/push/` (config, schema, send-notification), `app/components/push-notifications/` (opt-in, manager, listener, hook), `app/api/push/` (subscribe, unsubscribe, status routes), `public/sw.js`, `lib/db/push-subscriptions.ts`, `prisma/migrations/add_push_subscriptions`
**Modified**: `prisma/schema.prisma`, `app/layout.tsx`, `app/api/jobs/[id]/status/route.ts`, `app/api/.../comments/route.ts`, `app/components/notifications/notification-dropdown.tsx`

## Manual Requirements

Generate VAPID keys with `npx web-push generate-vapid-keys` and add to environment variables: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
