# WebSocket API Contract

**Feature**: 020-9179-real-time
**Date**: 2025-10-10
**Protocol**: WebSocket (RFC 6455)

## Connection

### Endpoint

```
ws://localhost:3000/api/ws (development)
wss://[domain]/api/ws (production)
```

### Connection Upgrade

**Initial HTTP Request**:
```http
GET /api/ws HTTP/1.1
Host: localhost:3000
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: [base64-encoded-key]
Sec-WebSocket-Version: 13
```

**Success Response (101 Switching Protocols)**:
```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: [base64-encoded-accept]
```

**Error Response (400 Bad Request)**:
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "WebSocket upgrade required"
}
```

---

## Message Types

### Client → Server Messages

#### 1. Subscribe to Project Updates

Subscribe to job status updates for a specific project.

**Message Schema**:
```typescript
{
  type: 'subscribe',
  projectId: number
}
```

**Example**:
```json
{
  "type": "subscribe",
  "projectId": 1
}
```

**Server Response** (Acknowledgment):
```json
{
  "type": "subscribed",
  "projectId": 1,
  "timestamp": "2025-10-10T14:30:00.000Z"
}
```

**Validation Rules**:
- `projectId` must be a positive integer
- `projectId` must correspond to an existing project (validated on server)

**Error Response**:
```json
{
  "type": "error",
  "code": "INVALID_PROJECT",
  "message": "Project not found: 1",
  "timestamp": "2025-10-10T14:30:00.000Z"
}
```

---

#### 2. Unsubscribe from Project Updates

Unsubscribe from a previously subscribed project.

**Message Schema**:
```typescript
{
  type: 'unsubscribe',
  projectId: number
}
```

**Example**:
```json
{
  "type": "unsubscribe",
  "projectId": 1
}
```

**Server Response** (Acknowledgment):
```json
{
  "type": "unsubscribed",
  "projectId": 1,
  "timestamp": "2025-10-10T14:30:00.000Z"
}
```

---

#### 3. Heartbeat (Ping)

Keep-alive message to prevent connection timeout.

**Message Schema**:
```typescript
{
  type: 'ping',
  timestamp: string // ISO 8601
}
```

**Example**:
```json
{
  "type": "ping",
  "timestamp": "2025-10-10T14:30:00.000Z"
}
```

**Server Response** (Pong):
```json
{
  "type": "pong",
  "timestamp": "2025-10-10T14:30:00.100Z"
}
```

---

### Server → Client Messages

#### 1. Job Status Update

Broadcast when a job's status changes.

**Message Schema**:
```typescript
{
  type: 'job-status-update',
  projectId: number,
  ticketId: number,
  jobId: number,
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
  command: string, // e.g., 'specify', 'plan', 'build'
  timestamp: string // ISO 8601
}
```

**Example (Job Started)**:
```json
{
  "type": "job-status-update",
  "projectId": 1,
  "ticketId": 42,
  "jobId": 123,
  "status": "RUNNING",
  "command": "specify",
  "timestamp": "2025-10-10T14:30:00.000Z"
}
```

**Example (Job Completed)**:
```json
{
  "type": "job-status-update",
  "projectId": 1,
  "ticketId": 42,
  "jobId": 123,
  "status": "COMPLETED",
  "command": "specify",
  "timestamp": "2025-10-10T14:32:15.500Z"
}
```

**Example (Job Failed)**:
```json
{
  "type": "job-status-update",
  "projectId": 1,
  "ticketId": 42,
  "jobId": 123,
  "status": "FAILED",
  "command": "plan",
  "timestamp": "2025-10-10T14:35:00.000Z"
}
```

**Broadcasting Rules**:
- Message sent to all clients subscribed to `projectId`
- Message triggered by `PATCH /api/jobs/:id/status` API call
- Order preserved: Messages sent in chronological order of status updates

**Client Handling**:
- Client validates message schema with Zod
- Client updates UI for matching `ticketId`
- Client enforces 500ms minimum display duration (client-side debouncing)

---

#### 2. Error Message

Server error notification.

**Message Schema**:
```typescript
{
  type: 'error',
  code: string, // Error code (e.g., 'INVALID_PROJECT', 'INTERNAL_ERROR')
  message: string, // Human-readable error description
  timestamp: string // ISO 8601
}
```

**Example**:
```json
{
  "type": "error",
  "code": "INTERNAL_ERROR",
  "message": "Failed to fetch job status",
  "timestamp": "2025-10-10T14:30:00.000Z"
}
```

**Error Codes**:
- `INVALID_PROJECT`: Project ID does not exist
- `INVALID_MESSAGE`: Message failed schema validation
- `INTERNAL_ERROR`: Server-side error (database, broadcast failure)
- `UNAUTHORIZED`: Authentication failed (future)

---

#### 3. Connection Acknowledgment

Sent immediately after WebSocket connection established.

**Message Schema**:
```typescript
{
  type: 'connected',
  clientId: string, // Unique client identifier (UUID)
  timestamp: string // ISO 8601
}
```

**Example**:
```json
{
  "type": "connected",
  "clientId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-10-10T14:30:00.000Z"
}
```

---

## Connection Lifecycle

### 1. Connection Established

```
Client                          Server
  |                               |
  |-------- HTTP Upgrade -------->|
  |<------ 101 Switching ---------|
  |                               |
  |<------ 'connected' msg -------|
  |                               |
```

### 2. Subscription

```
Client                          Server
  |                               |
  |---- 'subscribe' (proj 1) ---->|
  |<---- 'subscribed' (proj 1) ---|
  |                               |
  |---- 'subscribe' (proj 2) ---->|
  |<---- 'subscribed' (proj 2) ---|
  |                               |
```

### 3. Job Status Updates

```
Client                          Server                Database/API
  |                               |                        |
  |                               |<----- Job Update ------|
  |<-- 'job-status-update' -------|                        |
  |                               |                        |
  | (UI updates after 500ms)      |                        |
  |                               |                        |
```

### 4. Heartbeat

```
Client                          Server
  |                               |
  |--------- 'ping' ------------->|
  |<-------- 'pong' --------------|
  |                               |
  | (repeat every 30s)            |
  |                               |
```

### 5. Disconnection

```
Client                          Server
  |                               |
  |------- Close Frame ---------->|
  |<------ Close Frame -----------|
  |                               |
  | (connection closed)           |
  |                               |
```

### 6. Reconnection

```
Client                          Server
  |                               |
  | (detect disconnect)           |
  |                               |
  | (wait 1s backoff)             |
  |                               |
  |-------- HTTP Upgrade -------->|
  |<------ 101 Switching ---------|
  |                               |
  |---- 'subscribe' (proj 1) ---->|
  |<---- 'subscribed' (proj 1) ---|
  |                               |
  | (fetch latest job statuses)   |
  |------- GET /api/jobs -------->|
  |<------ Job Data --------------|
  |                               |
```

---

## Error Handling

### Client-Side Errors

**Invalid Message Schema**:
- Client validates outgoing messages with Zod before sending
- If validation fails, log error and do not send message

**Connection Failure**:
- Exponential backoff: 1s, 2s, 4s, 8s, 16s (max)
- After 5 failed attempts, show user notification
- Option to manually retry connection

**Message Parsing Failure**:
- Client validates incoming messages with Zod
- If validation fails, log error and ignore message (do not crash)

### Server-Side Errors

**Invalid Client Message**:
- Validate with Zod schema
- Send `error` message to client with `INVALID_MESSAGE` code
- Do not disconnect client (allow recovery)

**Database Query Failure**:
- Log error with context (client ID, project ID)
- Send `error` message to client with `INTERNAL_ERROR` code
- Do not crash server (isolate per-client errors)

**Broadcast Failure**:
- Log error (which clients failed to receive message)
- Retry broadcast once after 100ms
- If still failing, mark client as disconnected

---

## Security Considerations

### Authentication (Future)

**Current**: No authentication (development phase)

**Future**: Validate session token in WebSocket upgrade request:
```typescript
const sessionToken = request.headers.get('cookie')
if (!validateSession(sessionToken)) {
  return new Response('Unauthorized', { status: 401 })
}
```

### Authorization

**Current**: Clients can subscribe to any project ID

**Future**: Validate project access:
```typescript
const hasAccess = await checkProjectAccess(userId, projectId)
if (!hasAccess) {
  sendError(client, 'UNAUTHORIZED', 'Access denied to project')
}
```

### Rate Limiting

**Subscribe Messages**: Max 10 subscriptions per client
**Ping Messages**: Max 1 per 10 seconds per client
**Total Messages**: Max 100 per minute per client

**Enforcement**:
- Track message count per client ID
- Send `error` message and disconnect if limits exceeded

### Input Validation

**All Messages**: Validated with Zod schemas before processing
**ProjectId**: Must be positive integer, checked against database
**Message Size**: Max 1KB per message (WebSocket frame limit)

---

## Performance Characteristics

### Latency

- **Connection Establishment**: <100ms
- **Message Delivery (Client → Server)**: <10ms
- **Broadcast Fanout (Server → Clients)**: <50ms per client
- **Total Update Latency**: <200ms (database update → client display)

### Throughput

- **Max Concurrent Connections**: 1000 (Node.js server limit)
- **Max Messages per Second per Client**: 10
- **Max Broadcast Fanout**: 500 clients per message

### Resource Usage

- **Memory per Connection**: ~50KB
- **CPU per Broadcast**: ~1ms per 50 clients
- **Network Bandwidth**: ~500 bytes per status update message

---

## Testing Contract

### Integration Tests (Required)

**Test Cases**:
1. WebSocket connection establishment and `connected` message
2. Subscribe to project and receive `subscribed` acknowledgment
3. Job status update broadcast to subscribed clients
4. Multiple clients receive same status update simultaneously
5. Unsubscribe stops receiving updates
6. Heartbeat (ping/pong) keeps connection alive
7. Automatic reconnection after disconnect
8. Invalid message schema rejected with error
9. Multiple tabs (same browser) sync via independent connections

**Test Location**: `tests/e2e/websocket-integration.spec.ts`

**Test Setup**:
- Mock WebSocket server for deterministic testing
- Playwright browser automation for client behavior
- Database seeding for test jobs and projects

---

## Zod Validation Schemas

```typescript
// lib/websocket-schemas.ts

import { z } from 'zod'

// Client → Server Messages
export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('subscribe'),
    projectId: z.number().int().positive()
  }),
  z.object({
    type: z.literal('unsubscribe'),
    projectId: z.number().int().positive()
  }),
  z.object({
    type: z.literal('ping'),
    timestamp: z.string().datetime()
  })
])

// Server → Client Messages
export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('connected'),
    clientId: z.string().uuid(),
    timestamp: z.string().datetime()
  }),
  z.object({
    type: z.literal('subscribed'),
    projectId: z.number().int().positive(),
    timestamp: z.string().datetime()
  }),
  z.object({
    type: z.literal('unsubscribed'),
    projectId: z.number().int().positive(),
    timestamp: z.string().datetime()
  }),
  z.object({
    type: z.literal('job-status-update'),
    projectId: z.number().int().positive(),
    ticketId: z.number().int().positive(),
    jobId: z.number().int().positive(),
    status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
    command: z.string().max(50),
    timestamp: z.string().datetime()
  }),
  z.object({
    type: z.literal('error'),
    code: z.string(),
    message: z.string(),
    timestamp: z.string().datetime()
  }),
  z.object({
    type: z.literal('pong'),
    timestamp: z.string().datetime()
  })
])

export type ClientMessage = z.infer<typeof ClientMessageSchema>
export type ServerMessage = z.infer<typeof ServerMessageSchema>
export type JobStatusUpdate = Extract<ServerMessage, { type: 'job-status-update' }>
```

---

## Contract Compliance Checklist

- [x] Connection upgrade flow documented
- [x] All message types specified with schemas
- [x] Request/response examples provided
- [x] Error handling documented
- [x] Security considerations addressed
- [x] Performance characteristics specified
- [x] Testing requirements defined
- [x] Zod validation schemas included

**Status**: ✅ WebSocket API Contract Complete
