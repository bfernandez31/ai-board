import { test, expect } from '@playwright/test'

/**
 * E2E Tests for WebSocket Connection Establishment
 *
 * These tests verify:
 * - HTTP upgrade to WebSocket succeeds (101 Switching Protocols)
 * - Server sends 'connected' message with clientId
 * - Invalid upgrade request returns 400
 *
 * Expected: FAIL (no WebSocket server implementation yet)
 */

test.describe('WebSocket Connection', () => {
  test('should establish WebSocket connection with HTTP upgrade', async ({ page }) => {
    // Navigate to board page which should establish WebSocket connection
    await page.goto('http://localhost:3000/projects/1/board')

    // Wait for WebSocket connection to be established
    const wsConnectionPromise = page.waitForEvent('websocket', { timeout: 5000 })
    const ws = await wsConnectionPromise

    // Verify WebSocket URL
    expect(ws.url()).toContain('/api/ws')

    // Wait for 'connected' message from server
    const connectedMessage = await ws.waitForEvent('framereceived', {
      predicate: (frame) => {
        try {
          const data = JSON.parse(frame.payload.toString())
          return data.type === 'connected'
        } catch {
          return false
        }
      },
      timeout: 3000,
    })

    const message = JSON.parse(connectedMessage.payload.toString())

    // Verify message structure
    expect(message.type).toBe('connected')
    expect(message.clientId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) // UUID format
    expect(message.timestamp).toBeTruthy()
    expect(new Date(message.timestamp).getTime()).toBeGreaterThan(0) // Valid ISO datetime
  })

  test('should reject invalid WebSocket upgrade request', async ({ request }) => {
    // Attempt to connect without proper WebSocket upgrade headers
    const response = await request.get('http://localhost:3000/api/ws', {
      headers: {
        'Connection': 'keep-alive', // Invalid: should be 'Upgrade'
      },
    })

    // Should return 400 Bad Request
    expect(response.status()).toBe(400)

    const body = await response.json()
    expect(body.error).toContain('WebSocket')
  })

  test('should handle multiple simultaneous connections', async ({ browser }) => {
    // Create 3 independent browser contexts
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const context3 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()
    const page3 = await context3.newPage()

    // Navigate all pages to board
    await Promise.all([
      page1.goto('http://localhost:3000/projects/1/board'),
      page2.goto('http://localhost:3000/projects/1/board'),
      page3.goto('http://localhost:3000/projects/1/board'),
    ])

    // Wait for WebSocket connections
    const [ws1, ws2, ws3] = await Promise.all([
      page1.waitForEvent('websocket', { timeout: 5000 }),
      page2.waitForEvent('websocket', { timeout: 5000 }),
      page3.waitForEvent('websocket', { timeout: 5000 }),
    ])

    // All should be connected
    expect(ws1.url()).toContain('/api/ws')
    expect(ws2.url()).toContain('/api/ws')
    expect(ws3.url()).toContain('/api/ws')

    // Wait for 'connected' messages
    const messages = await Promise.all([
      ws1.waitForEvent('framereceived', {
        predicate: (frame) => {
          try {
            return JSON.parse(frame.payload.toString()).type === 'connected'
          } catch {
            return false
          }
        },
      }),
      ws2.waitForEvent('framereceived', {
        predicate: (frame) => {
          try {
            return JSON.parse(frame.payload.toString()).type === 'connected'
          } catch {
            return false
          }
        },
      }),
      ws3.waitForEvent('framereceived', {
        predicate: (frame) => {
          try {
            return JSON.parse(frame.payload.toString()).type === 'connected'
          } catch {
            return false
          }
        },
      }),
    ])

    // Each should have unique clientId
    const clientIds = messages.map(msg => JSON.parse(msg.payload.toString()).clientId)
    expect(new Set(clientIds).size).toBe(3) // All unique

    // Cleanup
    await context1.close()
    await context2.close()
    await context3.close()
  })

  test('should close WebSocket connection when page is closed', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('http://localhost:3000/projects/1/board')
    const ws = await page.waitForEvent('websocket', { timeout: 5000 })

    // Wait for connection
    await ws.waitForEvent('framereceived', {
      predicate: (frame) => {
        try {
          return JSON.parse(frame.payload.toString()).type === 'connected'
        } catch {
          return false
        }
      },
    })

    // Listen for socket close
    const closePromise = ws.waitForEvent('close')

    // Close the page
    await page.close()

    // WebSocket should close
    await closePromise
    expect(ws.isClosed()).toBe(true)

    await context.close()
  })
})
