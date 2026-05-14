# Internal Process — Stripe webhook outcome capture

Spec section: `Internal Processes → Stripe webhook outcome capture`.

This is **not a workflow** in the GitHub Actions sense — it is an in-process side-effect on every Stripe webhook delivery. It is documented here because the spec lists it under "Internal Processes" alongside the cron-heartbeat workflow.

## Inputs

- The Stripe event already received by `POST /api/webhooks/stripe`:
  - `event.id` (the Stripe event id used for idempotency).
  - `event.type` (e.g., `invoice.payment_failed`).
  - The result of the in-process handler attempt.

No external callers, no separate endpoint.

## Phases

1. **Webhook received** — Stripe POSTs to `/api/webhooks/stripe`. The route verifies the signature and constructs the typed `Stripe.Event`.
2. **Idempotency claim** — `createStripeEvent(event.id, event.type)`. Unchanged from the AIB-796 baseline. Duplicates short-circuit here and do NOT progress to phase 3.
3. **Processing attempt** — the existing per-type handler runs (`handleCheckoutCompleted`, `handlePaymentSucceeded`, etc.).
4. **Outcome recording** —
   - **Success path**: after the handler returns, `recordWebhookOutcome(event.id, event.type, 'SUCCESS')` writes one `WebhookOutcome` row.
   - **Failure path**: in the route's existing `catch (error)` block, `recordWebhookOutcome(event.id, event.type, 'FAILURE', String(error).slice(0, 1000))` writes one row before the existing 500 response.
5. **Recording-of-the-recording failure** — if step 4 itself throws (e.g., DB transiently unavailable), the inner try/catch logs to `console.error` and swallows. The original 200/500 response to Stripe is preserved so Stripe's own retry behavior is unaffected.

## Output

- One row per *processed* delivery in `WebhookOutcome`. Duplicate redeliveries that were short-circuited at the idempotency claim produce **zero** rows.
- The row carries the eventual processing status (`SUCCESS` or `FAILURE`) and, when failing, a truncated error message useful for forensic triage.

## Error behavior

| Scenario | Response to Stripe | `WebhookOutcome` row | `StripeEvent` row |
|----------|--------------------|----------------------|--------------------|
| Invalid signature | 400 | none | none |
| Duplicate delivery (P2002 on `StripeEvent.id`) | 200 `skipped: 'duplicate'` | none | already exists |
| Handler succeeds | 200 `received: true` | 1 × `SUCCESS` | exists |
| Handler throws | 500 | 1 × `FAILURE` (with `errorMessage`) | exists |
| Handler succeeds, `WebhookOutcome` insert throws | 200 (preserved) | 0 (capture failure logged) | exists |
| Handler throws AND `WebhookOutcome` insert throws | 500 (preserved) | 0 (capture failure logged) | exists |

The last two cases are pathological (DB partially down) and accepted by the spec's fallback-to-log rule.

## Retention

`WebhookOutcome` rows are not auto-pruned by this feature. The alert window is 24 h; older rows are inert. A follow-up ticket may wire pruning into `nightly-log-prune.yml`. Until then, the table is expected to grow at the rate of inbound Stripe traffic (small).

## Constitution alignment

- **Database integrity (§V)**: the `StripeEvent` idempotency claim is preserved as the first DB write. `WebhookOutcome` is a second, independent insert; failing it never rolls back the claim. No transaction boundary is added (the existing handler is not transactional either).
- **Error handling**: outcome recording errors are logged with context (`provider`, `eventId`, `eventType`) but never propagate (matches the constitution's "log errors with context" guidance and the spec's explicit fallback rule). This is one of the few `console.error`-and-swallow patterns justified inline — the original error is what Stripe sees via the 500 response.
