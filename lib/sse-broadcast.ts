import type { JobStatusUpdate } from './sse-schemas'

/**
 * SSE Broadcast Module
 *
 * Manages Server-Sent Events broadcast functionality.
 * Maintains subscriber registry and handles message fanout.
 */

// Global registry singleton: projectId → Set<ReadableStreamDefaultController>
// Use globalThis to ensure single instance across all Next.js contexts
const globalForSubscribers = globalThis as unknown as {
  sseSubscribers: Map<number, Set<any>> | undefined
}

export const subscribers = globalForSubscribers.sseSubscribers ?? new Map<number, Set<any>>()

if (!globalForSubscribers.sseSubscribers) {
  globalForSubscribers.sseSubscribers = subscribers
}

/**
 * Broadcast Job Status Update to All Subscribed Clients
 *
 * Called by the job status API when a job's status changes.
 * Sends the update to all clients subscribed to the job's project.
 *
 * @param message - Job status update to broadcast
 */
export async function broadcastJobStatusUpdate(message: JobStatusUpdate) {
  console.log(`[SSE Broadcast] Called with message:`, message)
  console.log(`[SSE Broadcast] Current subscribers:`, Array.from(subscribers.entries()).map(([pid, subs]) => ({ projectId: pid, count: subs.size })))

  const { projectId } = message
  const projectSubs = subscribers.get(projectId)

  if (!projectSubs || projectSubs.size === 0) {
    console.log(`[SSE Broadcast] No subscribers for project ${projectId}`)
    return
  }

  const encoder = new TextEncoder()
  const data = JSON.stringify(message)
  const sseMessage = `data: ${data}\n\n`
  const encoded = encoder.encode(sseMessage)

  let successCount = 0
  let failureCount = 0

  // Send to all subscribed clients
  for (const controller of projectSubs) {
    try {
      controller.enqueue(encoded)
      successCount++
    } catch (error) {
      // Client disconnected, will be cleaned up by keep-alive
      failureCount++
    }
  }

  console.log(
    `[SSE] Broadcasted job status update to ${successCount}/${successCount + failureCount} clients (project ${projectId})`
  )
}
