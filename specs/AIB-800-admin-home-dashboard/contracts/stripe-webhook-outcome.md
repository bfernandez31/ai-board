# Contract — Stripe webhook outcome capture

This is **not a new HTTP endpoint**. It documents the augmented behavior of the existing `POST /api/webhooks/stripe` route (`app/api/webhooks/stripe/route.ts`) — specifically the `WebhookOutcome` row each delivery now produces.

## Augmented behavior

The route's existing contract with Stripe is unchanged (same signature verification, same idempotency claim on `StripeEvent.id`, same 200/400/500 response codes). The augmentation is internal: the route now writes one row to `WebhookOutcome` per delivery, immediately after the existing idempotency claim succeeds.

## Ordering guarantees

1. Signature verification — unchanged. Failure: 400, no row written.
2. Idempotency claim via `createStripeEvent(event.id, event.type)` — unchanged. Failure (P2002 duplicate): 200 `{ received: true, skipped: 'duplicate' }`, no `WebhookOutcome` row written (duplicate redeliveries do NOT inflate the failure count — see data-model R-2 / WebhookOutcome notes).
3. **NEW**: enter handler `switch`.
4. **NEW**: if handler completes without throwing → `recordWebhookOutcome(event.id, event.type, 'SUCCESS')`. Response: 200 `{ received: true }`.
5. **NEW**: if handler throws → in the existing catch block, before returning 500, call `recordWebhookOutcome(event.id, event.type, 'FAILURE', String(error).slice(0, 1000))`. Response: 500 `{ error: 'Webhook handler failed' }` (unchanged).

## Error behavior of the recording itself

If `recordWebhookOutcome` itself throws (DB unavailable, etc.):
- It MUST NOT be allowed to propagate.
- It MUST be caught locally and logged via `console.error('Failed to record webhook outcome', ...)`.
- The original handler's status (200 for success, 500 for handler failure) MUST remain unchanged.
- Spec rationale: "a processing failure during outcome capture itself falls back to a log so the operator can still investigate."

## Row written

Per the data-model:

```ts
{
  provider: 'stripe',
  eventId: event.id,
  eventType: event.type,
  status: 'SUCCESS' | 'FAILURE',
  errorMessage: status === 'FAILURE' ? truncatedErrorMessage : null,
  receivedAt: now() // default by Prisma
}
```

## Test contract

Integration tests MUST cover:

- **Successful delivery**: stubbed handler returns normally → response 200, exactly one `WebhookOutcome` row with `status === 'SUCCESS'`.
- **Failing handler**: handler throws → response 500, exactly one `WebhookOutcome` row with `status === 'FAILURE'` and `errorMessage` populated.
- **Duplicate redelivery**: second call with the same `event.id` is short-circuited at the idempotency claim → response 200, **no** new `WebhookOutcome` row (the duplicate did NOT reach the handler).
- **Recording failure**: when `recordWebhookOutcome` itself throws, the response code is unchanged (200 or 500 per the handler outcome), and a `console.error` log is emitted. No exception escapes the route.
