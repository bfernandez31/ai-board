# API Contracts: Add Gemini CLI as AI Agent

## Overview

This document defines the API contracts for Gemini CLI integration, including credential management, agent selection, workflow dispatch, and telemetry collection.

## Base URL

```
https://api.ai-board.com/v1
```

## Authentication

All endpoints require authentication using the `Authorization` header:

```
Authorization: Bearer {api_token}
```

## Error Responses

All endpoints return consistent error formats:

### Standard Error Format

```json
{
  "error": "string",
  "code": "string",
  "details": "object",
  "timestamp": "ISO8601"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `AUTHENTICATION_REQUIRED` | 401 | Authentication missing/invalid |
| `PERMISSION_DENIED` | 403 | User lacks required permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server-side error |

## Endpoints

### 1. Credential Management

#### Store Google Credentials

**Endpoint**: `POST /credentials`

**Request**:
```json
{
  "provider": "GOOGLE",
  "apiKey": "AIzaSyABC123...",
  "oauthToken": "ya29.a0Ae..."
}
```

**Validation Rules**:
- `provider`: Must be "GOOGLE"
- `apiKey`: Must match `AIza[\w-]{35}` if provided
- `oauthToken`: Must be valid JWT if provided
- At least one credential must be provided

**Response (201 Created)**:
```json
{
  "success": true,
  "credentialId": "cred_abc123",
  "validationStatus": "PENDING",
  "message": "Credentials stored successfully. Validation in progress."
}
```

**Response (400 Bad Request)**:
```json
{
  "error": "Invalid API key format",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "apiKey",
    "expected": "AIza[\w-]{35}",
    "received": "invalid_key"
  }
}
```

#### Get Google Credentials

**Endpoint**: `GET /credentials/google`

**Response (200 OK)**:
```json
{
  "success": true,
  "credentials": {
    "id": "cred_abc123",
    "provider": "GOOGLE",
    "hasApiKey": true,
    "hasOauthToken": false,
    "validationStatus": "VALID",
    "createdAt": "2024-07-14T10:00:00Z",
    "updatedAt": "2024-07-14T10:05:00Z"
  }
}
```

**Response (404 Not Found)**:
```json
{
  "error": "No Google credentials found",
  "code": "NOT_FOUND"
}
```

#### Validate Google Credentials

**Endpoint**: `POST /credentials/google/validate`

**Request**:
```json
{
  "credentialId": "cred_abc123"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "validationStatus": "VALID",
  "message": "Credentials validated successfully"
}
```

**Response (400 Bad Request)**:
```json
{
  "error": "Invalid credentials",
  "code": "VALIDATION_ERROR",
  "details": {
    "apiError": "invalid_grant",
    "apiMessage": "Invalid API key"
  }
}
```

### 2. Agent Selection

#### Set Default Agent

**Endpoint**: `PUT /projects/{projectId}/agent`

**Request**:
```json
{
  "agent": "GEMINI"
}
```

**Validation Rules**:
- `agent`: Must be valid Agent enum value
- User must have permission to modify project

**Response (200 OK)**:
```json
{
  "success": true,
  "project": {
    "id": "proj_abc123",
    "defaultAgent": "GEMINI",
    "name": "My Project"
  }
}
```

**Response (400 Bad Request)**:
```json
{
  "error": "Invalid agent",
  "code": "VALIDATION_ERROR",
  "details": {
    "validAgents": ["CLAUDE", "CODEX", "MISTRAL", "GEMINI"]
  }
}
```

#### Get Available Agents

**Endpoint**: `GET /agents`

**Response (200 OK)**:
```json
{
  "success": true,
  "agents": [
    {
      "agent": "CLAUDE",
      "label": "Claude",
      "iconPath": "/agents/claude.svg",
      "isAvailable": true
    },
    {
      "agent": "GEMINI",
      "label": "Gemini",
      "iconPath": "/agents/gemini.svg",
      "isAvailable": true
    },
    {
      "agent": "MISTRAL",
      "label": "Mistral",
      "iconPath": "/agents/mistral.svg",
      "isAvailable": true
    }
  ]
}
```

### 3. Workflow Dispatch

#### Dispatch Workflow with Gemini

**Endpoint**: `POST /workflows/dispatch`

**Request**:
```json
{
  "workflowName": "speckit.yml",
  "agent": "GEMINI",
  "ticketId": "ticket_abc123",
  "projectId": "proj_abc123"
}
```

**Validation Rules**:
- `workflowName`: Must be supported by Gemini
- `agent`: Must be "GEMINI"
- User must have Google credentials stored
- Credentials must be in "VALID" state

**Response (202 Accepted)**:
```json
{
  "success": true,
  "dispatchId": "dispatch_abc123",
  "status": "PENDING",
  "message": "Workflow dispatch initiated"
}
```

**Response (400 Bad Request)**:
```json
{
  "error": "Workflow not supported by Gemini",
  "code": "VALIDATION_ERROR",
  "details": {
    "agent": "GEMINI",
    "supportedWorkflows": ["speckit.yml", "quick-impl.yml", "iterate.yml"]
  }
}
```

#### Get Workflow Status

**Endpoint**: `GET /workflows/{dispatchId}/status`

**Response (200 OK)**:
```json
{
  "success": true,
  "dispatch": {
    "id": "dispatch_abc123",
    "workflowName": "speckit.yml",
    "agent": "GEMINI",
    "status": "RUNNING",
    "startedAt": "2024-07-14T10:15:00Z",
    "environment": {
      "GEMINI_API_KEY": "*****",
      "GEMINI_TELEMETRY_ENDPOINT": "https://telemetry.ai-board.com"
    }
  }
}
```

### 4. Telemetry Collection

#### Submit Telemetry Events (Internal)

**Endpoint**: `POST /telemetry/events`

**Request**:
```json
{
  "events": [
    {
      "jobId": "job_abc123",
      "agent": "GEMINI",
      "eventType": "gemini_cli.api_response",
      "timestamp": "2024-07-14T10:20:00Z",
      "payload": {
        "input_token_count": 1500,
        "output_token_count": 800,
        "model": "gemini-1.5-pro",
        "request_id": "req_abc123"
      },
      "rawData": "base64_encoded_otlp_event"
    }
  ]
}
```

**Validation Rules**:
- Maximum 100 events per request
- Events must be <= 30 minutes old
- Payload must match event type schema

**Response (200 OK)**:
```json
{
  "success": true,
  "processed": 1,
  "failed": 0
}
```

**Response (400 Bad Request)**:
```json
{
  "error": "Invalid event payload",
  "code": "VALIDATION_ERROR",
  "details": {
    "eventIndex": 0,
    "field": "payload.input_token_count",
    "expected": "number",
    "received": "string"
  }
}
```

### 5. Analytics

#### Get Agent Metrics

**Endpoint**: `GET /analytics/agents`

**Query Parameters**:
- `agents`: Comma-separated list of agents (e.g., "GEMINI,MISTRAL")
- `startDate`: ISO date string
- `endDate`: ISO date string
- `groupBy`: "day", "week", or "month"

**Response (200 OK)**:
```json
{
  "success": true,
  "metrics": {
    "GEMINI": {
      "totalJobs": 42,
      "totalInputTokens": 150000,
      "totalOutputTokens": 80000,
      "estimatedCost": 0.12,
      "avgDurationMs": 15000,
      "successRate": 0.976
    },
    "MISTRAL": {
      "totalJobs": 28,
      "totalInputTokens": 90000,
      "totalOutputTokens": 45000,
      "estimatedCost": 0.08,
      "avgDurationMs": 12000,
      "successRate": 0.964
    }
  },
  "timeSeries": [
    {
      "date": "2024-07-14",
      "agent": "GEMINI",
      "jobs": 5,
      "inputTokens": 20000,
      "outputTokens": 10000
    }
  ]
}
```

## WebSocket Contracts

### Real-time Workflow Updates

**Endpoint**: `wss://api.ai-board.com/v1/workflows/updates`

**Subscription Message**:
```json
{
  "action": "subscribe",
  "dispatchId": "dispatch_abc123"
}
```

**Event Messages**:

#### Workflow Status Update
```json
{
  "type": "workflow_status",
  "dispatchId": "dispatch_abc123",
  "status": "RUNNING",
  "timestamp": "2024-07-14T10:25:00Z",
  "progress": 0.75
}
```

#### Telemetry Event
```json
{
  "type": "telemetry_event",
  "dispatchId": "dispatch_abc123",
  "jobId": "job_abc123",
  "agent": "GEMINI",
  "eventType": "gemini_cli.api_response",
  "payload": {
    "input_token_count": 1500,
    "output_token_count": 800
  }
}
```

#### Workflow Completion
```json
{
  "type": "workflow_completed",
  "dispatchId": "dispatch_abc123",
  "status": "COMPLETED",
  "timestamp": "2024-07-14T10:30:00Z",
  "metrics": {
    "durationMs": 900000,
    "totalInputTokens": 15000,
    "totalOutputTokens": 8000,
    "estimatedCost": 0.012
  }
}
```

## Rate Limiting

### API Rate Limits

| Endpoint | Limit | Window | Burst |
|----------|-------|--------|-------|
| `/credentials` | 10 req/min | 1 minute | 5 |
| `/workflows/dispatch` | 5 req/min | 1 minute | 3 |
| `/telemetry/events` | 100 req/min | 1 minute | 50 |
| `/analytics/*` | 20 req/min | 1 minute | 10 |

**Rate Limit Headers**:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 8
X-RateLimit-Reset: 30
```

**Rate Limit Response (429)**:
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "limit": 10,
    "remaining": 0,
    "resetIn": 30
  }
}
```

## Versioning

### API Versioning Strategy

- **URL Versioning**: Major versions in URL path (`/v1/`, `/v2/`)
- **Header Versioning**: Minor versions in `Accept` header
- **Backward Compatibility**: Maintained within major versions

### Version Headers

```
Accept: application/json; version=1.1
```

### Deprecation Policy

- **Deprecation Notice**: 3 months before removal
- **Sunset Period**: 6 months after deprecation
- **Deprecation Headers**:
```
Warning: 299 - "This endpoint is deprecated. Use /v2/credentials instead."
Sunset: Mon, 14 Jan 2025 00:00:00 GMT
```

## Security Considerations

### Data Protection

- **Credentials**: Always encrypted at rest (AES-256-GCM)
- **In Transit**: TLS 1.2+ required for all endpoints
- **At Rest**: Database encryption for sensitive fields

### Input Validation

- **Zod Schemas**: All inputs validated with Zod
- **SQL Injection**: Prisma ORM prevents raw SQL
- **XSS Protection**: Content-Security-Policy headers

### Authentication

- **Token Expiry**: 24 hours for API tokens
- **Rotation**: Automatic rotation on credential changes
- **Revocation**: Immediate revocation on security events

## Implementation Notes

### Client-Side Requirements

- **Minimum Node.js**: v18.0.0
- **Browser Support**: Chrome 100+, Firefox 100+, Safari 15+
- **WebSocket Support**: Required for real-time updates

### Server-Side Requirements

- **Database**: PostgreSQL 14+
- **Cache**: Redis 6+
- **Telemetry**: OpenTelemetry Collector

### Testing Requirements

- **Unit Tests**: 100% coverage for new endpoints
- **Integration Tests**: End-to-end workflow validation
- **Load Tests**: 1000 req/sec capacity verification

## Changelog

### v1.0 (2024-07-14)
- Initial Gemini API contract
- Credential management endpoints
- Workflow dispatch with Gemini support
- Telemetry collection endpoints
- Analytics with Gemini metrics

## References

- **OpenAPI Specification**: https://swagger.io/specification/
- **JSON API**: https://jsonapi.org/
- **OTLP Protocol**: https://opentelemetry.io/docs/specs/otlp/
- **Google API Design Guide**: https://cloud.google.com/apis/design