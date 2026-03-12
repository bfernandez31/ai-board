# System Architecture Overview

## Application Architecture

### Framework & Runtime
- **Next.js 16**: App Router architecture for file-based routing and server-side rendering
- **Node.js 22.20.0 LTS**: Server runtime environment
- **React 18**: Component-based UI library
- **TypeScript 5.6**: Strict mode for type safety

### Architectural Patterns

#### Server-Side Architecture
- **App Router**: Next.js App Router with RSC (React Server Components)
- **API Routes**: RESTful API endpoints in `app/api/` directory
- **Server Actions**: Not used; API routes preferred for explicit data flow
- **Middleware**: NextAuth.js middleware for authentication

#### Client-Side Architecture
- **Component-Based**: React functional components with hooks
- **State Management**: TanStack Query v5 for server state
- **Real-Time Updates**: Client-side polling (2-second intervals)
- **Optimistic Updates**: Immediate UI updates with rollback on failure

#### Database Layer
- **PostgreSQL 14+**: Relational database
- **Prisma 6.x**: Type-safe ORM with schema migrations
- **Connection Pooling**: Managed by Prisma Client
- **Transactions**: Used for atomic operations (Job + Ticket updates)

### Project Structure

```
ai-board/
├── app/                          # Next.js App Router
│   ├── api/                      # RESTful API endpoints
│   │   ├── projects/             # Project-scoped APIs
│   │   └── jobs/                 # Job status updates
│   ├── lib/                      # Shared utilities
│   │   ├── db/                   # Database utilities
│   │   ├── hooks/                # React hooks
│   │   │   ├── queries/          # TanStack Query hooks
│   │   │   └── mutations/        # Mutation hooks
│   │   ├── schemas/              # Zod validation schemas
│   │   ├── workflows/            # Workflow orchestration
│   │   └── utils/                # Helper functions
│   ├── projects/[projectId]/     # Project-scoped pages
│   │   └── board/                # Kanban board
│   ├── legal/                    # Legal pages (public)
│   │   ├── terms/                # Terms of Service
│   │   └── privacy/              # Privacy Policy
│   └── auth/                     # Authentication pages
├── components/                   # React components
│   ├── board/                    # Board components
│   ├── layout/                   # Layout components (Header, Footer)
│   ├── ui/                       # shadcn/ui components
│   └── ...                       # Feature components
├── prisma/                       # Database layer
│   ├── schema.prisma             # Database schema
│   ├── migrations/               # Migration history
│   └── seed.ts                   # Test data seeding
├── tests/                        # Test suite
│   ├── api/                      # API contract tests
│   ├── e2e/                      # End-to-end tests
│   ├── unit/                     # Unit tests
│   └── helpers/                  # Test utilities
├── .github/workflows/            # GitHub Actions
│   ├── speckit.yml               # Main workflow
│   ├── quick-impl.yml            # Quick-impl workflow
│   ├── verify.yml                # Verification workflow
│   ├── cleanup.yml               # Technical debt cleanup
│   ├── iterate.yml               # Minor fixes during VERIFY
│   ├── ai-board-assist.yml       # AI assistance workflow
│   ├── auto-ship.yml             # Auto-deployment workflow
│   ├── deploy-preview.yml        # Vercel preview deployment
│   └── rollback-reset.yml        # VERIFY→PLAN rollback
├── .github/scripts/              # Shared shell utilities for workflows
│   ├── run-agent.sh              # Unified agent runner (Claude/Codex)
│   ├── fetch-telemetry.sh        # Pre-fetch job telemetry for /compare
│   └── setup-test-env.sh         # Prepare test environment
├── .claude-plugin/               # Claude Code plugin (full content)
│   ├── plugin.json               # Plugin manifest
│   ├── commands/                 # Slash commands (ai-board.*)
│   ├── scripts/                  # Workflow scripts
│   │   └── bash/                 # Bash scripts
│   └── templates/                # Spec/plan/task templates
└── .ai-board/                    # Project-specific content
    └── memory/                   # Constitution and memory
        └── constitution.md       # Project conventions
```

### Data Flow Patterns

#### Request Flow (API)
```
Client Request
  → Next.js API Route
  → Zod Validation
  → Authentication Check (NextAuth session)
  → Authorization Check (Project ownership)
  → Prisma Database Query
  → Response with Data
```

#### Optimistic Update Flow
```
User Action (Drag-and-drop)
  → Optimistic UI Update (Immediate)
  → TanStack Query Mutation
  → API Request
  → Success: Merge server response
  → Failure: Rollback to previous state
```

#### Workflow Automation Flow
```
Stage Transition
  → Validate Job Completion (if applicable)
  → Create Job Record (status: PENDING)
  → Dispatch GitHub Actions Workflow
  → Update Ticket Stage
  → Workflow Executes:
    → Sparse checkout ai-board (only .claude-plugin/)
    → Full checkout target repository
    → Symlink commands to target/.claude/
    → Run Claude Code with ai-board commands
  → Workflow Updates Job Status
  → Client Polls for Status Updates
```

**Sparse Checkout Pattern**:
- ai-board is always checked out from `main` branch (stable commands)
- Only `.claude-plugin/` and `.github/scripts/` directories are fetched (~1MB vs ~100MB)
- Commands are symlinked to `target/.claude/commands/` for Claude to discover
- Even when ai-board works on itself, it uses stable commands from main

### Multi-Tenancy Pattern

#### Project Isolation
- Every project belongs to exactly one user (required `userId` foreign key)
- All API routes validate project ownership before operations
- User ID extracted from NextAuth session
- Cross-user access blocked with 403 Forbidden

#### URL Structure

**Page Routes**:
```
/                                      # Public landing page
/auth/signin                           # Sign-in page
/projects/{projectId}/board          # Board view
/ticket/{ticketKey}                  # Direct ticket access (redirects to board with modal)
/settings/billing                    # Authenticated billing management
/legal/terms                         # Terms of Service (public, no auth required)
/legal/privacy                       # Privacy Policy (public, no auth required)
```

**API Routes**:
```
/api/projects/{projectId}/tickets    # Tickets API
/api/projects/{projectId}/jobs/status # Job polling
/api/billing/plans                   # Plan metadata for billing UI
/api/billing/checkout                # Stripe Checkout session creation
/api/billing/portal                  # Stripe Customer Portal session creation
/api/billing/subscription            # Current subscription details
/api/billing/usage                   # Current plan usage and limits
```

**Ticket Navigation Flow**:
- Direct ticket URLs (`/ticket/ABC-123`) redirect to board with query parameters
- Redirect format: `/projects/{projectId}/board?ticket={ticketKey}&modal=open`
- Board component detects `modal=open` parameter and automatically opens ticket modal
- URL parameters cleaned up after modal opens to prevent re-opening on page refresh

### Public Marketing Surface

- The landing page is a server-rendered marketing route composed from section components in `components/landing/`
- `app/landing/page.tsx` renders the hero, features, workflow, pricing, and CTA sections in order
- The pricing section is a static UI component that renders plan cards and FAQ content without calling billing APIs
- Footer navigation includes a `/#pricing` anchor so users can jump directly to the pricing section from any page

**Pricing Entry Flow**:
```typescript
export default function LandingPage(): React.JSX.Element {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <FeaturesGrid />
      <WorkflowSection />
      <PricingSection />
      <CTASection />
    </div>
  );
}
```

**Pricing Section Characteristics**:
- Implemented in `components/landing/pricing-section.tsx`
- Uses shadcn/ui `Card`, `Badge`, and `Button` primitives plus `lucide-react` check icons
- Stores marketing plan content in local typed arrays (`plans`, `faqItems`) inside the component module
- Sends all CTA clicks to `/auth/signin`; subscription creation remains isolated to the authenticated billing area

#### Authorization Pattern
```typescript
// Extract user from session
const session = await getServerSession();
const userId = session.user.id;

// Verify project ownership
const project = await prisma.project.findFirst({
  where: { id: projectId, userId }
});

if (!project) {
  // 404 if project doesn't exist
  // 403 if belongs to different user
  return error;
}
```

### External Integrations

#### GitHub Actions Integration
- **Workflow Dispatch**: Octokit REST API (`@octokit/rest`)
- **Authentication**: GitHub `GITHUB_TOKEN` (automatic) + `WORKFLOW_API_TOKEN` (custom)
- **Workflow Files**: `.github/workflows/*.yml`
- **Communication**: Bidirectional API calls (dispatch → execute → status update)

#### Cloudinary CDN Integration
- **SDK**: Cloudinary Node.js v2
- **Usage**: Image storage for ticket attachments
- **Folder Structure**: `ai-board/tickets/{ticketId}/`
- **Authentication**: Cloud name, API key, API secret (environment variables)
- **Cleanup**: Automatic deletion on image replace/remove

#### Vercel Deployment Integration
- **Trigger**: `deployment_status` GitHub webhook event
- **Auto-Ship Workflow**: Automatically transitions VERIFY → SHIP on production deployment
- **Git Ancestry**: Uses `git merge-base --is-ancestor` to verify branch inclusion

### Design Patterns

#### Repository Pattern (Implicit via Prisma)
- Prisma Client acts as repository layer
- Type-safe queries with TypeScript
- Transaction support for atomic operations

#### Factory Pattern
- Query key factory (`lib/query-keys.ts`)
- Hierarchical key structure for cache invalidation

#### Observer Pattern
- TanStack Query subscriptions
- Real-time polling for job status updates

#### Strategy Pattern
- Clarification policies (AUTO, CONSERVATIVE, PRAGMATIC, INTERACTIVE)
- Workflow type (FULL vs QUICK)

#### State Machine Pattern
- Job status transitions (PENDING → RUNNING → COMPLETED/FAILED/CANCELLED)
- Terminal state protection with idempotent updates

### Performance Optimization

#### Caching Strategy
- **TanStack Query**: Client-side cache with intelligent invalidation
- **Dependency Caching**: GitHub Actions caches (node_modules, Playwright browsers)
- **Database Indexes**: Strategic indexes on frequently queried columns

#### Query Optimization
- Composite indexes: `(ticketId, status, startedAt)`, `(projectId, workflowType)`
- Select only required fields (no SELECT *)
- Pagination for large result sets (though not currently implemented)

#### Network Optimization
- Optimistic updates reduce perceived latency
- Batch API calls when possible
- Polling stops when all jobs terminal (resource efficiency)

### Error Handling Philosophy

#### Client-Side
- **Optimistic Updates**: Show changes immediately, rollback on error
- **User Feedback**: Toast notifications for success/error states
- **Retry Logic**: Exponential backoff for network errors
- **Validation**: Zod schemas on client and server (double validation)

#### Server-Side
- **Structured Errors**: Consistent error response format
- **HTTP Status Codes**: Proper use (400, 401, 403, 404, 500)
- **Logging**: All operations logged for debugging
- **State Machine**: Invalid transitions return descriptive errors

### Security Architecture

#### Authentication Layer
- **NextAuth.js**: Session-based authentication
- **OAuth Providers**: GitHub OAuth (production), mock auth (dev/test)
- **Session Storage**: Database-backed sessions
- **CSRF Protection**: NextAuth built-in protection

#### Authorization Layer
- **User-Project Ownership**: Required `userId` foreign key
- **Server-Side Validation**: All API routes validate ownership
- **Project Scoping**: All operations filtered by project ID + user ID
- **Workflow Authentication**: Bearer token for GitHub Actions workflows

#### Data Protection
- **User Isolation**: Complete separation between users
- **Input Validation**: Zod schemas prevent malformed data
- **XSS Prevention**: React's built-in escaping + react-markdown HTML escaping
- **SQL Injection**: Prisma parameterized queries

### Scalability Considerations

#### Current Limitations
- Single PostgreSQL instance (no read replicas)
- Client-side polling (not WebSockets/SSE due to serverless)
- No pagination on ticket lists (assumes <1000 tickets per project)

#### Future Scalability Paths
- Database read replicas for read-heavy operations
- Redis cache for job status (reduce database polling)
- WebSocket server for real-time updates (if moving off serverless)
- Background job queue for long-running operations

### Deployment Architecture

#### Vercel Platform
- **Serverless Functions**: API routes run as serverless functions
- **Edge Network**: Global CDN for static assets
- **Environment**: Production, preview, development
- **Limitations**: No long-lived connections (hence polling vs SSE)

#### GitHub Actions
- **Runners**: Ubuntu-latest (cloud-hosted)
- **Environment Setup**: Node.js 22, Python 3.11, PostgreSQL, Playwright
- **Secrets**: ANTHROPIC_API_KEY, WORKFLOW_API_TOKEN
- **Artifacts**: Spec/plan/task files committed to feature branches

#### PostgreSQL Hosting
- **Provider**: Not specified (could be Vercel Postgres, Neon, Supabase, etc.)
- **Connection**: Via `DATABASE_URL` environment variable
- **Pooling**: Managed by Prisma connection pooler

### Monitoring & Observability

#### Logging Strategy
- **Server Logs**: Console.log/error for debugging (streamed to Vercel)
- **Client Errors**: React error boundaries
- **Workflow Logs**: GitHub Actions logs (visible in Actions tab)
- **Job Logs**: Stored in Job.logs field (unlimited text)

#### Performance Metrics
- **Target Latency**: <100ms for API responses (p95)
- **Polling Interval**: 2 seconds (real-time updates)
- **Workflow Timeout**: 120 minutes maximum
- **Database Query Performance**: <50ms for indexed queries

#### OTLP Telemetry Collection
- **Protocol**: Claude Code and Codex agents export telemetry via OTLP HTTP JSON to `/api/telemetry/v1/logs`
- **Metrics per Job**: Input/output/cached tokens, cost, duration, model, tools used
- **Cost Tracking**: Real cost reported by Claude agent; estimated from OpenAI API pricing for Codex
- **Configuration**: Agent runner script (`run-agent.sh`) configures OTLP endpoints and env vars per agent type

### Testing Strategy

#### Test Pyramid
- **Unit Tests**: Isolated component and utility tests (Vitest)
- **API Tests**: Contract validation (Playwright)
- **Integration Tests**: Multi-component interactions (Playwright)
- **E2E Tests**: Full user workflows (Playwright)

#### Test Data Isolation
- **Prefix Pattern**: `[e2e]` for all test-generated data
- **Selective Cleanup**: Deletes only prefixed data
- **Reserved Projects**: Projects 1-2 for tests, Project 3 for development
- **Test User**: Consistent `test@e2e.local` across all tests
