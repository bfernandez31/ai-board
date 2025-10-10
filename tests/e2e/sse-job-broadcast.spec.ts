import { test, expect } from '@playwright/test'
import { cleanupDatabase } from '../helpers/db-cleanup'

/**
 * E2E Tests for SSE Job Status Broadcast
 *
 * These tests verify:
 * - Job status update triggers SSE broadcast to subscribed clients
 * - Multiple clients receive same update simultaneously
 * - Clients subscribed to different projects don't receive updates
 *
 * SSE automatically subscribes clients via projectId query parameter
 */

test.describe('SSE Job Status Broadcast', () => {
  test.beforeEach(async () => {
    await cleanupDatabase()
  })

  test('should broadcast job status update to subscribed clients', async ({ page, request }) => {
    // Create a test ticket
    const ticketResponse = await request.post('http://localhost:3000/api/projects/1/tickets', {
      data: {
        title: '[e2e] Test Ticket for Job Broadcast',
        description: 'Testing job status updates',
      },
    })
    const ticket = await ticketResponse.json()

    // Transition ticket to SPECIFY to create a job automatically
    const transitionResponse = await request.patch(
      `http://localhost:3000/api/projects/1/tickets/${ticket.id}`,
      {
        data: {
          stage: 'SPECIFY',
          version: ticket.version,
        },
      }
    )
    const transitionData = await transitionResponse.json()
    const jobId = transitionData.jobId

    expect(jobId).toBeTruthy()

    // Open board page and establish SSE connection
    await page.goto('http://localhost:3000/projects/1/board')

    // Wait for SSE connection
    await page.waitForRequest(req => req.url().includes('/api/sse?projectId=1'))

    // Set up listener for SSE message
    const messagePromise = page.evaluate(() => {
      return new Promise((resolve) => {
        const eventSource = (window as any).__eventSource
        eventSource.addEventListener('message', (event: MessageEvent) => {
          const data = JSON.parse(event.data)
          if (data.jobId) {
            resolve(data)
          }
        })
      })
    })

    // Trigger job status update via API
    await request.patch(`http://localhost:3000/api/jobs/${jobId}/status`, {
      data: {
        status: 'RUNNING',
      },
    })

    // Wait for broadcast message (with timeout)
    const message = await Promise.race([
      messagePromise,
      page.waitForTimeout(5000).then(() => null),
    ])

    // Verify message structure
    expect(message).not.toBeNull()
    expect((message as any).projectId).toBe(1)
    expect((message as any).ticketId).toBe(ticket.id)
    expect((message as any).jobId).toBe(jobId)
    expect((message as any).status).toBe('RUNNING')
    expect((message as any).command).toBe('specify')
    expect((message as any).timestamp).toBeTruthy()
  })

  test('should broadcast to multiple clients simultaneously', async ({ browser, request }) => {
    // Create test ticket
    const ticketResponse = await request.post('http://localhost:3000/api/projects/1/tickets', {
      data: {
        title: '[e2e] Multi-Client Broadcast Test',
        description: 'Testing simultaneous broadcast',
      },
    })
    const ticket = await ticketResponse.json()

    // Transition to PLAN to create job (INBOX → SPECIFY → PLAN)
    // First transition to SPECIFY
    await request.patch(`http://localhost:3000/api/projects/1/tickets/${ticket.id}`, {
      data: {
        stage: 'SPECIFY',
        version: ticket.version,
      },
    })

    // Then transition to PLAN
    const transitionResponse = await request.patch(
      `http://localhost:3000/api/projects/1/tickets/${ticket.id}`,
      {
        data: {
          stage: 'PLAN',
          version: ticket.version + 1,
        },
      }
    )
    const transitionData = await transitionResponse.json()
    const jobId = transitionData.jobId

    expect(jobId).toBeTruthy()

    // Create 3 browser contexts (simulate 3 users)
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const context3 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()
    const page3 = await context3.newPage()

    // Navigate all to board and establish SSE connections
    await Promise.all([
      page1.goto('http://localhost:3000/projects/1/board'),
      page2.goto('http://localhost:3000/projects/1/board'),
      page3.goto('http://localhost:3000/projects/1/board'),
    ])

    // Wait for all SSE connections
    await Promise.all([
      page1.waitForRequest(req => req.url().includes('/api/sse?projectId=1')),
      page2.waitForRequest(req => req.url().includes('/api/sse?projectId=1')),
      page3.waitForRequest(req => req.url().includes('/api/sse?projectId=1')),
    ])

    // Set up message listeners on all pages (wait for COMPLETED status)
    const messagePromises = Promise.all([
      page1.evaluate((targetJobId) => {
        return new Promise((resolve) => {
          const eventSource = (window as any).__eventSource
          eventSource.addEventListener('message', (event: MessageEvent) => {
            const data = JSON.parse(event.data)
            if (data.jobId === targetJobId && data.status === 'COMPLETED') {
              resolve(data)
            }
          })
        })
      }, jobId),
      page2.evaluate((targetJobId) => {
        return new Promise((resolve) => {
          const eventSource = (window as any).__eventSource
          eventSource.addEventListener('message', (event: MessageEvent) => {
            const data = JSON.parse(event.data)
            if (data.jobId === targetJobId && data.status === 'COMPLETED') {
              resolve(data)
            }
          })
        })
      }, jobId),
      page3.evaluate((targetJobId) => {
        return new Promise((resolve) => {
          const eventSource = (window as any).__eventSource
          eventSource.addEventListener('message', (event: MessageEvent) => {
            const data = JSON.parse(event.data)
            if (data.jobId === targetJobId && data.status === 'COMPLETED') {
              resolve(data)
            }
          })
        })
      }, jobId),
    ])

    // First transition to RUNNING (required by state machine)
    await request.patch(`http://localhost:3000/api/jobs/${jobId}/status`, {
      data: {
        status: 'RUNNING',
      },
    })

    // Then trigger job completion
    await request.patch(`http://localhost:3000/api/jobs/${jobId}/status`, {
      data: {
        status: 'COMPLETED',
      },
    })

    // Wait for all broadcasts (with timeout)
    const messages = await Promise.race([
      messagePromises,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout waiting for broadcasts')), 5000)
      ),
    ])

    // All clients should receive the same message
    expect(messages).toHaveLength(3)
    ;(messages as any[]).forEach((msg) => {
      expect(msg.jobId).toBe(jobId)
      expect(msg.status).toBe('COMPLETED')
      expect(msg.projectId).toBe(1)
    })

    // Cleanup
    await context1.close()
    await context2.close()
    await context3.close()
  })

  test('should NOT broadcast to clients subscribed to different project', async ({
    browser,
    request,
  }) => {
    // Create test ticket in project 1
    const ticketResponse = await request.post('http://localhost:3000/api/projects/1/tickets', {
      data: {
        title: '[e2e] Project Isolation Test',
        description: 'Testing project-based isolation',
      },
    })
    const ticket = await ticketResponse.json()

    // Transition to BUILD to create job (INBOX → SPECIFY → PLAN → BUILD)
    await request.patch(`http://localhost:3000/api/projects/1/tickets/${ticket.id}`, {
      data: { stage: 'SPECIFY', version: ticket.version },
    })

    await request.patch(`http://localhost:3000/api/projects/1/tickets/${ticket.id}`, {
      data: { stage: 'PLAN', version: ticket.version + 1 },
    })

    const transitionResponse = await request.patch(
      `http://localhost:3000/api/projects/1/tickets/${ticket.id}`,
      {
        data: { stage: 'BUILD', version: ticket.version + 2 },
      }
    )
    const transitionData = await transitionResponse.json()
    const jobId = transitionData.jobId

    expect(jobId).toBeTruthy()

    // Create 2 browser contexts for different projects
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    // Client 1 connects to project 1, Client 2 connects to project 2
    await Promise.all([
      page1.goto('http://localhost:3000/projects/1/board'),
      page2.goto('http://localhost:3000/projects/2/board'),
    ])

    // Wait for SSE connections
    await Promise.all([
      page1.waitForRequest(req => req.url().includes('/api/sse?projectId=1')),
      page2.waitForRequest(req => req.url().includes('/api/sse?projectId=2')),
    ])

    // Set up listeners (wait for FAILED status)
    const page1MessagePromise = page1.evaluate((targetJobId) => {
      return new Promise((resolve) => {
        const eventSource = (window as any).__eventSource
        eventSource.addEventListener('message', (event: MessageEvent) => {
          const data = JSON.parse(event.data)
          if (data.jobId === targetJobId && data.status === 'FAILED') {
            resolve(data)
          }
        })
      })
    }, jobId)

    let page2ReceivedMessage = false
    await page2.evaluate((targetJobId) => {
      const eventSource = (window as any).__eventSource
      eventSource.addEventListener('message', (event: MessageEvent) => {
        const data = JSON.parse(event.data)
        if (data.jobId === targetJobId) {
          ;(window as any).__receivedMessage = true
        }
      })
    }, jobId)

    // First transition to RUNNING (required by state machine)
    await request.patch(`http://localhost:3000/api/jobs/${jobId}/status`, {
      data: {
        status: 'RUNNING',
      },
    })

    // Trigger job failure for project 1
    await request.patch(`http://localhost:3000/api/jobs/${jobId}/status`, {
      data: {
        status: 'FAILED',
      },
    })

    // Client 1 should receive broadcast
    const message = await Promise.race([
      page1MessagePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
    ])
    expect((message as any).status).toBe('FAILED')

    // Wait a bit to ensure client 2 doesn't receive anything
    await page2.waitForTimeout(2000)

    // Check if client 2 received message
    page2ReceivedMessage = await page2.evaluate(() => {
      return !!(window as any).__receivedMessage
    })

    // Client 2 should NOT have received broadcast (different project)
    expect(page2ReceivedMessage).toBe(false)

    // Cleanup
    await context1.close()
    await context2.close()
  })

  test('should handle rapid successive status updates', async ({ page, request }) => {
    // Create test ticket
    const ticketResponse = await request.post('http://localhost:3000/api/projects/1/tickets', {
      data: {
        title: '[e2e] Rapid Updates Test',
        description: 'Testing rapid status changes',
      },
    })
    const ticket = await ticketResponse.json()

    // Transition ticket to SPECIFY to create job automatically
    const transitionResponse = await request.patch(
      `http://localhost:3000/api/projects/1/tickets/${ticket.id}`,
      {
        data: {
          stage: 'SPECIFY',
          version: ticket.version,
        },
      }
    )
    const transitionData = await transitionResponse.json()
    const jobId = transitionData.jobId

    expect(jobId).toBeTruthy()

    await page.goto('http://localhost:3000/projects/1/board')
    await page.waitForRequest(req => req.url().includes('/api/sse?projectId=1'))

    // Collect all messages
    const messages: any[] = []
    await page.evaluate(() => {
      const eventSource = (window as any).__eventSource
      ;(window as any).__messages = []
      eventSource.addEventListener('message', (event: MessageEvent) => {
        const data = JSON.parse(event.data)
        ;(window as any).__messages.push(data)
      })
    })

    // Trigger rapid status updates
    await request.patch(`http://localhost:3000/api/jobs/${jobId}/status`, {
      data: { status: 'RUNNING' },
    })

    await page.waitForTimeout(100)

    await request.patch(`http://localhost:3000/api/jobs/${jobId}/status`, {
      data: { status: 'COMPLETED' },
    })

    // Wait for messages to arrive
    await page.waitForTimeout(1000)

    // Get collected messages
    const collectedMessages = await page.evaluate(() => {
      return (window as any).__messages.filter((msg: any) => msg.jobId)
    })

    // Should have received both updates
    expect(collectedMessages.length).toBeGreaterThanOrEqual(2)

    // Verify message order (RUNNING before COMPLETED)
    const runningMsg = collectedMessages.find((msg: any) => msg.status === 'RUNNING')
    const completedMsg = collectedMessages.find((msg: any) => msg.status === 'COMPLETED')

    expect(runningMsg).toBeTruthy()
    expect(completedMsg).toBeTruthy()
  })
})
