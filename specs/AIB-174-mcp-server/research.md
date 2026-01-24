# Research: MCP Server for AI-Board

**Branch**: `AIB-174-mcp-server` | **Date**: 2026-01-23

## Research Areas

### 1. MCP SDK TypeScript Implementation

**Decision**: Use @modelcontextprotocol/sdk with stdio transport

**Rationale**:
- Official TypeScript SDK is production-ready (v1.x recommended for production, v2 coming Q1 2026)
- Stdio transport is the standard for local, process-spawned integrations (Claude Desktop)
- Peer dependency on zod aligns with existing project dependency (zod ^4.1.11)
- Clear patterns for tool registration with zod schemas

**Alternatives Considered**:
- Python SDK: Rejected - project is TypeScript-first (constitution)
- HTTP transport: Rejected - stdio is simpler for local CLI tools, no server needed

**Code Pattern**:
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "ai-board-mcp",
  version: "1.0.0",
});

server.tool(
  "list_projects",
  "List all projects the user has access to",
  {},  // No required parameters
  async () => {
    // API call implementation
    return { content: [{ type: "text", text: JSON.stringify(projects) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport);
```

### 2. Config File Location and Format

**Decision**: Use `~/.aiboard/config.json` with environment variable override

**Rationale**:
- Cross-platform home directory support via `os.homedir()`
- JSON format is human-readable and easy to validate with zod
- Environment variable override (`AIBOARD_CONFIG_PATH`) for CI/testing scenarios
- Follows pattern of similar CLI tools (gh, aws, etc.)

**Alternatives Considered**:
- YAML config: Rejected - adds dependency, JSON sufficient
- Environment-only config: Rejected - less convenient for end users
- XDG Base Directory spec: Rejected - adds complexity, cross-platform issues

**Config Schema**:
```typescript
const ConfigSchema = z.object({
  apiUrl: z.string().url(),
  token: z.string().startsWith("pat_").min(68), // pat_ + 64 hex chars
});
```

### 3. API Client Implementation

**Decision**: Use native fetch with typed wrapper functions

**Rationale**:
- Node.js 22 has native fetch support - no external dependencies needed
- Existing API patterns in codebase use JSON responses
- 30-second timeout matches spec decision (FR timeout)
- Token validation via Authorization: Bearer header

**Alternatives Considered**:
- Axios: Rejected - unnecessary dependency, native fetch sufficient
- Got: Rejected - overkill for simple REST API calls
- Reusing existing lib/tokens/validate.ts: Not applicable - MCP server is client-side

**Implementation Pattern**:
```typescript
interface ApiClientConfig {
  apiUrl: string;
  token: string;
  timeout?: number;
}

async function apiRequest<T>(
  config: ApiClientConfig,
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeout ?? 30000);

  try {
    const response = await fetch(`${config.apiUrl}${endpoint}`, {
      ...options,
      headers: {
        "Authorization": `Bearer ${config.token}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ApiError(response.status, await response.text());
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}
```

### 4. Error Handling Strategy

**Decision**: Structured error responses without sensitive data

**Rationale**:
- MCP tools return content array with error text
- Error messages must be actionable but not leak token info
- API errors should include status code for debugging
- Rate limiting handled with Retry-After guidance

**Error Categories**:
| Error Type | MCP Response | User Action |
|------------|--------------|-------------|
| Config missing | "Config file not found at ~/.aiboard/config.json" | Create config |
| Invalid token format | "Invalid token format. Expected pat_..." | Regenerate token |
| 401 Unauthorized | "Authentication failed. Token may be expired or revoked." | Regenerate token |
| 403 Forbidden | "Access denied to this resource." | Check permissions |
| 404 Not Found | "Resource not found: {resource}" | Verify ID/key |
| 429 Rate Limited | "Rate limit exceeded. Retry after X seconds." | Wait and retry |
| Network error | "Unable to connect to ai-board API at {url}" | Check URL/network |

### 5. API Endpoint Mapping

**Decision**: Map MCP tools to existing ai-board REST endpoints

| MCP Tool | HTTP Method | Endpoint | Notes |
|----------|-------------|----------|-------|
| `list_projects` | GET | `/api/projects` | Returns user's projects |
| `get_project` | GET | `/api/projects/{id}` | Returns project details |
| `create_ticket` | POST | `/api/projects/{projectId}/tickets` | Creates in INBOX |
| `get_ticket` | GET | `/api/projects/{projectId}/tickets/{key}` | Supports ticketKey lookup |
| `list_tickets` | GET | `/api/projects/{projectId}/tickets` | Returns by stage |
| `move_ticket` | POST | `/api/projects/{projectId}/tickets/{key}/transition` | Stage transition |

**Rationale**:
- All endpoints already exist and support PAT authentication
- Ticket endpoints support both numeric ID and ticketKey (ABC-123 format)
- list_tickets returns tickets grouped by stage - transform for MCP response

### 6. Package Structure Decision

**Decision**: Separate package in `mcp-server/` directory at repo root

**Rationale**:
- MCP server is a standalone CLI tool, not part of Next.js app
- Can be published to npm independently (@ai-board/mcp-server)
- Shares zod dependency with main project (peer dependency)
- Separate tsconfig extends root config for consistency
- Entry point via `npx @ai-board/mcp-server` or direct node invocation

**Alternatives Considered**:
- Workspace package: Rejected - adds complexity, single package sufficient
- Bundled in Next.js: Rejected - MCP server runs as separate process, not in browser

### 7. Testing Strategy

**Decision**: Unit tests for config/API client, integration tests for tools

**Unit Tests** (`tests/unit/mcp-server/`):
- `config.test.ts`: Config loading, validation, path resolution
- `api-client.test.ts`: Request building, error handling, timeout

**Integration Tests** (`tests/integration/mcp-server/`):
- `tools.test.ts`: Full tool execution against test API
- Uses existing test project (Project 3+) for isolation

**Rationale**:
- No E2E tests needed - MCP is a CLI tool, not browser app
- Integration tests verify full tool → API → response flow
- Mock API responses for unit tests (fetch mocking)

## Dependencies

### New Dependencies (mcp-server/package.json)

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.x",
    "zod": "^4.1.11"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^4.0.2"
  }
}
```

### Peer Dependencies

- zod: Already installed in root project, used for schema validation

## Cross-Platform Considerations

### Config Path Resolution

```typescript
import { homedir } from "os";
import { join } from "path";

function getConfigPath(): string {
  const envPath = process.env.AIBOARD_CONFIG_PATH;
  if (envPath) return envPath;

  return join(homedir(), ".aiboard", "config.json");
}
```

**Platform Behavior**:
- Linux: `~/.aiboard/config.json` → `/home/user/.aiboard/config.json`
- macOS: `~/.aiboard/config.json` → `/Users/user/.aiboard/config.json`
- Windows: `~/.aiboard/config.json` → `C:\Users\user\.aiboard\config.json`

## Security Considerations

1. **Token Storage**: Config file contains PAT token in plain text. Users should:
   - Set file permissions to 600 (owner read/write only)
   - Never commit config file to version control
   - Rotate tokens regularly

2. **Error Messages**: Never include:
   - Full token value
   - Internal API paths
   - Database IDs beyond what API returns

3. **Logging**: Console output should not log:
   - Authorization headers
   - Token values
   - Full config contents

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Should we support multiple profiles/environments? | No - single config for v1, can extend later |
| How to handle API version mismatches? | API is stable, no versioning needed for v1 |
| Should MCP server auto-refresh expired tokens? | No - return clear error, user regenerates |
