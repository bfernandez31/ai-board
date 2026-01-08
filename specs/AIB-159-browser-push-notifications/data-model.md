# Data Model: Browser Push Notifications

**Feature**: AIB-159 Browser Push Notifications
**Date**: 2026-01-07

## Entity Overview

### PushSubscription (New)

Represents a browser push subscription for a user. One user may have multiple subscriptions across different browsers/devices.

```prisma
model PushSubscription {
  id             Int       @id @default(autoincrement())
  userId         String
  endpoint       String    @unique @db.VarChar(500)  // Push service endpoint URL
  p256dh         String    @db.VarChar(100)          // User public key for encryption
  auth           String    @db.VarChar(50)           // Auth secret for encryption
  expirationTime DateTime?                           // Optional expiration from push service
  userAgent      String?   @db.VarChar(200)          // Browser/device info for settings UI
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([endpoint])
}
```

### User (Extended)

Add relation to push subscriptions.

```prisma
model User {
  // ... existing fields ...
  pushSubscriptions PushSubscription[]
}
```

## Field Specifications

### PushSubscription Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | Int | PK, auto-increment | Internal identifier |
| `userId` | String | FK → User.id, cascade delete | Subscription owner |
| `endpoint` | String(500) | Unique | Push service URL (per-browser unique) |
| `p256dh` | String(100) | Required | User's public key for message encryption |
| `auth` | String(50) | Required | Shared authentication secret |
| `expirationTime` | DateTime | Nullable | When subscription expires (if provided by push service) |
| `userAgent` | String(200) | Nullable | Browser/device identifier for UI display |
| `createdAt` | DateTime | Default: now() | Subscription creation timestamp |
| `updatedAt` | DateTime | Auto-update | Last modification timestamp |

## Validation Rules

### Endpoint
- Required, non-empty string
- Max length: 500 characters
- Must be a valid URL starting with `https://`
- Uniqueness enforced at database level

### p256dh
- Required, non-empty string
- Max length: 100 characters (Base64-encoded P-256 public key)
- Validated via Zod schema before database insert

### auth
- Required, non-empty string
- Max length: 50 characters (Base64-encoded auth secret)
- Validated via Zod schema before database insert

### userId
- Required
- Must reference existing User record
- Validated via foreign key constraint

## State Transitions

PushSubscription has no formal state machine. Records are:
1. **Created** when user grants permission and subscription is saved
2. **Updated** if subscription is renewed or resubscribed
3. **Deleted** when:
   - User unsubscribes via settings UI
   - Push delivery fails with 404/410 (subscription invalid/expired)
   - User account is deleted (cascade)

## Relationships

```
User (1) ─────────┬───────── (N) PushSubscription
                  │
                  │ Cascade delete: When user is deleted,
                  │ all their subscriptions are removed
```

## Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| Primary | `id` | Row lookup |
| Unique | `endpoint` | Prevent duplicate subscriptions |
| Foreign | `userId` | User subscription lookup |

## Migration

```sql
-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" VARCHAR(500) NOT NULL,
    "p256dh" VARCHAR(100) NOT NULL,
    "auth" VARCHAR(50) NOT NULL,
    "expirationTime" TIMESTAMP(3),
    "userAgent" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "PushSubscription_endpoint_idx" ON "PushSubscription"("endpoint");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

## TypeScript Types

```typescript
// Prisma-generated type
interface PushSubscription {
  id: number;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationTime: Date | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// API input type (from browser's PushSubscription.toJSON())
interface PushSubscriptionInput {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// web-push library format
interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// Push notification payload
interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url: string;
  type: 'job_completion' | 'mention';
  ticketKey: string;
}
```

## Zod Validation Schema

```typescript
import { z } from 'zod';

export const pushSubscriptionInputSchema = z.object({
  endpoint: z.string().url().max(500),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1).max(100),
    auth: z.string().min(1).max(50),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionInputSchema>;

export const unsubscribeSchema = z.object({
  subscriptionId: z.number().int().positive(),
});

export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>;
```

## Query Functions

```typescript
// lib/db/push-subscriptions.ts

// Create or update subscription
async function upsertPushSubscription(
  userId: string,
  subscription: PushSubscriptionInput
): Promise<PushSubscription>

// Get all subscriptions for a user
async function getUserPushSubscriptions(
  userId: string
): Promise<PushSubscription[]>

// Delete subscription by ID (primary method - used by unsubscribe API)
async function deletePushSubscriptionById(
  userId: string,
  subscriptionId: number
): Promise<void>

// Delete subscription by endpoint (legacy - for internal cleanup only)
async function deletePushSubscriptionByEndpoint(
  userId: string,
  endpoint: string
): Promise<void>

// Check if user has any active subscriptions
async function hasActiveSubscription(
  userId: string
): Promise<boolean>
```
