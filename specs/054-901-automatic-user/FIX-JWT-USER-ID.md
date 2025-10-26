# Fix: JWT User ID Synchronization

**Issue**: After reconnection, users lost access to their projects because the JWT token contained an outdated user ID.

## Problem Explanation

### Original Flow (BROKEN)
```typescript
// signIn callback
await createOrUpdateUser(profile, account); // Returns { id: "database-123" }
// ❌ But user.id still contains old GitHub ID
return true;

// jwt callback
if (user) {
  token.userId = user.id; // ❌ Uses old GitHub ID, not database ID!
}
```

**Result**: JWT contains `userId: "github-old-id"` but database has `userId: "database-123"`

### Why This Happened

1. **First sign-in**:
   - `createOrUpdateUser` creates user with `id: String(profile.id)` (GitHub ID)
   - NextAuth's `user` object gets this ID
   - JWT stores it correctly

2. **Sign out / Sign in again**:
   - `createOrUpdateUser` finds existing user by EMAIL
   - Returns EXISTING database ID (may be different if user changed GitHub ID)
   - NextAuth's `user` object still has OLD ID from OAuth provider
   - JWT stores WRONG ID

3. **User loses projects**:
   - Session has `userId: "old-id"`
   - Projects linked to `userId: "current-id"`
   - No match = no projects displayed!

## Solution Implemented

### Fixed Flow
```typescript
// signIn callback (app/lib/auth/nextauth-config.ts:28-44)
const { id: userId } = await createOrUpdateUser(profile, account);
console.log('User created/updated successfully', {
  email: profile.email,
  userId: userId, // ← Log the correct ID
  duration: `${duration}ms`,
});

// ✅ Override user.id with database ID
user.id = userId;
return true;

// jwt callback (app/lib/auth/nextauth-config.ts:60-67)
if (user?.id) {
  token.userId = user.id; // ✅ Now uses correct database ID!
}
```

## Flow Diagram

```
GitHub OAuth
    ↓
signIn callback
    ↓
createOrUpdateUser(profile, account)
    ↓
[TRANSACTION]
├─ User.upsert(where: { email })
│  ├─ CREATE: id = String(profile.id)
│  └─ UPDATE: name, image (id unchanged!)
│
├─ Account.upsert(where: { provider, providerAccountId })
│  ├─ CREATE: userId, tokens
│  └─ UPDATE: tokens only
│
└─ Return: { id: user.id } ← ALWAYS database ID
    ↓
user.id = userId ← Override NextAuth's user object
    ↓
jwt callback receives user.id = database ID
    ↓
token.userId = user.id ← JWT has correct ID
    ↓
session callback
    ↓
session.user.id = token.userId ← Session has correct ID
    ↓
User can access their projects! ✅
```

## Key Points

### ✅ What Changed
1. **Capture database ID**: `const { id: userId } = await createOrUpdateUser(...)`
2. **Override user.id**: `user.id = userId` (line 42)
3. **JWT gets correct ID**: `token.userId = user.id` (line 64)

### ✅ Why This Works
- `createOrUpdateUser` ALWAYS returns the database user ID
- Even if user changes GitHub ID, upsert finds by EMAIL
- Database ID is stable and matches all foreign keys
- JWT token gets refreshed with correct ID on every sign-in

### ❌ What NOT to Do
```typescript
// ❌ DON'T update User.id in database
update: {
  id: String(profile.id), // NEVER do this!
  name: profile.name,
}

// ❌ DON'T rely on NextAuth's user.id
token.userId = user.id; // Without setting it in signIn callback

// ❌ DON'T use GitHub ID for lookups
where: { id: String(profile.id) } // Use email instead!
```

## Testing

### Unit Test Coverage
```typescript
// tests/unit/auth/user-service.test.ts:287-322
it('returns the correct database user ID (not GitHub ID) for existing users', async () => {
  const mockProfile = { id: 99999, email: 'alice@github.com', ... };
  const mockUser = { id: 'database-user-id-12345' }; // Different from GitHub ID

  const result = await createOrUpdateUser(mockProfile, mockAccount);

  expect(result.id).toBe('database-user-id-12345'); // ✅ Database ID
  expect(result.id).not.toBe('99999'); // ✅ NOT GitHub ID
});
```

### Manual Test Scenario
1. Sign in with GitHub (first time)
2. Create a project
3. Sign out
4. **Change GitHub profile ID** (rare but possible)
5. Sign in again
6. ✅ User still sees their project (because database ID unchanged)

## Related Files

- `app/lib/auth/nextauth-config.ts:28-44` - signIn callback fix
- `app/lib/auth/nextauth-config.ts:60-67` - jwt callback (unchanged but now receives correct ID)
- `app/lib/auth/user-service.ts:40-93` - createOrUpdateUser implementation
- `tests/unit/auth/user-service.test.ts:287-322` - Test for ID consistency

## Migration Impact

**No database migration needed** ✅

- User IDs remain unchanged in database
- JWT refresh happens automatically on next sign-in
- All existing sessions will get correct ID after user signs in again

## Performance Impact

**Zero additional overhead** ✅

- No extra database queries
- No additional API calls
- Same transaction as before
- Just assigns returned ID to `user.id`
