# Data Model: Delete Account Flow

## Entities Involved

No new database entities are required. This feature operates on existing entities via cascade deletion.

### User (primary entity — deleted)

All fields deleted. Cascade triggers deletion of all related records.

### Cascade Chain

```
User DELETE →
  ├── Account (OAuth providers)
  ├── Project →
  │     ├── Ticket →
  │     │     ├── Comment
  │     │     ├── Job
  │     │     └── Comparison
  │     ├── ProjectMember
  │     ├── HealthScan
  │     └── HealthScore
  ├── Session (auth sessions)
  ├── Comment (direct user comments)
  ├── Notification (as recipient)
  ├── Notification (as actor)
  ├── PersonalAccessToken
  ├── PushSubscription
  ├── Subscription (Stripe billing record)
  └── UserCredential (AI provider keys)
```

### External Side Effects

| System | Action | Failure Handling |
|--------|--------|-----------------|
| Stripe | Cancel subscription via API | Log error, proceed with deletion |
| GitHub OAuth | Token revocation | Not needed — OAuth tokens expire naturally |

## State Transitions

```
Profile Page → Click "Delete my account"
  → Modal OPEN (fetch data counts)
    → Email mismatch → Button DISABLED
    → Email match → Button ENABLED
      → Click "Delete permanently" → Button DISABLED (loading)
        → API DELETE /api/account
          → Success → signOut → Redirect to "/"
          → Auth Error → Redirect to sign-in
          → Server Error → Show error toast, re-enable button
    → Click "Cancel" → Modal CLOSED (reset input)
```

## Validation Rules

- Email confirmation input must exactly match the authenticated user's email (case-insensitive comparison on client)
- Only the authenticated user can delete their own account (enforced by session)
- No admin/owner role check needed — any user can delete themselves
