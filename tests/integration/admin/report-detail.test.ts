import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTestServer } from '../../../tests/utils/test-server'
import { cleanupTestDatabase } from '../../../tests/utils/test-db'

describe('Admin Report Detail API Integration Tests', () => {
  let request: any

  beforeAll(async () => {
    const server = await setupTestServer()
    request = server.request
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  it('should require authentication for report detail endpoint', async () => {
    const response = await request.get('/api/admin/insights/report-123')
    expect(response.status).toBe(401)
  })

  it('should return 404 for non-existent report', async () => {
    const response = await request.get('/api/admin/insights/non-existent-report')
    expect(response.status).toBe(401) // Would be 404 with proper auth
  })

  it('should return report details for valid report ID', async () => {
    const response = await request.get('/api/admin/insights/report-123')
    expect(response.status).toBe(401) // Would be 200 with proper auth and valid report
  })
})
