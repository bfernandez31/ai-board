# AI-Board Platform Opening — Architecture Design

**Date**: 2026-04-01
**Objective**: Design the complete architecture to open ai-board to external users with their own GitHub repositories.
**Launch type**: Soft launch (5-20 beta testers, GitHub auth only)

---

## Context

AI-Board is currently a single-tenant application managing its own repository. To open to external users, it needs to support arbitrary GitHub repositories with any tech stack. BYOK (Bring Your Own Key) was recently added. This design covers everything needed to make the platform multi-project ready.

### Current State
- Auth: GitHub OAuth (read:user, user:email scopes only)
- Billing: Stripe scaffolded but not configured (FREE/PRO/TEAM plans, webhooks, checkout/portal)
- Workflows: Hardcoded for ai-board stack (Bun, Node 22, Vitest, Playwright, PostgreSQL 16)
- Project creation UI: Disabled
- Legal pages: Terms + Privacy already implemented
- BYOK: Fully implemented (AES-256-GCM encryption, verification, workflow integration)
- BYOK credential guard: Only on ai-board assist, missing on stage transitions (→ AIB-441)

### Decisions Made
- Rate limiting: Skipped for soft launch (users known)
- Email transactional: Stripe native emails only (zero code)
- Onboarding: External guide, no in-app wizard
- Legal pages: Already sufficient
- Repo setup (secrets): Manual with instructions
- Approach: Bottom-up (infrastructure first, no shortcuts)

---

## Execution Order

1. Config déclarative `.ai-board/config.yml`
2. Setup layer (`setup-environment.sh` + `run-command.sh`)
3. Workflow universel (template avec services conditionnels)
4. Migration ai-board sur sa propre config (dogfooding)
5. Import projet (OAuth scope `repo` + repo picker)
6. Génération CLAUDE.md + constitution.md + config.yml
7. Stripe activation
8. Page profil + delete account

---

## Section 1: Declarative Config `.ai-board/config.yml`

### Purpose
A file in the target repo that describes everything ai-board needs to operate on that project. Workflows read this file instead of having hardcoded values.

### Location
`.ai-board/config.yml` at the root of the target repository.

### Schema

```yaml
version: 1

project:
  name: "My App"                    # Project display name
  language: typescript               # typescript | javascript | python | go | rust | java | kotlin
  framework: nextjs                  # nextjs | express | fastapi | django | flask | gin | spring-boot | quarkus | micronaut | none

runtime:
  manager: bun                       # bun | npm | yarn | pnpm | pip | poetry | cargo | maven | gradle
  manager_version: "1.2"             # Package manager version
  node: "22"                         # Node.js version (if applicable)
  python: "3.12"                     # Python version (if applicable)
  java: "21"                         # Java/JDK version (if applicable)
  go: "1.22"                         # Go version (if applicable)
  rust: "1.78"                       # Rust version (if applicable)

services:                            # Sidecar services
  postgres:
    version: "16"
    database: myapp_test
    user: test
    password: test
  # redis:
  #   version: "7"
  # mysql:
  #   version: "8"
  # mongo:
  #   version: "7"

commands:
  install: bun install               # Dependency installation
  build: bun run build               # Project build (optional)
  lint: bun run lint                  # Linter (optional)
  type_check: bun run type-check     # Type checking (optional)
  test_unit: bun run test:unit       # Unit tests
  test_integration: bun run test:integration  # Integration tests (optional)
  test_e2e: bun run test:e2e         # E2E tests (optional)
  db_setup: bunx prisma generate && bunx prisma migrate deploy  # ORM setup (optional)
  db_seed: npx tsx tests/global-setup.ts  # Database seeding (optional)

env:                                 # Env vars injected into runner
  DATABASE_URL: postgresql://test:test@localhost:5432/myapp_test
  NODE_ENV: test

agent:
  cli: claude-code                   # claude-code | codex
  model: claude-opus-4-7             # Model used by the agent
```

### Rules
- Missing file → workflows fail with clear message: "Missing .ai-board/config.yml"
- Missing optional command (lint, type_check, test_e2e) → step is skipped, no error
- `version: 1` enables future schema migrations
- `services` map directly to GitHub Actions `services:` containers
- `env` is merged with GitHub secrets (secrets take priority)

---

## Section 2: Setup Layer

### Purpose
Two centralized scripts in the ai-board repo that read `.ai-board/config.yml` and abstract all installation/execution logic. Workflows only call these scripts.

### `setup-environment.sh`

**Location**: `.github/scripts/setup-environment.sh`

**Interface**:
```bash
ai-board/.github/scripts/setup-environment.sh <target-dir> [--phase lightweight|full]
```

**Phase `lightweight`** (specify, plan, clarify, iterate, assist):
1. Parse config — read `.ai-board/config.yml` from target repo
2. Install runtime — node/bun/python based on `runtime.manager`
3. Symlink plugin — `.claude/commands` and `.claude/skills`
4. Validation — verify runtime and symlinks in place

**Phase `full`** (implement, quick-impl, verify, health-scan TESTS) — all of lightweight, plus:
5. Install agent CLI — Claude Code or Codex based on `agent.cli`
6. Export env vars — merge config `env` with workflow secrets (workflow secrets take precedence)
7. Detect Prisma — set `HAS_PRISMA=true` in `GITHUB_ENV`
8. Detect Playwright — set `HAS_PLAYWRIGHT=true` in `GITHUB_ENV`
9. Validation — verify agent CLI on PATH

**Phase `post-install`** — runs AFTER dependency installation:
- Executes `run-command.sh target db_setup` — config-driven ORM setup (Prisma generate/migrate, Flyway, Liquibase, etc.)
- Falls back to Prisma defaults for backward compatibility when no config

Note: Dependency installation is NOT done by setup-environment.sh. Workflows handle it explicitly via `run-command.sh target install` for visibility in CI logs.

**Replaces**: The 15-20 lines of duplicated setup in each workflow YAML. ORM setup is config-driven via `commands.db_setup` (no longer hardcoded to Prisma).

### `run-command.sh`

**Location**: `.github/scripts/run-command.sh`

**Interface**:
```bash
ai-board/.github/scripts/run-command.sh <target-dir> <command-key>
```

**Responsibilities**:
1. Read command from `commands.<key>` in config
2. Execute in target repo directory
3. Handle skip — if command not defined in config, exit 0 (silent skip)
4. Capture result — exit code, stdout/stderr for workflow
5. **Fallback defaults** — if `.ai-board/config.yml` is absent, use hardcoded defaults matching ai-board's own commands (backward compatibility)

### Impact on `run-agent.sh`

Minimal change: instead of hardcoding `bun add -g @anthropic-ai/claude-code`, it checks that `setup-environment.sh` already installed the CLI. If not, reads `agent.cli` from config.

### Workflow change (before/after)

**Before** (20+ duplicated setup lines per workflow):
```yaml
- uses: actions/setup-node@v4
  with: { node-version: '22' }
- run: npm install -g bun
- run: cd target && bun install
- run: mkdir -p target/.claude
- run: ln -sf ../../ai-board/.claude-plugin/commands target/.claude/commands
- run: ln -sf ../../ai-board/.claude-plugin/skills target/.claude/skills
```

**After** (2-3 lines):
```yaml
- run: ai-board/.github/scripts/setup-environment.sh target --phase full
- run: ai-board/.github/scripts/run-command.sh target install
- run: ai-board/.github/scripts/run-command.sh target test_unit
```

---

## Section 3: Universal Workflow Template

### Purpose
Adapt existing workflow YAMLs to use the setup layer and declare services dynamically.

### Service Management

GitHub Actions requires `services:` to be declared statically in YAML. Solution: declare all common services, enabled/disabled via inputs.

```yaml
on:
  workflow_dispatch:
    inputs:
      githubRepository:
        required: true
        type: string
      # ... existing inputs

      # New service inputs (read from config.yml by the dispatcher)
      needs_postgres:
        type: boolean
        default: false
      postgres_version:
        type: string
        default: "16"
      needs_redis:
        type: boolean
        default: false
      redis_version:
        type: string
        default: "7"
      needs_mysql:
        type: boolean
        default: false
      mysql_version:
        type: string
        default: "8"
      needs_mongo:
        type: boolean
        default: false
      mongo_version:
        type: string
        default: "7"

jobs:
  run:
    services:
      postgres:
        image: ${{ inputs.needs_postgres && format('postgres:{0}', inputs.postgres_version) || '' }}
        env:
          POSTGRES_DB: ${{ inputs.postgres_db }}
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
        options: ${{ inputs.needs_postgres && '--health-cmd pg_isready --health-interval 10s' || '' }}

      redis:
        image: ${{ inputs.needs_redis && format('redis:{0}', inputs.redis_version) || '' }}
        ports:
          - 6379:6379
```

Services with `image: ''` don't start — no overhead.

### App-side Dispatch

When the app dispatches a workflow via `handleTicketTransition()`, it reads the project config and passes the right inputs:

```typescript
// lib/workflows/service-inputs.ts — maps config.services[] to workflow inputs
// Generates: needs_{type}, {type}_version, {type}_db (when database is specified)
const serviceInputs = getProjectServiceInputs(project);

await octokit.actions.createWorkflowDispatch({
  owner: 'bfernandez31',
  repo: 'ai-board',
  workflow_id: 'speckit.yml',
  inputs: {
    githubRepository: `${project.githubOwner}/${project.githubRepo}`,
    // ... existing inputs
    ...serviceInputs,
  }
});
```

### How the App Accesses `config.yml`

Stored in DB with sync. Reasons:
- No GitHub API call on every dispatch (rate limit)
- Schema validation at import time with user alerts
- Config visible in project settings UI

Implementation: `config Json?` and `configSyncedAt DateTime?` fields on the `Project` model.

### Impacted Workflows

| Workflow | Services Used | Change |
|----------|--------------|--------|
| `speckit.yml` | none (specify/plan) or project-dependent (build) | Add service inputs + `setup-environment.sh` |
| `quick-impl.yml` | project-dependent | Same |
| `verify.yml` | project-dependent (tests) | Same |
| `ai-board-assist.yml` | project-dependent | Same |
| `iterate.yml` | project-dependent | Same |
| `deploy-preview.yml` | none | Just `setup-environment.sh` |
| `rollback-reset.yml` | none | Minimal, no tests |

### What Does NOT Change
- Workflow structure (steps, jobs, order)
- ai-board commands (`.claude-plugin/commands/`)
- `run-agent.sh` (just CLI install moves to `setup-environment.sh`)
- API callbacks (job status, ticket updates)
- Double-checkout pattern (ai-board sparse + target full)

---

## Section 4: Dogfooding — Migrate ai-board to Its Own Config

### Purpose
Before opening to external projects, ai-board becomes the first consumer of its own config. Validates everything works without breaking existing functionality.

### ai-board config file

```yaml
version: 1

project:
  name: "AI Board"
  language: typescript
  framework: nextjs

runtime:
  manager: bun
  manager_version: "1.2"
  node: "22"

services:
  postgres:
    version: "16"
    database: ai_board_test
    user: test
    password: test

commands:
  install: bun install
  build: bun run build
  lint: bun run lint
  type_check: bun run type-check
  test_unit: bun run test:unit
  test_integration: bun run test:integration
  test_e2e: bunx playwright test --config=playwright.ci.config.ts

env:
  DATABASE_URL: postgresql://test:test@localhost:5432/ai_board_test
  NODE_ENV: test
  TEST_MODE: "true"

agent:
  cli: claude-code
  model: claude-opus-4-7
```

### Migration Plan

1. Create config file + `setup-environment.sh` and `run-command.sh` scripts
2. Migrate ONE workflow first: `speckit.yml` (most complex, covers specify/plan/build)
3. Migrate remaining workflows one by one, validating E2E tests pass after each
4. Remove hardcoded duplicated setup code from workflows

### Success Criteria
- All ai-board workflows work by reading the config
- No hardcoded values (bun, node 22, postgres 16) remain in workflow YAMLs
- Existing E2E tests pass identically
- A ticket can traverse the full cycle INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP

---

## Section 5: Project Import — OAuth + Repo Picker

### Purpose
Allow users to import an existing GitHub repository as an ai-board project.

### OAuth Change

Expand GitHub OAuth scopes from `read:user user:email` to `read:user user:email repo`.

**Impact**:
- Existing users must re-authorize (GitHub prompts for new scope consent)
- OAuth token gives access to user's repos
- Same token serves repo picker AND config.yml fetching

**Token storage**: NextAuth currently does not persist the GitHub `access_token` server-side. Must add it in the `jwt` callback and expose it to API routes.

### Import Flow

```
User clicks "Import Project"
    ↓
Modal opens → Repo Picker
    ↓
Fetch repos via GitHub API (GET /user/repos + GET /user/orgs → GET /orgs/{org}/repos)
    ↓
Search/filter in list
    ↓
User selects a repo
    ↓
Validation:
  1. Repo accessible ✓
  2. User has admin rights (needed for secrets) ✓
  3. .ai-board/config.yml exists? → if not, proceed to generation
    ↓
Create project in DB:
  - name: repo name
  - key: auto-generated (3 chars) or user-chosen
  - githubOwner + githubRepo: from selection
  - config: config.yml contents (if existing)
    ↓
Redirect to project → Setup page / settings
```

### Repo Picker UI

Modal with:
- Org/personal dropdown filter
- Search field (client-side filter on fetched list)
- Repo list: name, description, visibility (public/private), last activity
- Pagination (GitHub API returns max 100 per page)

No repo creation, fork, or template. Import only.

### Missing `config.yml` Case

Normal case for newly imported projects. Flow chains to Section 6 (CLAUDE.md + config generation).

### Prisma Model Changes

```prisma
model Project {
  // Existing
  githubOwner    String
  githubRepo     String

  // New
  config         Json?     // Parsed .ai-board/config.yml content
  configSyncedAt DateTime? // Last config sync timestamp
}
```

### Config Sync

**When**:
- At import (initial)
- "Sync config" button in project settings
- Automatically before workflow dispatch (if `configSyncedAt` > 1h)

**How**:
- `GET /repos/{owner}/{repo}/contents/.ai-board/config.yml` via GitHub API
- Parse YAML, validate schema, store in DB
- If invalid → alert in project UI

### UI Changes
- Enable "Import Project" button in `app/projects/page.tsx`
- Keep "Create Project" disabled (or remove)
- Button opens repo picker modal

---

## Section 6: CLAUDE.md + constitution.md + config.yml Generation

### Purpose
When a user imports a repo without `.ai-board/config.yml`, generate the necessary files via a questionnaire then commit them to the repo.

### Flow

```
Project import complete (Section 5)
    ↓
.ai-board/config.yml exists?
    ↓ NO
Redirect to Setup page (/projects/[id]/setup)
    ↓
Step 1: Auto-detection (silent repo analysis)
    ↓
Step 2: Questionnaire (3-4 questions, pre-filled by detection)
    ↓
Step 3: Review + confirm
    ↓
Commit files to repo via GitHub API
    ↓
Sync config to DB
    ↓
Project ready → redirect to board
```

### Step 1: Auto-detection

At import, the app analyzes the repo via GitHub API to pre-fill the questionnaire:

| Detection | Method |
|-----------|--------|
| Language | `GET /repos/{owner}/{repo}/languages` (top language) |
| Framework | Read `package.json` → look for `next`, `express`, `fastapi` in deps |
| Package manager | Presence of `bun.lockb`, `yarn.lock`, `pnpm-lock.yaml`, `package-lock.json` |
| Node version | `.nvmrc`, `.node-version`, `engines` in package.json |
| Services | `docker-compose.yml` or `prisma/schema.prisma` (→ postgres likely) |
| Tests | Presence of `vitest.config`, `jest.config`, `pytest.ini`, `playwright.config` |
| Commands | `scripts` in package.json |

All via GitHub API Contents — no clone needed.

### Step 2: Questionnaire

Page `/projects/[id]/setup` — standard form (no websocket, no AI):

**Q1 — Stack** (pre-filled by detection)
- Language: dropdown (TypeScript, Python, Go, Rust, Java)
- Framework: contextual dropdown
- Package manager: dropdown

**Q2 — Services**
- Checkboxes: PostgreSQL, MySQL, Redis, MongoDB
- Version for each selected service

**Q3 — Commands**
- Pre-filled text fields from package.json scripts:
  - Install, Build, Lint, Type check, Test unit, Test integration, Test E2E
  - User corrects if needed

**Q4 — Agent**
- CLI: Claude Code / Codex (radio)
- Model: dropdown

### Step 3: Review + Commit

The app generates 3 files and shows them in preview:

**`.ai-board/config.yml`** — Generated from questionnaire answers.

**`CLAUDE.md`** — Template:
```markdown
# {Project Name} Development Guidelines

## Tech Stack
- **Language**: {language} {version}
- **Framework**: {framework}
- **Database**: {detected services}
- **Testing**: {detected test frameworks}
- **Package Manager**: {manager}

## Commands
{commands from config}

## Data Models
{if Prisma detected: "Read `prisma/schema.prisma` for all models."}

## Testing
{basic instructions based on test framework}
```

**`.ai-board/constitution.md`** — Default template:
```markdown
# Project Constitution

## Core Principles
- All code changes go through ai-board workflow stages
- Tests must pass before shipping
- AI-generated code must be reviewed

## Non-Negotiable Rules
- No commits directly to main branch
- No skipping VERIFY stage
- All PRs created by ai-board workflows
```

User reviews all 3 files, can edit inline, then confirms.

**Commit**: App commits files via GitHub API (`PUT /repos/{owner}/{repo}/contents/{path}`) on default branch. Single commit: `chore: initialize ai-board configuration`.

### Existing `config.yml` Case
- Skip setup wizard
- Fetch and store in DB
- Check if `CLAUDE.md` and `constitution.md` also exist
- If missing → offer to generate just the missing files

### Post-import Editing
Files live in user's repo. Editable:
- Directly in IDE/GitHub
- Via project settings in ai-board (extended settings page with editor per file)

"Sync config" button to update DB after changes.

---

## Section 7: Stripe Activation

### Purpose
Make billing functional end-to-end. Code already exists, needs configuration and validation.

### Already Implemented
- `Subscription` model (FREE/PRO/TEAM, statuses, grace period)
- Webhook handler `/api/webhooks/stripe` (checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.*)
- Billing page `/settings/billing` with plan cards
- Checkout session creation `/api/billing/checkout`
- Customer portal `/api/billing/portal`
- Plan limits enforcement
- `StripeEvent` idempotency model
- Usage endpoint `GET /api/billing/usage`

### Remaining Work

**1. Stripe Dashboard Configuration**
- Create products + prices (PRO $15/mo, TEAM $30/mo)
- Configure Customer Portal (cancel, upgrade, downgrade)
- Enable Stripe customer emails (receipts, payment failures)
- Configure webhook endpoint → `{APP_URL}/api/webhooks/stripe`

**2. Environment Variables**
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_TEAM_PRICE_ID=price_...
```

**3. End-to-end Validation Flows**
- FREE → Upgrade to PRO → Stripe Checkout → payment → webhook → subscription updated → limits unlocked
- PRO → Manage Subscription → Stripe Portal → downgrade/cancel → webhook → subscription updated
- Payment failure → webhook `invoice.payment_failed` → PAST_DUE → grace period
- Usage banner reflects correct plan after upgrade

**4. Stripe Emails (zero code)**
- Successful payments (receipt)
- Failed payments (retry notification)
- Subscription cancelled
- Upcoming renewal reminder

This section is primarily configuration + validation, not new code.

---

## Section 8: Profile Page + Delete Account

### Purpose
Settings page for users to view their info and delete their account.

### Page `/settings/profile`

Added to the existing settings hub (credentials, tokens, billing).

**Content — read-only:**
- Avatar (from GitHub)
- Name
- Email
- Linked GitHub account
- Registration date
- Current plan (link to billing)

No editing — everything comes from GitHub OAuth. Changes on GitHub reflect on next login.

### Delete Account

**Button**: "Delete my account" at bottom of profile page, danger zone (red border).

**Flow**:
```
Click "Delete my account"
    ↓
Confirmation modal:
  "This will permanently delete your account and all associated data:
   - X projects and their tickets
   - Your AI credentials
   - Your subscription (will be cancelled)
   - Your personal access tokens"
    ↓
Input: type email to confirm
    ↓
API call: DELETE /api/account
    ↓
Backend:
  1. Cancel Stripe subscription (if active)
  2. Call deleteUserAccount() (already exists in lib/)
  3. Invalidate session
    ↓
Redirect to landing page
```

**Already exists**: `deleteUserAccount()` in lib/ — handles cascade delete. Remaining work:
- Add Stripe cancellation before delete
- Create API endpoint `DELETE /api/account`
- Create UI (profile page + confirmation modal)

### Settings Navigation

Add "Profile" to settings menu, first position:
- **Profile** ← new
- AI Credentials
- Access Tokens
- Billing

---

## Related Tickets (Out of Scope)

- **AIB-441**: BYOK credential check missing on stage transition workflows

---

## Ticket Breakdown (Suggested)

| # | Ticket | Section | Dependencies |
|---|--------|---------|--------------|
| 1 | Define `.ai-board/config.yml` schema and validation | Section 1 | None |
| 2 | Create `setup-environment.sh` script | Section 2 | Ticket 1 |
| 3 | Create `run-command.sh` script | Section 2 | Ticket 1 |
| 4 | Add service inputs to workflow templates | Section 3 | Tickets 2, 3 |
| 5 | Update `handleTicketTransition()` to pass config inputs | Section 3 | Ticket 4 |
| 6 | Add `config` and `configSyncedAt` fields to Project model | Section 3 | Ticket 1 |
| 7 | Create ai-board own `config.yml` and migrate `speckit.yml` | Section 4 | Tickets 2, 3, 4 |
| 8 | Migrate remaining workflows to use setup layer | Section 4 | Ticket 7 |
| 9 | Expand GitHub OAuth scopes and persist access token | Section 5 | None |
| 10 | Build repo picker modal component | Section 5 | Ticket 9 |
| 11 | Create project import API and flow | Section 5 | Tickets 6, 10 |
| 12 | Build auto-detection for repo analysis | Section 6 | Ticket 9 |
| 13 | Build setup wizard (questionnaire + file generation) | Section 6 | Tickets 11, 12 |
| 14 | Implement config.yml commit via GitHub API | Section 6 | Ticket 13 |
| 15 | Configure Stripe products, prices, webhooks, and emails | Section 7 | None |
| 16 | Validate Stripe end-to-end flows | Section 7 | Ticket 15 |
| 17 | Create profile settings page | Section 8 | None |
| 18 | Implement delete account flow with Stripe cancellation | Section 8 | Ticket 17 |
