# ai-board Vision

## Target Version Summary
- SaaS workspace where teams import or create projects, connect GitHub repos, and manage ticket workflows end-to-end.
- Spec-kit (Claude-driven) generates ticket documentation automatically; users review, edit, and approve specs directly inside the app.
- Tickets progress through gated steps (spec review, implementation, verification) with AI agents drafting code branches and syncing back to GitHub.
- Specs live on dedicated GitHub branches so teams retain the full history while editing through the web UI—no manual git commands required.
- MVP focuses on an inception use case: ai-board itself serves as the demo project, allowing live refresh of spec updates and full control over the repo workflow before onboarding external repos.
- Overall MVP emphasizes local-first development, seamless GitHub integration, and a lean deployment story (Vercel + managed Postgres + Claude provider).

## High-Level Architecture
```
+----------------------+        +---------------------------+
|  Web Client (Next.js)|<------>|  Next.js API Routes       |
|  - Ticket dashboard  |        |  - Ticket/spec CRUD       |
|  - Spec viewer/editor|        |  - GitHub proxy (Octokit) |
+----------+-----------+        |  - Workflow orchestrator  |
           |                    |  - Auth / RBAC middleware |
           |                    +------------+--------------+
           | HTTPS                              |
           v                                     v
+----------------------+        +---------------------------+
| Postgres (Prisma)    |        | GitHub App Integration    |
| - Tenants/projects   |        | - Installation tokens     |
| - Tickets/state logs |        | - Webhook handlers        |
| - Spec metadata      |        +------------+--------------+
| - Agent run history  |                     |
+----------+-----------+                     | Commits / PRs
           |                                 v
           | triggers (queue / cron)     +---------------------------+
           v                             | GitHub Repos / Spec Branch|
+----------------------+                 | - Canonical spec files    |
| AI Orchestrator      |<--------------->| - PRs & workflow signals  |
| - Spec-kit requests  |                 +------------+--------------+
| - Agent execution    |                              |
+----------+-----------+                              |
           |                                           |
           | API calls                                 |
           v                                           v
+---------------------------+        +---------------------------+
| Anthropic Claude API      |        | (Optional) Background     |
| - Spec & code generation  |        | Workers (Fly.io, Actions) |
+---------------------------+        | - Long-running agent jobs |
                                     +---------------------------+
```

## Spec-kit Execution Flow
- Trigger: user clicks `Generate/Refresh` in the UI → backend enqueues a job with ticket + branch context.
- Workspace: runner downloads the repo tarball for the target branch (ephemeral directory per job), runs spec-kit/Claude prompts, then commits the generated markdown back to `spec/<ticket>` via the GitHub App.
- Persistence: commit SHA + metadata recorded in Postgres so the UI reloads instantly; temp workspace is deleted after the run.
- Concurrency: each job uses its own temp folder; a lightweight queue (Vercel Queue, Upstash, or worker on Fly.io/Render) throttles parallel executions to stay within Anthropic/GitHub limits.
- Performance & cost: typical run ≈10–30 s (network + Claude latency). Cost scales with Claude tokens; monitor via `SpecRun` logs and enforce per-user quotas.
- Optional alternative: instead of an internal runner, trigger a GitHub Action workflow that already has the repo checkout; ai-board just orchestrates dispatch + status tracking.

## Deployment Notes
- Local development: Next.js + Prisma with Dockerized Postgres, specs stored in GitHub branches (starting with the ai-board repo), Anthropic API key in `.env`.
- Production MVP: deploy frontend/backend on Vercel, use managed Postgres (Neon/Supabase), connect GitHub App, and supply Claude credentials via environment variables.
- Switching to another Claude-compatible provider (Bedrock, Vertex, etc.) only requires updating the AI client configuration.

## Auto-Deployment Strategy
- Phase 1: rely on users' existing CI/CD—agent opens PRs, merges trigger their current deployment pipelines (initially demonstrated with ai-board).
- Phase 2: offer opt-in connectors for popular targets (Vercel deploy hooks, GitHub Actions template) so teams can trigger builds directly from ai-board.
- Phase 3: allow custom webhooks/API callbacks to integrate with other platforms (Netlify, Render, Kubernetes) without managing secrets for every provider.
- Phase 4 (optional): add deeper integrations for selected platforms once demand justifies maintaining their tokens/credential flows.

