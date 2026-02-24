# Quickstart: Fix Critical Auth Bypass

**Branch**: `AIB-226-fix-critical-auth`

## What This Fix Does

Adds environment verification to both authentication checkpoints so the `x-test-user-id` header is only honored in test mode (`NODE_ENV=test`). Production deployments will ignore this header entirely.

## Files to Modify

### 1. `proxy.ts` — Middleware Guard (Checkpoint 1)

**Current** (vulnerable — line 10-12):
```typescript
// Edge Runtime can't read process.env.NODE_ENV at runtime
if (req.headers.get('x-test-user-id') !== null) {
  return NextResponse.next()
}
```

**Target** (secured):
```typescript
// process.env.NODE_ENV is inlined at build time by Next.js, safe in Edge Runtime
if (process.env.NODE_ENV === 'test' && req.headers.get('x-test-user-id') !== null) {
  return NextResponse.next()
}
```

### 2. `lib/db/users.ts` — Server-Side Guard (Checkpoint 2)

**Current** (vulnerable — line 14-16):
```typescript
const testUserId = headersList.get('x-test-user-id')

if (testUserId) {
```

**Target** (secured):
```typescript
const testUserId = process.env.NODE_ENV === 'test'
  ? headersList.get('x-test-user-id')
  : null

if (testUserId) {
```

## Testing

### Verify the fix locally

```bash
# Run existing tests (should all pass — test mode still works)
bun run test:unit
bun run test:integration

# The new security integration tests will verify production behavior
bun run test:integration -- tests/integration/auth/test-header-bypass.test.ts
```

### Manual verification

```bash
# Start server in production mode
NODE_ENV=production bun run dev

# This should be rejected (returns 401 or redirect to sign-in)
curl -H "x-test-user-id: test-user-id" http://localhost:3000/api/projects

# Start server in test mode
TEST_MODE=true bun run dev

# This should succeed (returns project data)
curl -H "x-test-user-id: test-user-id" http://localhost:3000/api/projects
```

## Key Design Decisions

1. **`=== 'test'` not `!== 'production'`**: Fail-secure — unknown environments reject the header
2. **No config changes needed**: `process.env.NODE_ENV` is already inlined by Next.js in Edge Runtime
3. **No header stripping**: Both guards independently reject — stripping adds unnecessary complexity
4. **No test changes needed**: Test infra already runs with `NODE_ENV=test`
