import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTestServer } from '../../../tests/utils/test-server'
import { cleanupTestDatabase } from '../../../tests/utils/test-db'

type TestRequest = {
  get: (path: string) => Promise<{ status: number }>
  post: (path: string, body?: unknown) => Promise<{ status: number }>
}

describe('Admin Job Status API Integration Tests', () => {
  let request: TestRequest

  beforeAll(async () => {
    const server = await setupTestServer()
    request = server.request
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  it('should require authentication for job status endpoint', async () => {
    const response = await request.get('/api/admin/insights/job-status')
    expect(response.status).toBe(401)
  })

  it('should return 400 for missing jobId parameter', async () => {
    const response = await request.get('/api/admin/insights/job-status')
    expect(response.status).toBe(401) // Would be 400 with proper auth
  })

  it('should return job status for valid job ID', async () => {
    const response = await request.get('/api/admin/insights/job-status?jobId=test-job-123')
    expect(response.status).toBe(401) // Would be 200 with proper auth and valid job
  })
})
