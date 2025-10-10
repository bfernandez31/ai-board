import { test, expect } from '@playwright/test'

/**
 * E2E Tests for WebSocket Project Subscription
 *
 * These tests verify:
 * - Client sends 'subscribe' message → receives 'subscribed' acknowledgment
 * - Client sends 'unsubscribe' → receives 'unsubscribed' acknowledgment
 * - Invalid projectId returns error message
 *
 * Expected: FAIL (no subscription logic implementation yet)
 */

test.describe('WebSocket Subscription', () => {
  test('should subscribe to project updates and receive acknowledgment', async ({ page }) => {
    await page.goto('http://localhost:3000/projects/1/board')

    // Wait for WebSocket connection
    const ws = await page.waitForEvent('websocket', { timeout: 5000 })

    // Wait for 'connected' message
    await ws.waitForEvent('framereceived', {
      predicate: (frame) => {
        try {
          return JSON.parse(frame.payload.toString()).type === 'connected'
        } catch {
          return false
        }
      },
    })

    // Send subscribe message
    await page.evaluate(() => {
      const ws = (window as any).__ws // Assuming WebSocket instance is exposed for testing
      ws.send(JSON.stringify({
        type: 'subscribe',
        projectId: 1,
      }))
    })

    // Wait for 'subscribed' acknowledgment
    const subscribedMessage = await ws.waitForEvent('framereceived', {
      predicate: (frame) => {
        try {
          return JSON.parse(frame.payload.toString()).type === 'subscribed'
        } catch {
          return false
        }
      },
      timeout: 3000,
    })

    const message = JSON.parse(subscribedMessage.payload.toString())

    // Verify message structure
    expect(message.type).toBe('subscribed')
    expect(message.projectId).toBe(1)
    expect(message.timestamp).toBeTruthy()
    expect(new Date(message.timestamp).getTime()).toBeGreaterThan(0)
  })

  test('should unsubscribe from project updates and receive acknowledgment', async ({ page }) => {
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

    // Subscribe first
    await page.evaluate(() => {
      const ws = (window as any).__ws
      ws.send(JSON.stringify({
        type: 'subscribe',
        projectId: 1,
      }))
    })

    // Wait for subscribed acknowledgment
    await ws.waitForEvent('framereceived', {
      predicate: (frame) => {
        try {
          return JSON.parse(frame.payload.toString()).type === 'subscribed'
        } catch {
          return false
        }
      },
    })

    // Now unsubscribe
    await page.evaluate(() => {
      const ws = (window as any).__ws
      ws.send(JSON.stringify({
        type: 'unsubscribe',
        projectId: 1,
      }))
    })

    // Wait for 'unsubscribed' acknowledgment
    const unsubscribedMessage = await ws.waitForEvent('framereceived', {
      predicate: (frame) => {
        try {
          return JSON.parse(frame.payload.toString()).type === 'unsubscribed'
        } catch {
          return false
        }
      },
      timeout: 3000,
    })

    const message = JSON.parse(unsubscribedMessage.payload.toString())

    // Verify message structure
    expect(message.type).toBe('unsubscribed')
    expect(message.projectId).toBe(1)
    expect(message.timestamp).toBeTruthy()
  })

  test('should return error for invalid projectId', async ({ page }) => {
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

    // Subscribe to non-existent project
    await page.evaluate(() => {
      const ws = (window as any).__ws
      ws.send(JSON.stringify({
        type: 'subscribe',
        projectId: 99999, // Non-existent project
      }))
    })

    // Wait for error message
    const errorMessage = await ws.waitForEvent('framereceived', {
      predicate: (frame) => {
        try {
          return JSON.parse(frame.payload.toString()).type === 'error'
        } catch {
          return false
        }
      },
      timeout: 3000,
    })

    const message = JSON.parse(errorMessage.payload.toString())

    // Verify error message structure
    expect(message.type).toBe('error')
    expect(message.code).toBe('INVALID_PROJECT')
    expect(message.message).toContain('Project not found')
    expect(message.timestamp).toBeTruthy()
  })

  test('should handle subscribe to multiple projects', async ({ page }) => {
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

    // Subscribe to project 1
    await page.evaluate(() => {
      const ws = (window as any).__ws
      ws.send(JSON.stringify({
        type: 'subscribe',
        projectId: 1,
      }))
    })

    // Wait for first subscription
    const sub1 = await ws.waitForEvent('framereceived', {
      predicate: (frame) => {
        try {
          const data = JSON.parse(frame.payload.toString())
          return data.type === 'subscribed' && data.projectId === 1
        } catch {
          return false
        }
      },
    })
    expect(JSON.parse(sub1.payload.toString()).projectId).toBe(1)

    // Subscribe to project 2
    await page.evaluate(() => {
      const ws = (window as any).__ws
      ws.send(JSON.stringify({
        type: 'subscribe',
        projectId: 2,
      }))
    })

    // Wait for second subscription
    const sub2 = await ws.waitForEvent('framereceived', {
      predicate: (frame) => {
        try {
          const data = JSON.parse(frame.payload.toString())
          return data.type === 'subscribed' && data.projectId === 2
        } catch {
          return false
        }
      },
    })
    expect(JSON.parse(sub2.payload.toString()).projectId).toBe(2)
  })

  test('should reject malformed subscribe message', async ({ page }) => {
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

    // Send malformed message (missing projectId)
    await page.evaluate(() => {
      const ws = (window as any).__ws
      ws.send(JSON.stringify({
        type: 'subscribe',
        // Missing projectId field
      }))
    })

    // Wait for error message
    const errorMessage = await ws.waitForEvent('framereceived', {
      predicate: (frame) => {
        try {
          return JSON.parse(frame.payload.toString()).type === 'error'
        } catch {
          return false
        }
      },
      timeout: 3000,
    })

    const message = JSON.parse(errorMessage.payload.toString())

    expect(message.type).toBe('error')
    expect(message.code).toBe('INVALID_MESSAGE')
    expect(message.message).toBeTruthy()
  })
})
