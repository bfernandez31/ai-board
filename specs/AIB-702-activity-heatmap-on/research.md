# Research: Activity Heatmap

## Technical Context

### Database Models
- **Job**: Tracks AI activity. Key fields: `startedAt`, `completedAt`, `status`, `command`, `costUsd`, `ticketId`, `projectId`.
- **Ticket**: Associated with jobs. Key fields: `agent` (optional), `projectId`.
- **Project**: Key fields: `userId`, `defaultAgent`.
- **User**: Key fields: `createdAt`.

### Data Aggregation Strategy
- **Activity Count**: Number of `Job` records per day.
- **Shipped Tickets**: Count of distinct `ticketId` where `Job.command === 'ship'` and `Job.status === 'COMPLETED'` on that day.
- **Cost**: Sum of `Job.costUsd` per day.
- **Effective Agent**: `Ticket.agent ?? Project.defaultAgent`.

### Date Ranges
- **Last 12 Months**: Rolling 365/366 days from today.
- **Calendar Year**: Jan 1st to Dec 31st of the selected year.
- **Boundary Handling**: "Chipped" edges for days outside the period.

### UI Components
- **ActivityHeatmap**: New component.
- **ActivityHeatmapHeader**: Stats, Agent filter, Year selector.
- **ActivityHeatmapGrid**: The 7xN grid.
- **ActivityHeatmapCell**: Individual cell with tooltip.

## Existing Files

### Source Files
- `app/projects/page.tsx`: Main Projects page where the heatmap will be added.
- `components/projects/projects-container.tsx`: Container for project cards.
- `lib/db/projects.ts`: Project-related database access.
- `app/globals.css`: Contains Aurora theme styles (`.aurora-cell-pass`, etc.).

### Test Files
- `tests/integration/projects/projects-with-health.test.ts`: Integration test for projects list.
- `tests/unit/components/projects/`: Unit tests for project components.

## Patterns to Follow

### Error Handling
- Follow the pattern in `app/api/projects/route.ts`: Try-catch blocks in API routes returning structured error responses `{ error, code }`.
- Server components should handle errors gracefully (e.g., returning empty array on failure).

### Security
- Use `requireAuth()` from `lib/db/users.ts` to ensure data belongs to the authenticated user.
- Filtering by `userId` or project membership in all DB queries.

### State Management
- Use Next.js search parameters for filtering (agent, year) to ensure URL sync and server-side rendering compatibility.

## Decisions

- **Decision**: Create a new API route `/api/activity/heatmap` for fetching heatmap data.
- **Rationale**: Heatmap data can be large and might need to be refreshed independently when filters change, though initial load should be server-rendered.
- **Decision**: Use a 7x53 grid (approx) for the "Last 12 months" view, similar to GitHub.
- **Rationale**: Familiar UI for users.

## Needs Clarification

1. **Leap Years**: How exactly to handle the 366th day in leap years for the rolling 12-month view?
   - *Resolution*: Calculate days between start and end date exactly.
2. **Mobile View**: How to handle "chipped" edges with horizontal scroll?
   - *Resolution*: The grid will be a single scrollable container; labels will be `sticky`.
3. **Agent Filter**: Should it show all possible agents or only those with activity in the selected period?
   - *Resolution*: Spec says "distinct agents present in the user's jobs", which implies any job, but filtering it to the selected period might be better. I'll stick to all user's jobs for now as per FR-008.
