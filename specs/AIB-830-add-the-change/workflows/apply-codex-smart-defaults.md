# Internal Process: Apply Codex Smart Defaults

**Feature**: AIB-830
**Date**: 2026-05-29
**Spec reference**: `spec.md` → Internal Processes → "Apply Codex Smart Defaults"

## Process overview

When a project owner (or member, per existing access rules) clicks "Apply smart defaults" on a Codex project, the application atomically writes `CODEX_SMART_DEFAULTS` to the project's 5 `codex*Model` columns and returns the resulting values. The endpoint is the existing `POST /api/projects/:projectId/model-config/apply-smart-defaults`; the change is purely in its body — it now branches on `defaultAgent` and writes Codex columns when appropriate.

## Inputs

| Name | Type | Source |
|------|------|--------|
| `projectId` | `number` | URL path param |
| (auth) | session via `request` | NextAuth session cookie / `x-test-user-id` for tests |
| Effective agent | implicit | Read from `project.defaultAgent` after auth — determines which column set is written |

## Phases

1. **Parse and validate `projectId`** — reject non-numeric with `400 Bad Request`.
2. **Authorize** — `verifyProjectAccess(projectId, request)` (owner OR member). On failure, return `404 Not Found` (anti-enumeration). On no session, return `401 Unauthorized`.
3. **Read agent** — `const project = await prisma.project.findUnique({ where: { id: projectId }, select: { defaultAgent: true } })`. If `defaultAgent` is neither `CLAUDE` nor `CODEX`, return `400 Bad Request` with code `UNSUPPORTED_AGENT_FOR_SMART_DEFAULTS`.
4. **Atomic write** — single `prisma.project.update`:
   - When agent is CLAUDE (existing path, unchanged): `data: { ...SMART_DEFAULTS }`, `select` the 5 Claude columns.
   - When agent is CODEX (new path): `data: { ...CODEX_SMART_DEFAULTS }`, `select` the 5 Codex columns.
5. **Return** the selected columns as JSON.

## Output

A JSON object with the 5 columns of the active agent set to their smart-default values. Shape varies by agent (see `contracts/project-codex-model-config.md`).

## Error behavior

- `400 Bad Request` — invalid `projectId`, or `defaultAgent` is MISTRAL/GEMINI.
- `401 Unauthorized` — no session.
- `404 Not Found` — caller not an owner/member.
- `500 Internal Server Error` — Prisma exception (logged via existing `console.error('apply-smart-defaults POST error:', error)` at `route.ts:45`).

**Partial application is impossible**: the 5-column write is a single `update` statement (atomic at the Postgres row level).

**Idempotent**: a second call with the same agent yields identical state. The endpoint can be called repeatedly without consequence.

## Pattern adherence

- **Pattern P4 (atomic single-transaction write)** from `research.md` — preserved by using one `prisma.project.update` per agent. NEVER decompose into 5 per-column updates.
- **Pattern P6 (authorization parity)** — same `verifyProjectAccess` helper as the Claude path.

## Reference implementation sketch

```ts
// app/api/projects/[projectId]/model-config/apply-smart-defaults/route.ts (extended)
import { SMART_DEFAULTS } from '@/lib/models/claude-models';
import { CODEX_SMART_DEFAULTS } from '@/lib/models/codex-models';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const parsedProjectId = parseInt(projectId, 10);
    if (isNaN(parsedProjectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    await verifyProjectAccess(parsedProjectId, request);

    const { defaultAgent } = await prisma.project.findUniqueOrThrow({
      where: { id: parsedProjectId },
      select: { defaultAgent: true },
    });

    if (defaultAgent === Agent.CLAUDE) {
      const updated = await prisma.project.update({
        where: { id: parsedProjectId },
        data: { ...SMART_DEFAULTS },
        select: {
          specifyModel: true,
          planModel: true,
          implementModel: true,
          quickImplModel: true,
          verifyModel: true,
        },
      });
      return NextResponse.json(updated);
    }

    if (defaultAgent === Agent.CODEX) {
      const updated = await prisma.project.update({
        where: { id: parsedProjectId },
        data: { ...CODEX_SMART_DEFAULTS },
        select: {
          codexSpecifyModel: true,
          codexPlanModel: true,
          codexImplementModel: true,
          codexQuickImplModel: true,
          codexVerifyModel: true,
        },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json(
      {
        error: 'Smart defaults are only available for Claude or Codex projects.',
        code: 'UNSUPPORTED_AGENT_FOR_SMART_DEFAULTS',
      },
      { status: 400 }
    );
  } catch (error) {
    // existing error handling: 404 for "Project not found", 401 for Unauthorized, 500 fallthrough
    // … unchanged …
  }
}
```
