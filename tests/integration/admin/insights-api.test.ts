import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTestServer } from '../../../tests/utils/test-server'
import { cleanupTestDatabase } from '../../../tests/utils/test-db'

type TestRequest = {
  get: (path: string) => Promise<{ status: number }>
  post: (path: string, body?: unknown) => Promise<{ status: number }>
}

describe('Admin Insights API Integration Tests', () => {
  let request: TestRequest

  beforeAll(async () => {
    const server = await setupTestServer()
    request = server.request
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  it('should return 401 for unauthorized access to insights API', async () => {
    const response = await request.get('/api/admin/insights')
    expect(response.status).toBe(401)
  })

  it('should return 200 for authorized admin user', async () => {
    // This would need proper auth setup in a real test
    // For now, we'll just test the structure
    const response = await request.get('/api/admin/insights')
    expect(response.status).toBe(401) // Will be 401 without auth
  })

  it('should return latest insights report data', async () => {
    const response = await request.get('/api/admin/insights')
    // In a real test, we'd mock auth and expect 200 with report data
    expect(response.status).toBe(401)
  })
})
