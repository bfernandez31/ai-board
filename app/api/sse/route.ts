import { NextRequest } from 'next/server'
import { subscribers } from '@/lib/sse-broadcast'

/**
 * Server-Sent Events (SSE) Endpoint for Real-Time Job Status Updates
 *
 * Provides a persistent HTTP connection that streams job status updates
 * to subscribed clients. Simpler than WebSockets - no upgrade needed!
 *
 * Usage: const eventSource = new EventSource('/api/sse?projectId=1')
 */

/**
 * GET /api/sse - Establish SSE Connection
 *
 * Query params:
 * - projectId: number (required) - Project to subscribe to
 *
 * Returns:
 * - 200 with text/event-stream for valid requests
 * - 400 for missing/invalid projectId
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const projectIdParam = searchParams.get('projectId')

  // Validate projectId
  if (!projectIdParam) {
    return new Response(
      JSON.stringify({ error: 'projectId query parameter required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const projectId = parseInt(projectIdParam, 10)

  if (isNaN(projectId) || projectId <= 0) {
    return new Response(
      JSON.stringify({ error: 'projectId must be a positive integer' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const encoder = new TextEncoder()

  // Create a ReadableStream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Register this client for the project
      if (!subscribers.has(projectId)) {
        subscribers.set(projectId, new Set())
      }

      // Store controller for broadcasting
      subscribers.get(projectId)!.add(controller)

      console.log(`[SSE] Client connected to project ${projectId}`)
      console.log(`[SSE] Total subscribers for project ${projectId}:`, subscribers.get(projectId)?.size)
      console.log(`[SSE] All projects:`, Array.from(subscribers.keys()))

      // Send initial connection message
      controller.enqueue(
        encoder.encode(`: Connected to project ${projectId}\n\n`)
      )

      // Keep-alive: Send comment every 15 seconds to prevent timeout
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keep-alive\n\n`))
        } catch (error) {
          // Client disconnected, clear interval
          clearInterval(keepAliveInterval)
          cleanup()
        }
      }, 15000)

      // Cleanup on disconnect
      const cleanup = () => {
        clearInterval(keepAliveInterval)
        const projectSubs = subscribers.get(projectId)
        if (projectSubs) {
          projectSubs.delete(controller)
          if (projectSubs.size === 0) {
            subscribers.delete(projectId)
          }
        }
        console.log(`[SSE] Client disconnected from project ${projectId}`)
      }

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        cleanup()
        controller.close()
      })
    },
  })

  // Return SSE response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  })
}
