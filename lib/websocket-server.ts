import { WebSocket } from 'ws'
import type { JobStatusUpdate, ServerMessage } from './websocket-schemas'
import { ServerMessageSchema } from './websocket-schemas'

/**
 * WebSocket Server Utilities
 *
 * Provides broadcast functionality for job status updates.
 * Manages client subscriptions and message routing.
 */

// Import from route handler (will be available after server starts)
// These are singletons shared across the application
let clientRegistry: Map<string, WebSocket> | null = null
let subscriptionRegistry: Map<string, Set<number>> | null = null

/**
 * Initialize Server Registries
 *
 * Called by the WebSocket route handler to share registries.
 * This allows broadcast functions to access client connections.
 */
export function initializeRegistries(
  clients: Map<string, WebSocket>,
  subscriptions: Map<string, Set<number>>
) {
  clientRegistry = clients
  subscriptionRegistry = subscriptions
}

/**
 * Broadcast Job Status Update
 *
 * Sends job status update to all clients subscribed to the project.
 * This is called by the job status API after database update succeeds.
 *
 * @param message - Job status update message
 * @returns Number of clients that received the broadcast
 */
export function broadcastJobStatusUpdate(message: JobStatusUpdate): number {
  if (!clientRegistry || !subscriptionRegistry) {
    console.warn('[WebSocket] Broadcast called before registries initialized')
    return 0
  }

  // Validate message schema
  const result = ServerMessageSchema.safeParse(message)
  if (!result.success) {
    console.error('[WebSocket] Invalid job status update message:', result.error)
    return 0
  }

  const { projectId } = message
  let broadcastCount = 0

  // Find all clients subscribed to this project
  for (const [clientId, projectSet] of subscriptionRegistry.entries()) {
    if (projectSet.has(projectId)) {
      const ws = clientRegistry.get(clientId)

      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(message))
          broadcastCount++
        } catch (error) {
          console.error(`[WebSocket] Failed to broadcast to client ${clientId}:`, error)
          // Client connection might be stale, will be cleaned up on next message
        }
      }
    }
  }

  console.log(
    `[WebSocket] Broadcasted job status update for project ${projectId} to ${broadcastCount} clients`
  )

  return broadcastCount
}

/**
 * Send Message to Specific Client
 *
 * Helper function to send a message to a specific client by ID.
 *
 * @param clientId - Client UUID
 * @param message - Server message to send
 * @returns true if sent successfully, false otherwise
 */
export function sendToClient(clientId: string, message: ServerMessage): boolean {
  if (!clientRegistry) {
    console.warn('[WebSocket] sendToClient called before registries initialized')
    return false
  }

  const ws = clientRegistry.get(clientId)

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return false
  }

  try {
    ws.send(JSON.stringify(message))
    return true
  } catch (error) {
    console.error(`[WebSocket] Failed to send to client ${clientId}:`, error)
    return false
  }
}

/**
 * Get Active Client Count
 *
 * Returns the number of currently connected clients.
 */
export function getActiveClientCount(): number {
  if (!clientRegistry) return 0

  let activeCount = 0
  for (const ws of clientRegistry.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      activeCount++
    }
  }

  return activeCount
}

/**
 * Get Clients Subscribed to Project
 *
 * Returns array of client IDs subscribed to a specific project.
 *
 * @param projectId - Project ID to check
 * @returns Array of client IDs
 */
export function getSubscribedClients(projectId: number): string[] {
  if (!subscriptionRegistry) return []

  const subscribedClients: string[] = []

  for (const [clientId, projectSet] of subscriptionRegistry.entries()) {
    if (projectSet.has(projectId)) {
      subscribedClients.push(clientId)
    }
  }

  return subscribedClients
}

/**
 * Broadcast to All Clients
 *
 * Sends a message to all connected clients regardless of subscription.
 * Used for system-wide notifications.
 *
 * @param message - Server message to broadcast
 * @returns Number of clients that received the broadcast
 */
export function broadcastToAll(message: ServerMessage): number {
  if (!clientRegistry) {
    console.warn('[WebSocket] broadcastToAll called before registries initialized')
    return 0
  }

  let broadcastCount = 0

  for (const ws of clientRegistry.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message))
        broadcastCount++
      } catch (error) {
        console.error('[WebSocket] Failed to broadcast to client:', error)
      }
    }
  }

  return broadcastCount
}

/**
 * Close All Connections
 *
 * Gracefully closes all WebSocket connections.
 * Used during server shutdown.
 */
export function closeAllConnections() {
  if (!clientRegistry) return

  for (const [clientId, ws] of clientRegistry.entries()) {
    try {
      ws.close(1000, 'Server shutting down')
      console.log(`[WebSocket] Closed connection for client ${clientId}`)
    } catch (error) {
      console.error(`[WebSocket] Error closing client ${clientId}:`, error)
    }
  }

  clientRegistry.clear()
  if (subscriptionRegistry) {
    subscriptionRegistry.clear()
  }
}
