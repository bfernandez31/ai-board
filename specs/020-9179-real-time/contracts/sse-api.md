# Server-Sent Events (SSE) API Contract

**Feature**: 020-9179-real-time
**Date**: 2025-10-10
**Protocol**: Server-Sent Events (SSE) - W3C EventSource

## Connection

### Endpoint

```
http://localhost:3000/api/sse?projectId=1 (development)
https://[domain]/api/sse?projectId=1 (production)
```

### Query Parameters

- **`projectId`** (required): Positive integer identifying the project to subscribe to

### Connection Request

**HTTP Request**:
```http
GET /api/sse?projectId=1 HTTP/1.1
Host: localhost:3000
Accept: text/event-stream
Cache-Control: no-cache
```

**Success Response (200 OK)**:
```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no

: Connected to project 1

```

**Error Response (400 Bad Request - Missing projectId)**:
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "projectId query parameter required"
}
```

**Error Response (400 Bad Request - Invalid projectId)**:
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "projectId must be a positive integer"
}
```

---

## Message Format

### Server → Client Messages

SSE uses a simple text-based format:

```
data: <JSON payload>

```

#### Job Status Update

Broadcast when a job's status changes.

**Message Schema**:
```typescript
{
  projectId: number,
  ticketId: number,
  jobId: number,
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
  command: string, // e.g., 'specify', 'plan', 'build'
  timestamp: string // ISO 8601
}
```

**Example (Job Started)**:
```
data: {"projectId":1,"ticketId":42,"jobId":123,"status":"RUNNING","command":"specify","timestamp":"2025-10-10T14:30:00.000Z"}

```

**Example (Job Completed)**:
```
data: {"projectId":1,"ticketId":42,"jobId":123,"status":"COMPLETED","command":"specify","timestamp":"2025-10-10T14:32:15.500Z"}

```

**Example (Job Failed)**:
```
data: {"projectId":1,"ticketId":42,"jobId":123,"status":"FAILED","command":"plan","timestamp":"2025-10-10T14:35:00.000Z"}

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

### Keep-Alive Comments

The server sends periodic comment lines to prevent connection timeout.

**Keep-Alive Message** (every 15 seconds):
```
: keep-alive

```

**Purpose**:
- Prevents proxy/CDN timeout (e.g., Vercel, Cloudflare)
- Detects client disconnection
- Maintains TCP connection

---

## Connection Lifecycle

### 1. Connection Established

```
Client                          Server
  |                               |
  |-------- HTTP GET -----------→|
  |           /api/sse?projectId=1|
  |                               |
  |←------ 200 OK ----------------|
  |        text/event-stream      |
  |                               |
  |←------ ': Connected' ---------|
  |                               |
```

**Client Code**:
```typescript
const eventSource = new EventSource('/api/sse?projectId=1')

eventSource.onopen = () => {
  console.log('SSE Connected')
}
```

### 2. Job Status Updates

```
Client                          Server                Database/API
  |                               |                        |
  |                               |←----- Job Update ------|
  |←-- data: {...job update} -----|                        |
  |                               |                        |
  | (UI updates after 500ms)      |                        |
  |                               |                        |
```

**Client Code**:
```typescript
eventSource.onmessage = (event) => {
  const update = JSON.parse(event.data)
  // Validate with Zod
  // Update UI
}
```

### 3. Keep-Alive

```
Client                          Server
  |                               |
  |←-------- ': keep-alive' ------|
  |                               |
  | (repeat every 15s)            |
  |                               |
```

### 4. Disconnection

```
Client                          Server
  |                               |
  |------- Close Connection ---→|
  |                               |
  | (connection closed)           |
  |                               |
```

**Client Code**:
```typescript
eventSource.close()
```

### 5. Automatic Reconnection

EventSource automatically reconnects with exponential backoff.

```
Client                          Server
  |                               |
  | (detect disconnect)           |
  |                               |
  | (auto backoff: ~3s)           |
  |                               |
  |-------- HTTP GET -----------→|
  |           /api/sse?projectId=1|
  |                               |
  |←------ 200 OK ----------------|
  |        text/event-stream      |
  |                               |
```

**Client Behavior**:
- Browser automatically attempts reconnection
- Exponential backoff built into EventSource API
- No manual reconnection logic needed

---

## Error Handling

### Client-Side Errors

**Connection Failure**:
- EventSource automatically retries with exponential backoff
- `onerror` event fired on connection failure
- Client can manually reconnect if needed

**Message Parsing Failure**:
- Client validates incoming messages with Zod
- If validation fails, log error and ignore message (do not crash)

**Client Code**:
```typescript
eventSource.onerror = (error) => {
  console.error('SSE Connection error:', error)
  // EventSource automatically reconnects
  // Optional: show user notification after multiple failures
}
```

### Server-Side Errors

**Invalid projectId**:
- Return 400 Bad Request with JSON error
- Do not establish SSE connection

**Broadcast Failure**:
- Log error (which clients failed to receive message)
- Client marked as disconnected (removed from subscriber set)
- Client automatically reconnects via EventSource

**Keep-Alive Write Failure**:
- Detect disconnected client
- Clean up subscriber registration
- No action needed (client reconnects automatically)

---

## Security Considerations

### Authentication (Future)

**Current**: No authentication (development phase)

**Future**: Validate session token in query parameter or cookie:
```typescript
const sessionToken = request.cookies.get('session')
if (!validateSession(sessionToken)) {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  )
}
```

### Authorization

**Current**: Clients can subscribe to any project ID

**Future**: Validate project access:
```typescript
const hasAccess = await checkProjectAccess(userId, projectId)
if (!hasAccess) {
  return new Response(
    JSON.stringify({ error: 'Access denied to project' }),
    { status: 403, headers: { 'Content-Type': 'application/json' } }
  )
}
```

### Rate Limiting

**Connection Rate**: Max 10 connections per minute per IP
**Message Rate**: Determined by job status update frequency (typically low)

**Enforcement**:
- Track connection attempts per IP address
- Return 429 Too Many Requests if limits exceeded

### Input Validation

**projectId**: Must be positive integer, validated before connection
**Message Size**: Job status updates are small (~200 bytes)

---

## Performance Characteristics

### Latency

- **Connection Establishment**: <50ms
- **Broadcast Fanout (Server → Clients)**: <20ms per client
- **Total Update Latency**: <100ms (database update → client display)

### Throughput

- **Max Concurrent Connections**: 1000+ (limited by Node.js EventEmitter)
- **Max Broadcast Fanout**: 500+ clients per message
- **Message Overhead**: ~100 bytes per SSE message (including `data:` prefix)

### Resource Usage

- **Memory per Connection**: ~20KB (lower than WebSocket)
- **CPU per Broadcast**: ~0.5ms per 50 clients
- **Network Bandwidth**: ~300 bytes per status update message (including SSE format)

### Advantages over WebSocket

- **Simpler Implementation**: ~50% less code than WebSocket
- **Automatic Reconnection**: Built into EventSource API
- **HTTP/1.1 Compatible**: Works with standard HTTP infrastructure
- **Serverless-Friendly**: Compatible with Vercel Free tier
- **No Upgrade Required**: Standard HTTP GET request

---

## Testing Contract

### Integration Tests (Required)

**Test Cases**:
1. SSE connection establishment with valid projectId
2. Receive job status update for subscribed project
3. Multiple clients receive same status update simultaneously
4. Keep-alive prevents connection timeout
5. Automatic reconnection after disconnect
6. Invalid projectId rejected with 400
7. Missing projectId rejected with 400
8. Message schema validation with Zod
9. Multiple tabs (same browser) sync via independent connections

**Test Location**: `tests/e2e/sse-integration.spec.ts`

**Test Setup**:
- Playwright browser automation for EventSource client behavior
- Database seeding for test jobs and projects
- Server-side broadcast testing

---

## Zod Validation Schema

```typescript
// lib/sse-schemas.ts

import { z } from 'zod'

export const JobStatusUpdateSchema = z.object({
  projectId: z.number().int().positive(),
  ticketId: z.number().int().positive(),
  jobId: z.number().int().positive(),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  command: z.string().max(50),
  timestamp: z.string().datetime(),
})

export type JobStatusUpdate = z.infer<typeof JobStatusUpdateSchema>

export function parseJobStatusUpdate(data: unknown): JobStatusUpdate | null {
  const result = JobStatusUpdateSchema.safeParse(data)
  return result.success ? result.data : null
}
```

---

## EventSource Client API

### Browser API

**Connection**:
```typescript
const eventSource = new EventSource('/api/sse?projectId=1')
```

**Event Handlers**:
```typescript
eventSource.onopen = (event) => {
  console.log('Connection opened')
}

eventSource.onmessage = (event) => {
  const update = JSON.parse(event.data)
  // Validate and handle update
}

eventSource.onerror = (error) => {
  console.error('Connection error:', error)
  // EventSource automatically reconnects
}
```

**Cleanup**:
```typescript
eventSource.close()
```

### React Hook

**Usage**:
```typescript
const { status, jobUpdates, reconnect } = useSSE({ projectId: 1 })

// status: 'connecting' | 'connected' | 'disconnected' | 'error'
// jobUpdates: Map<ticketId, JobStatusUpdate>
// reconnect: () => void (manual reconnection)
```

---

## Contract Compliance Checklist

- [x] Connection endpoint and query parameters documented
- [x] Message format specified with schema
- [x] Request/response examples provided
- [x] Error handling documented
- [x] Security considerations addressed
- [x] Performance characteristics specified
- [x] Testing requirements defined
- [x] Zod validation schema included
- [x] EventSource API usage documented

**Status**: ✅ SSE API Contract Complete
