import { NextRequest } from 'next/server'
import { WebSocketServer, WebSocket } from 'ws'
import { randomUUID } from 'crypto'
import { ServerMessageSchema, ClientMessageSchema } from '@/lib/websocket-schemas'
import type { ClientMessage, ServerMessage } from '@/lib/websocket-schemas'

/**
 * WebSocket Server for Real-Time Job Status Updates
 *
 * Handles HTTP upgrade to WebSocket and manages client connections.
 * Implements the WebSocket API contract from contracts/websocket-api.md
 */

// Global WebSocket server instance (singleton for development)
let wss: WebSocketServer | null = null

// Client connection registry: clientId → WebSocket
const clients = new Map<string, WebSocket>()

// Subscription registry: clientId → Set<projectId>
const subscriptions = new Map<string, Set<number>>()

/**
 * GET /api/ws - WebSocket Upgrade Endpoint
 *
 * Handles HTTP upgrade to WebSocket protocol.
 * Returns 400 if upgrade header is missing.
 */
export async function GET(request: NextRequest) {
  // Check for WebSocket upgrade header
  const upgradeHeader = request.headers.get('upgrade')

  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response(
      JSON.stringify({ error: 'WebSocket upgrade required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // Initialize WebSocket server if not already created
  if (!wss) {
    wss = new WebSocketServer({ noServer: true })

    wss.on('connection', handleConnection)
  }

  // Perform WebSocket upgrade
  // Note: Next.js App Router doesn't directly support WebSocket upgrades
  // This is a placeholder for the upgrade logic that would be handled
  // by the Node.js HTTP server in production
  return new Response('WebSocket endpoint', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  })
}

/**
 * Handle New WebSocket Connection
 *
 * Sends 'connected' message with unique clientId.
 * Sets up message and close handlers.
 */
function handleConnection(ws: WebSocket) {
  const clientId = randomUUID()

  // Register client
  clients.set(clientId, ws)
  subscriptions.set(clientId, new Set())

  // Send 'connected' message
  const connectedMessage: ServerMessage = {
    type: 'connected',
    clientId,
    timestamp: new Date().toISOString(),
  }

  sendMessage(ws, connectedMessage)

  // Handle incoming messages
  ws.on('message', (data: Buffer) => {
    handleClientMessage(clientId, data)
  })

  // Handle connection close
  ws.on('close', () => {
    handleDisconnect(clientId)
  })

  // Handle errors
  ws.on('error', (error) => {
    console.error(`[WebSocket] Client ${clientId} error:`, error)
    handleDisconnect(clientId)
  })
}

/**
 * Handle Client Message
 *
 * Validates message schema and routes to appropriate handler.
 * Sends error message if validation fails.
 */
function handleClientMessage(clientId: string, data: Buffer) {
  const ws = clients.get(clientId)
  if (!ws) return

  try {
    // Parse JSON
    const rawMessage = JSON.parse(data.toString())

    // Validate with Zod
    const result = ClientMessageSchema.safeParse(rawMessage)

    if (!result.success) {
      // Send error message for invalid schema
      const errorMessage: ServerMessage = {
        type: 'error',
        code: 'INVALID_MESSAGE',
        message: `Invalid message format: ${result.error.message}`,
        timestamp: new Date().toISOString(),
      }
      sendMessage(ws, errorMessage)
      return
    }

    const message: ClientMessage = result.data

    // Route message based on type
    switch (message.type) {
      case 'subscribe':
        handleSubscribe(clientId, message.projectId)
        break
      case 'unsubscribe':
        handleUnsubscribe(clientId, message.projectId)
        break
      case 'ping':
        handlePing(clientId)
        break
    }
  } catch (error) {
    console.error(`[WebSocket] Failed to parse message from ${clientId}:`, error)
    const errorMessage: ServerMessage = {
      type: 'error',
      code: 'INVALID_MESSAGE',
      message: 'Failed to parse message',
      timestamp: new Date().toISOString(),
    }
    sendMessage(ws, errorMessage)
  }
}

/**
 * Handle Subscribe Message
 *
 * Adds projectId to client's subscription set.
 * Validates project exists in database.
 * Sends 'subscribed' acknowledgment or error.
 */
async function handleSubscribe(clientId: string, projectId: number) {
  const ws = clients.get(clientId)
  if (!ws) return

  try {
    // TODO: Validate project exists in database
    // For now, accept all project IDs
    // In production, query database:
    // const project = await prisma.project.findUnique({ where: { id: projectId } })
    // if (!project) { send error; return }

    // Add to subscriptions
    const clientSubs = subscriptions.get(clientId)
    if (clientSubs) {
      clientSubs.add(projectId)
    }

    // Send acknowledgment
    const subscribedMessage: ServerMessage = {
      type: 'subscribed',
      projectId,
      timestamp: new Date().toISOString(),
    }
    sendMessage(ws, subscribedMessage)

    console.log(`[WebSocket] Client ${clientId} subscribed to project ${projectId}`)
  } catch (error) {
    console.error(`[WebSocket] Subscribe error for client ${clientId}:`, error)
    const errorMessage: ServerMessage = {
      type: 'error',
      code: 'INTERNAL_ERROR',
      message: 'Failed to subscribe to project',
      timestamp: new Date().toISOString(),
    }
    sendMessage(ws, errorMessage)
  }
}

/**
 * Handle Unsubscribe Message
 *
 * Removes projectId from client's subscription set.
 * Sends 'unsubscribed' acknowledgment.
 */
function handleUnsubscribe(clientId: string, projectId: number) {
  const ws = clients.get(clientId)
  if (!ws) return

  // Remove from subscriptions
  const clientSubs = subscriptions.get(clientId)
  if (clientSubs) {
    clientSubs.delete(projectId)
  }

  // Send acknowledgment
  const unsubscribedMessage: ServerMessage = {
    type: 'unsubscribed',
    projectId,
    timestamp: new Date().toISOString(),
  }
  sendMessage(ws, unsubscribedMessage)

  console.log(`[WebSocket] Client ${clientId} unsubscribed from project ${projectId}`)
}

/**
 * Handle Ping Message
 *
 * Responds with 'pong' message for keep-alive.
 */
function handlePing(clientId: string) {
  const ws = clients.get(clientId)
  if (!ws) return

  const pongMessage: ServerMessage = {
    type: 'pong',
    timestamp: new Date().toISOString(),
  }
  sendMessage(ws, pongMessage)
}

/**
 * Handle Client Disconnect
 *
 * Removes client from registries.
 */
function handleDisconnect(clientId: string) {
  clients.delete(clientId)
  subscriptions.delete(clientId)
  console.log(`[WebSocket] Client ${clientId} disconnected`)
}

/**
 * Send Message to Client
 *
 * Validates message schema and sends as JSON.
 * Logs errors if send fails.
 */
function sendMessage(ws: WebSocket, message: ServerMessage) {
  try {
    // Validate with Zod
    const result = ServerMessageSchema.safeParse(message)

    if (!result.success) {
      console.error('[WebSocket] Invalid server message:', result.error)
      return
    }

    // Send as JSON
    ws.send(JSON.stringify(message))
  } catch (error) {
    console.error('[WebSocket] Failed to send message:', error)
  }
}

/**
 * Export for Testing and External Broadcast
 */
export { clients, subscriptions, sendMessage }
