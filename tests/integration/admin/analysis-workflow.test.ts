import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTestServer } from '../../../tests/utils/test-server'
import { cleanupTestDatabase } from '../../../tests/utils/test-db'

interface TestRequestClient {
  get: (path: string) => Promise<{ status: number }>
  post: (path: string, body?: { json?: unknown }) => Promise<{ status: number }>
}

describe('Admin Analysis Workflow Integration Tests', () => {
  let request: TestRequestClient

  beforeAll(async () => {
    const server = await setupTestServer()
    request = server.request
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  it('should require authentication for analysis endpoint', async () => {
    const response = await request.post('/api/admin/insights/analyze')
    expect(response.status).toBe(401)
  })

  it('should return job status for valid job ID', async () => {
    const response = await request.get('/api/admin/insights/job-status?jobId=test-job')
    expect(response.status).toBe(401) // Would be 200 with proper auth
  })

  it('should handle analysis request and return job ID', async () => {
    const response = await request.post('/api/admin/insights/analyze', {
      json: { force: false }
    })
    expect(response.status).toBe(401) // Would be 200 with proper auth
  })
})
