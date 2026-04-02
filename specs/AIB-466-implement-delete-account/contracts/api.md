# API Contracts: Delete Account

## GET /api/account/summary

Returns counts of user data for the confirmation modal.

**Auth**: Session required

**Response 200**:
```json
{
  "projectCount": 5,
  "credentialCount": 2,
  "tokenCount": 3,
  "hasActiveSubscription": true,
  "plan": "PRO"
}
```

**Response 401**:
```json
{ "error": "Authentication required" }
```

---

## DELETE /api/account

Permanently deletes the authenticated user's account and all associated data.

**Auth**: Session required

**Request Body**: None (user identified by session)

**Response 200**:
```json
{ "message": "Account deleted successfully" }
```

**Response 401**:
```json
{ "error": "Authentication required" }
```

**Response 500**:
```json
{ "error": "Failed to delete account" }
```

### Processing Steps

1. Get authenticated user from session
2. Cancel Stripe subscription (if active) — log errors, don't block
3. Delete user record (Prisma cascades all related data)
4. Return success (client handles signOut + redirect)
