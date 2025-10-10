import { test, expect } from '@playwright/test'
import { cleanupDatabase } from '../helpers/db-cleanup'

/**
 * E2E Tests for WebSocket Job Status Broadcast
 *
 * These tests verify:
 * - Job status update triggers WebSocket broadcast to subscribed clients
 * - Multiple clients receive same update simultaneously
 * - Unsubscribed clients do not receive updates
 *
 * Expected: FAIL (no broadcast logic implementation yet)
 */

test.describe('WebSocket Job Status Broadcast', () => {
  test.beforeEach(async () => {
    await cleanupDatabase()
  })

  test('should broadcast job status update to subscribed clients', async ({ page, request }) => {
    // Create a test ticket with a job
    const ticketResponse = await request.post('http://localhost:3000/api/projects/1/tickets', {
      data: {
        title: '[e2e] Test Ticket for Job Broadcast',
        description: 'Testing job status updates',
        stage: 'INBOX',
      },
    })
    const ticket = await ticketResponse.json()

    // Create a job for the ticket
    const jobResponse = await request.post('http://localhost:3000/api/jobs', {
      data: {
        ticketId: ticket.id,
        command: 'specify',
        status: 'PENDING',
      },
    })
    const job = await jobResponse.json()

    // Open board page and establish WebSocket connection
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

    // Wait for subscription confirmation
    await ws.waitForEvent('framereceived', {
      predicate: (frame) => {
        try {
          return JSON.parse(frame.payload.toString()).type === 'subscribed'
        } catch {
          return false
        }
      },
    })

    // Trigger job status update via API
    const updatePromise = ws.waitForEvent('framereceived', {
      predicate: (frame) => {
        try {
          return JSON.parse(frame.payload.toString()).type === 'job-status-update'
        } catch {
          return false
        }
      },
      timeout: 5000,
    })

    await request.patch(`http://localhost:3000/api/jobs/${job.id}/status`, {
      data: {
        status: 'RUNNING',
      },
    })

    // Wait for broadcast message
    const broadcastMessage = await updatePromise
    const message = JSON.parse(broadcastMessage.payload.toString())

    // Verify message structure
    expect(message.type).toBe('job-status-update')
    expect(message.projectId).toBe(1)
    expect(message.ticketId).toBe(ticket.id)
    expect(message.jobId).toBe(job.id)
    expect(message.status).toBe('RUNNING')
    expect(message.command).toBe('specify')
    expect(message.timestamp).toBeTruthy()
  })

  test('should broadcast to multiple clients simultaneously', async ({ browser, request }) => {
    // Create test ticket and job
    const ticketResponse = await request.post('http://localhost:3000/api/projects/1/tickets', {
      data: {
        title: '[e2e] Multi-Client Broadcast Test',
        description: 'Testing simultaneous broadcast',
        stage: 'INBOX',
      },
    })
    const ticket = await ticketResponse.json()

    const jobResponse = await request.post('http://localhost:3000/api/jobs', {
      data: {
        ticketId: ticket.id,
        command: 'plan',
        status: 'PENDING',
      },
    })
    const job = await jobResponse.json()

    // Create 3 browser contexts (simulate 3 users)
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const context3 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()
    const page3 = await context3.newPage()

    // Navigate all to board and establish WebSocket connections
    await Promise.all([
      page1.goto('http://localhost:3000/projects/1/board'),
      page2.goto('http://localhost:3000/projects/1/board'),
      page3.goto('http://localhost:3000/projects/1/board'),
    ])

    const [ws1, ws2, ws3] = await Promise.all([
      page1.waitForEvent('websocket', { timeout: 5000 }),
      page2.waitForEvent('websocket', { timeout: 5000 }),
      page3.waitForEvent('websocket', { timeout: 5000 }),
    ])

    // Wait for all connections
    await Promise.all([
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

    // Subscribe all clients
    await Promise.all([
      page1.evaluate(() => {
        const ws = (window as any).__ws
        ws.send(JSON.stringify({ type: 'subscribe', projectId: 1 }))
      }),
      page2.evaluate(() => {
        const ws = (window as any).__ws
        ws.send(JSON.stringify({ type: 'subscribe', projectId: 1 }))
      }),
      page3.evaluate(() => {
        const ws = (window as any).__ws
        ws.send(JSON.stringify({ type: 'subscribe', projectId: 1 }))
      }),
    ])

    // Wait for all subscriptions
    await Promise.all([
      ws1.waitForEvent('framereceived', {
        predicate: (frame) => {
          try {
            return JSON.parse(frame.payload.toString()).type === 'subscribed'
          } catch {
            return false
          }
        },
      }),
      ws2.waitForEvent('framereceived', {
        predicate: (frame) => {
          try {
            return JSON.parse(frame.payload.toString()).type === 'subscribed'
          } catch {
            return false
          }
        },
      }),
      ws3.waitForEvent('framereceived', {
        predicate: (frame) => {
          try {
            return JSON.parse(frame.payload.toString()).type === 'subscribed'
          } catch {
            return false
          }
        },
      }),
    ])

    // Set up broadcast listeners
    const broadcasts = Promise.all([
      ws1.waitForEvent('framereceived', {
        predicate: (frame) => {
          try {
            return JSON.parse(frame.payload.toString()).type === 'job-status-update'
          } catch {
            return false
          }
        },
        timeout: 5000,
      }),
      ws2.waitForEvent('framereceived', {
        predicate: (frame) => {
          try {
            return JSON.parse(frame.payload.toString()).type === 'job-status-update'
          } catch {
            return false
          }
        },
        timeout: 5000,
      }),
      ws3.waitForEvent('framereceived', {
        predicate: (frame) => {
          try {
            return JSON.parse(frame.payload.toString()).type === 'job-status-update'
          } catch {
            return false
          }
        },
        timeout: 5000,
      }),
    ])

    // Trigger job status update
    await request.patch(`http://localhost:3000/api/jobs/${job.id}/status`, {
      data: {
        status: 'COMPLETED',
      },
    })

    // Wait for all broadcasts
    const messages = await broadcasts
    const parsedMessages = messages.map(msg => JSON.parse(msg.payload.toString()))

    // All clients should receive the same message
    expect(parsedMessages).toHaveLength(3)
    parsedMessages.forEach(msg => {
      expect(msg.type).toBe('job-status-update')
      expect(msg.jobId).toBe(job.id)
      expect(msg.status).toBe('COMPLETED')
    })

    // Cleanup
    await context1.close()
    await context2.close()
    await context3.close()
  })

  test('should NOT broadcast to unsubscribed clients', async ({ browser, request }) => {
    // Create test ticket and job
    const ticketResponse = await request.post('http://localhost:3000/api/projects/1/tickets', {
      data: {
        title: '[e2e] Unsubscribed Client Test',
        description: 'Testing no broadcast to unsubscribed',
        stage: 'INBOX',
      },
    })
    const ticket = await ticketResponse.json()

    const jobResponse = await request.post('http://localhost:3000/api/jobs', {
      data: {
        ticketId: ticket.id,
        command: 'build',
        status: 'PENDING',
      },
    })
    const job = await jobResponse.json()

    // Create 2 browser contexts
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    await Promise.all([
      page1.goto('http://localhost:3000/projects/1/board'),
      page2.goto('http://localhost:3000/projects/1/board'),
    ])

    const [ws1, ws2] = await Promise.all([
      page1.waitForEvent('websocket', { timeout: 5000 }),
      page2.waitForEvent('websocket', { timeout: 5000 }),
    ])

    // Wait for connections
    await Promise.all([
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
    ])

    // Only client 1 subscribes to project 1
    await page1.evaluate(() => {
      const ws = (window as any).__ws
      ws.send(JSON.stringify({ type: 'subscribe', projectId: 1 }))
    })

    await ws1.waitForEvent('framereceived', {
      predicate: (frame) => {
        try {
          return JSON.parse(frame.payload.toString()).type === 'subscribed'
        } catch {
          return false
        }
      },
    })

    // Client 2 does NOT subscribe

    // Set up listeners
    const ws1BroadcastPromise = ws1.waitForEvent('framereceived', {
      predicate: (frame) => {
        try {
          return JSON.parse(frame.payload.toString()).type === 'job-status-update'
        } catch {
          return false
        }
      },
      timeout: 5000,
    })

    let ws2ReceivedBroadcast = false
    ws2.on('framereceived', (frame) => {
      try {
        const data = JSON.parse(frame.payload.toString())
        if (data.type === 'job-status-update') {
          ws2ReceivedBroadcast = true
        }
      } catch {
        // Ignore
      }
    })

    // Trigger job status update
    await request.patch(`http://localhost:3000/api/jobs/${job.id}/status`, {
      data: {
        status: 'FAILED',
      },
    })

    // Client 1 should receive broadcast
    const ws1Message = await ws1BroadcastPromise
    const message = JSON.parse(ws1Message.payload.toString())
    expect(message.status).toBe('FAILED')

    // Wait a bit to ensure client 2 doesn't receive anything
    await page2.waitForTimeout(2000)

    // Client 2 should NOT have received broadcast
    expect(ws2ReceivedBroadcast).toBe(false)

    // Cleanup
    await context1.close()
    await context2.close()
  })
})
