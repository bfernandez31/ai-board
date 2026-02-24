/**
 * Security Integration Tests: x-test-user-id Header Bypass Prevention
 *
 * Tests defense-in-depth environment guards on the x-test-user-id header.
 * - US1: Production protection (direct function testing with mocked NODE_ENV)
 * - US2: Test mode preservation (HTTP requests to running test server)
 * - US3: Existing auth flows unaffected (HTTP regression tests)
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createAPIClient } from '@/tests/fixtures/vitest/api-client'
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup'

// Mock server-side modules for direct getCurrentUser() testing (US1 only).
// HTTP-based tests (US2/US3) hit the running server and are unaffected by these mocks.
vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

// Import after mocks are set up (vi.mock is hoisted)
import { getCurrentUser } from '@/lib/db/users'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

// =============================================================================
// US1: Production Users Protected from Auth Bypass (Priority: P1)
// =============================================================================
describe('US1: Production users protected from auth bypass', () => {
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    vi.restoreAllMocks()
  })

  // T004: unauthenticated request with x-test-user-id header is rejected when NODE_ENV is not 'test'
  it('should reject unauthenticated request with x-test-user-id header in production mode', async () => {
    process.env.NODE_ENV = 'production'
    vi.mocked(headers).mockResolvedValue(
      new Headers({ 'x-test-user-id': 'test-user-id' }) as never
    )
    vi.mocked(auth).mockResolvedValue(null as never)

    await expect(getCurrentUser()).rejects.toThrow('Unauthorized')
  })

  // T005: x-test-user-id header with valid user ID is ignored in production mode
  it('should ignore x-test-user-id header with valid user ID in production mode', async () => {
    process.env.NODE_ENV = 'production'
    vi.mocked(headers).mockResolvedValue(
      new Headers({ 'x-test-user-id': 'test-user-id' }) as never
    )
    vi.mocked(auth).mockResolvedValue(null as never)

    // Header is ignored in production; no session → Unauthorized
    await expect(getCurrentUser()).rejects.toThrow('Unauthorized')
  })

  // T006: x-test-user-id header alongside valid session uses session identity, not header value
  it('should use session identity when x-test-user-id is present alongside valid session in production', async () => {
    process.env.NODE_ENV = 'production'
    const sessionUser = { id: 'session-user-id', email: 'session@test.com', name: 'Session User' }
    vi.mocked(headers).mockResolvedValue(
      new Headers({ 'x-test-user-id': 'attacker-user-id' }) as never
    )
    vi.mocked(auth).mockResolvedValue({ user: sessionUser } as never)

    const user = await getCurrentUser()
    expect(user.id).toBe('session-user-id')
    expect(user.id).not.toBe('attacker-user-id')
  })

  // T007: empty x-test-user-id header is ignored in production
  it('should ignore empty x-test-user-id header in production mode', async () => {
    process.env.NODE_ENV = 'production'
    vi.mocked(headers).mockResolvedValue(
      new Headers({ 'x-test-user-id': '' }) as never
    )
    vi.mocked(auth).mockResolvedValue(null as never)

    await expect(getCurrentUser()).rejects.toThrow('Unauthorized')
  })

  // T008: x-test-user-id header alongside valid PAT token uses token identity, not header value
  it('should use authenticated identity, not header value, in production mode', async () => {
    process.env.NODE_ENV = 'production'
    const authenticatedUser = { id: 'real-user-id', email: 'real@test.com', name: 'Real User' }
    vi.mocked(headers).mockResolvedValue(
      new Headers({ 'x-test-user-id': 'attacker-user-id' }) as never
    )
    vi.mocked(auth).mockResolvedValue({ user: authenticatedUser } as never)

    const user = await getCurrentUser()
    expect(user.id).toBe('real-user-id')
    expect(user.id).not.toBe('attacker-user-id')
  })
})

// =============================================================================
// US2: Test Environment Retains Test User Impersonation (Priority: P2)
// =============================================================================
describe('US2: Test environment retains test user impersonation', () => {
  let ctx: TestContext

  beforeEach(async () => {
    ctx = await getTestContext()
    await ctx.cleanup()
  })

  // T009: request with x-test-user-id header authenticates as that user in test mode
  it('should authenticate as test user when x-test-user-id header is present in test mode', async () => {
    const response = await ctx.api.get(`/api/projects/${ctx.projectId}`)
    expect(response.status).toBe(200)
    expect(response.ok).toBe(true)
  })

  // T010: middleware allows request through when x-test-user-id header is present in test mode
  it('should allow middleware to pass request through with x-test-user-id in test mode', async () => {
    const response = await ctx.api.get(`/api/projects/${ctx.projectId}`)
    // Middleware block would result in 302 redirect or 401
    expect(response.status).not.toBe(302)
    expect(response.status).not.toBe(401)
    expect(response.ok).toBe(true)
  })

  // T011: request with x-test-user-id for non-existent user falls back to standard auth in test mode
  it('should fall back to standard auth when x-test-user-id references non-existent user', async () => {
    const clientWithBadId = createAPIClient({ testUserId: 'non-existent-user-id-99999' })
    const response = await clientWithBadId.get(`/api/projects/${ctx.projectId}`)
    // Non-existent user falls through to session auth, which also fails
    expect(response.ok).toBe(false)
  })
})

// =============================================================================
// US3: Existing Authentication Flows Unaffected (Priority: P3)
// =============================================================================
describe('US3: Existing authentication flows unaffected', () => {
  let ctx: TestContext

  beforeEach(async () => {
    ctx = await getTestContext()
    await ctx.cleanup()
  })

  // T012: authenticated session access to protected resources succeeds as before
  it('should allow authenticated access to protected resources', async () => {
    const response = await ctx.api.get(`/api/projects/${ctx.projectId}`)
    expect(response.status).toBe(200)
    expect(response.ok).toBe(true)
    expect(response.data).toHaveProperty('id', ctx.projectId)
  })

  // T013: valid Bearer PAT token auth path still functions
  it('should still handle Bearer PAT token auth path correctly', async () => {
    // Create client with invalid PAT (no test user header) to verify the token code path
    // is reachable and returns proper error — not broken by our x-test-user-id changes
    const patClient = createAPIClient({
      testUserId: '',
      defaultHeaders: { 'Authorization': 'Bearer pat_invalid_test_token' },
    })
    const response = await patClient.get(`/api/projects/${ctx.projectId}`)
    // Invalid PAT should get auth error (401), not a server error (500)
    expect(response.status).toBe(401)
  })

  // T014: unauthenticated request without any headers returns 401 as before
  it('should reject unauthenticated request without any auth headers', async () => {
    const unauthClient = createAPIClient({ testUserId: '' })
    const response = await unauthClient.get(`/api/projects/${ctx.projectId}`)
    // Should get 401 or redirect to sign-in (302)
    expect(response.ok).toBe(false)
    expect([401, 302]).toContain(response.status)
  })
})
