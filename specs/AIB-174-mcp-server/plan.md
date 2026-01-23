# Implementation Plan: MCP Server for AI-Board

**Branch**: `AIB-174-mcp-server` | **Date**: 2026-01-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-174-mcp-server/spec.md`

## Summary

Create an MCP (Model Context Protocol) server that enables Claude to interact directly with ai-board. The server will expose 6 tools (list_projects, get_project, create_ticket, get_ticket, list_tickets, move_ticket) that proxy requests to the ai-board API using Personal Access Token authentication. The server communicates via stdio transport following the MCP specification.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: @modelcontextprotocol/sdk, zod (already in project)
**Storage**: N/A (stateless - proxies to ai-board API)
**Testing**: Vitest (unit + integration)
**Target Platform**: Node.js 22.x (CLI process spawned by Claude Desktop)
**Project Type**: Single (standalone MCP server package within monorepo)
**Performance Goals**: First tool response within 2 seconds (per spec SC-005)
**Constraints**: Timeout 30s for API requests, rate limiting respected from API responses
**Scale/Scope**: Single-user CLI tool, 6 MCP tools

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development ✅
- [x] TypeScript strict mode with explicit type annotations
- [x] No `any` types - use zod for validation and type inference
- [x] All function parameters and return types explicitly typed
- [x] TypeScript interfaces for API responses and config

### II. Component-Driven Architecture ✅
- [x] N/A - No UI components (CLI tool)
- [x] Feature-based folder structure: `/mcp-server/` at project root
- [x] Shared utilities in `/lib/` pattern (API client reuse)

### III. Test-Driven Development ✅
- [x] Unit tests for pure functions (config validation, error handling)
- [x] Integration tests for API client operations
- [x] No E2E tests needed (CLI tool, not browser)
- [x] Search existing tests first before creating new

### IV. Security-First Design ✅
- [x] Validate all inputs with zod schemas
- [x] PAT tokens never logged or exposed in error messages
- [x] Config file read from user home directory (~/.aiboard/config.json)
- [x] Clear error messages without sensitive data leakage

### V. Database Integrity ✅
- [x] N/A - MCP server doesn't directly access database
- [x] All data operations go through existing API endpoints

### VI. AI-First Development Model ✅
- [x] No README files at project root
- [x] Spec-kit templates and tasks address AI agents
- [x] Ticket specs in `specs/AIB-174-mcp-server/`

### VII. Clarification Guardrails ✅
- [x] Auto-resolved decisions documented in spec.md
- [x] CONSERVATIVE policy applied for security-sensitive decisions

## Project Structure

### Documentation (this feature)

```
specs/AIB-174-mcp-server/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI for MCP tools)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
mcp-server/
├── src/
│   ├── index.ts         # Entry point, stdio transport setup
│   ├── server.ts        # McpServer initialization, tool registration
│   ├── config.ts        # Config loading from ~/.aiboard/config.json
│   ├── api-client.ts    # HTTP client for ai-board API
│   └── tools/
│       ├── list-projects.ts
│       ├── get-project.ts
│       ├── create-ticket.ts
│       ├── get-ticket.ts
│       ├── list-tickets.ts
│       └── move-ticket.ts
├── package.json         # Separate package for MCP server
└── tsconfig.json        # TypeScript config (inherits from root)

tests/
├── unit/
│   └── mcp-server/
│       ├── config.test.ts
│       └── api-client.test.ts
└── integration/
    └── mcp-server/
        └── tools.test.ts
```

**Structure Decision**: Single package at `mcp-server/` directory in repository root. This keeps the MCP server separate from the Next.js web app while sharing the project's TypeScript configuration and zod dependency. The MCP server is a standalone CLI tool that can be published to npm independently.

## Post-Design Constitution Re-Check ✅

After Phase 1 design artifacts are complete, re-evaluating against constitution:

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | All types defined in data-model.md, zod schemas in contracts |
| II. Component-Driven | ✅ PASS | N/A for CLI tool; structure defined in project structure |
| III. Test-Driven | ✅ PASS | Unit + integration tests planned; no E2E needed |
| IV. Security-First | ✅ PASS | Config validation, token security documented in research.md |
| V. Database Integrity | ✅ PASS | N/A - stateless proxy, uses existing API |
| VI. AI-First Model | ✅ PASS | All docs in specs/, no READMEs created |
| VII. Clarification | ✅ PASS | All decisions documented with rationale |

**Gate Status**: PASS - Proceed to Phase 2 (tasks.md generation via /speckit.tasks)

## Complexity Tracking

No violations detected. The implementation follows existing patterns:
- Uses existing PAT authentication system (AIB-173)
- Standard MCP SDK patterns (stdio transport)
- Minimal new dependencies (@modelcontextprotocol/sdk only)

## Artifacts Generated

| Artifact | Path | Status |
|----------|------|--------|
| Implementation Plan | `specs/AIB-174-mcp-server/plan.md` | ✅ Complete |
| Research | `specs/AIB-174-mcp-server/research.md` | ✅ Complete |
| Data Model | `specs/AIB-174-mcp-server/data-model.md` | ✅ Complete |
| MCP Tools Contract | `specs/AIB-174-mcp-server/contracts/mcp-tools.yaml` | ✅ Complete |
| Config Contract | `specs/AIB-174-mcp-server/contracts/config.yaml` | ✅ Complete |
| Quickstart | `specs/AIB-174-mcp-server/quickstart.md` | ✅ Complete |
