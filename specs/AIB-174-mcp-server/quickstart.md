# Quickstart: MCP Server for AI-Board

**Branch**: `AIB-174-mcp-server` | **Date**: 2026-01-23

## Implementation Steps

### Step 1: Package Setup

Create `mcp-server/package.json`:

```json
{
  "name": "@ai-board/mcp-server",
  "version": "1.0.0",
  "description": "MCP server for interacting with ai-board",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "ai-board-mcp": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^4.1.11"
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  },
  "peerDependencies": {
    "zod": "^4.0.0"
  }
}
```

Create `mcp-server/tsconfig.json`:

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

### Step 2: Config Module

Create `mcp-server/src/config.ts`:

```typescript
import { homedir } from "os";
import { join } from "path";
import { readFileSync, existsSync } from "fs";
import { z } from "zod";

const ConfigSchema = z.object({
  apiUrl: z
    .string()
    .url()
    .refine((url) => !url.endsWith("/"), "apiUrl should not end with /"),
  token: z
    .string()
    .startsWith("pat_")
    .min(68),
});

export type Config = z.infer<typeof ConfigSchema>;

export function getConfigPath(): string {
  return process.env.AIBOARD_CONFIG_PATH ?? join(homedir(), ".aiboard", "config.json");
}

export function loadConfig(): Config {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    throw new Error(
      `Config file not found at ${configPath}. Create it with apiUrl and token.`
    );
  }

  const content = readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(content);

  return ConfigSchema.parse(parsed);
}
```

### Step 3: API Client

Create `mcp-server/src/api-client.ts`:

```typescript
import type { Config } from "./config.js";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string
  ) {
    super(`API error ${status}: ${body}`);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(
  config: Config,
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${config.apiUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ApiError(response.status, body);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}
```

### Step 4: Tool Implementations

Create `mcp-server/src/tools/list-projects.ts`:

```typescript
import type { Config } from "../config.js";
import { apiRequest } from "../api-client.js";

interface ProjectSummary {
  id: number;
  key: string;
  name: string;
  description: string;
  githubOwner: string;
  githubRepo: string;
  ticketCount: number;
  updatedAt: string;
}

export async function listProjects(config: Config): Promise<ProjectSummary[]> {
  return apiRequest<ProjectSummary[]>(config, "/api/projects");
}
```

Create `mcp-server/src/tools/create-ticket.ts`:

```typescript
import type { Config } from "../config.js";
import { apiRequest } from "../api-client.js";

interface CreateTicketInput {
  projectId: number;
  title: string;
  description: string;
}

interface TicketResponse {
  id: number;
  ticketKey: string;
  title: string;
  description: string;
  stage: string;
  createdAt: string;
}

export async function createTicket(
  config: Config,
  input: CreateTicketInput
): Promise<TicketResponse> {
  return apiRequest<TicketResponse>(
    config,
    `/api/projects/${input.projectId}/tickets`,
    {
      method: "POST",
      body: JSON.stringify({
        title: input.title,
        description: input.description,
      }),
    }
  );
}
```

### Step 5: Server Entry Point

Create `mcp-server/src/index.ts`:

```typescript
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { listProjects } from "./tools/list-projects.js";
import { createTicket } from "./tools/create-ticket.js";
import { ApiError } from "./api-client.js";

const config = loadConfig();

const server = new McpServer({
  name: "ai-board-mcp",
  version: "1.0.0",
});

// Register tools
server.tool(
  "list_projects",
  "List all projects the user has access to",
  {},
  async () => {
    try {
      const projects = await listProjects(config);
      return {
        content: [{ type: "text", text: JSON.stringify(projects, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: formatError(error) }],
      };
    }
  }
);

server.tool(
  "create_ticket",
  "Create a new ticket in a project's INBOX stage",
  {
    projectId: z.number().int().positive().describe("Project ID"),
    title: z.string().min(1).max(100).describe("Ticket title"),
    description: z.string().min(1).max(10000).describe("Ticket description"),
  },
  async ({ projectId, title, description }) => {
    try {
      const ticket = await createTicket(config, { projectId, title, description });
      return {
        content: [{ type: "text", text: `Created ticket ${ticket.ticketKey}` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: formatError(error) }],
      };
    }
  }
);

function formatError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Authentication failed. Token may be expired or revoked.";
    }
    if (error.status === 403) {
      return "Access denied to this resource.";
    }
    if (error.status === 404) {
      return "Resource not found.";
    }
    return `API error: ${error.status}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error occurred";
}

// Connect to stdio transport
const transport = new StdioServerTransport();
server.connect(transport);
```

### Step 6: Claude Desktop Configuration

Add to Claude Desktop's MCP config (`~/.config/claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ai-board": {
      "command": "npx",
      "args": ["@ai-board/mcp-server"]
    }
  }
}
```

Or for local development:

```json
{
  "mcpServers": {
    "ai-board": {
      "command": "node",
      "args": ["/path/to/ai-board/mcp-server/dist/index.js"]
    }
  }
}
```

## Testing

### Unit Test Example

```typescript
// tests/unit/mcp-server/config.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadConfig, getConfigPath } from "../../../mcp-server/src/config";

describe("loadConfig", () => {
  it("throws when config file does not exist", () => {
    vi.mock("fs", () => ({
      existsSync: () => false,
    }));

    expect(() => loadConfig()).toThrow("Config file not found");
  });

  it("validates config schema", () => {
    vi.mock("fs", () => ({
      existsSync: () => true,
      readFileSync: () => JSON.stringify({
        apiUrl: "https://example.com",
        token: "pat_" + "a".repeat(64),
      }),
    }));

    const config = loadConfig();
    expect(config.apiUrl).toBe("https://example.com");
  });
});
```

### Integration Test Example

```typescript
// tests/integration/mcp-server/tools.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { listProjects } from "../../../mcp-server/src/tools/list-projects";

describe("MCP Tools", () => {
  const testConfig = {
    apiUrl: process.env.TEST_API_URL || "http://localhost:3000",
    token: process.env.TEST_TOKEN || "pat_test...",
  };

  describe("listProjects", () => {
    it("returns array of projects", async () => {
      const projects = await listProjects(testConfig);
      expect(Array.isArray(projects)).toBe(true);
    });
  });
});
```

## Key Patterns

1. **Error Handling**: All tools return content array with error text, never throw
2. **Type Safety**: Use zod for input validation and TypeScript for all types
3. **Stateless**: Config loaded once at startup, no state between calls
4. **Security**: Never log or expose tokens in error messages
