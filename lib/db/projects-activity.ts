/**
 * Project activity scoring & sorting (AIB-713).
 *
 * A project's "last activity" is the most recent timestamp across:
 *   - project.updatedAt            — direct edits to the project
 *   - MAX(ticket.updatedAt)        — ticket state transitions & ticket edits
 *                                    (Prisma @updatedAt bumps on stage changes)
 *   - MAX(job.startedAt)           — last workflow execution
 *
 * Projects with no ticket/job activity fall back to project.updatedAt, which
 * naturally places long-dormant projects at the bottom of the list.
 */

export interface ProjectWithActivity {
  id: number;
  updatedAt: Date;
  lastTicketUpdatedAt: Date | null;
  lastJobStartedAt: Date | null;
}

export function computeLastActivityAt(
  projectUpdatedAt: Date,
  lastTicketUpdatedAt: Date | null,
  lastJobStartedAt: Date | null,
): Date {
  let max = projectUpdatedAt;
  if (lastTicketUpdatedAt && lastTicketUpdatedAt > max) max = lastTicketUpdatedAt;
  if (lastJobStartedAt && lastJobStartedAt > max) max = lastJobStartedAt;
  return max;
}

export function sortProjectsByActivity<T extends ProjectWithActivity>(
  projects: readonly T[],
): T[] {
  return [...projects].sort((a, b) => {
    const aAt = computeLastActivityAt(a.updatedAt, a.lastTicketUpdatedAt, a.lastJobStartedAt);
    const bAt = computeLastActivityAt(b.updatedAt, b.lastTicketUpdatedAt, b.lastJobStartedAt);
    const diff = bAt.getTime() - aAt.getTime();
    if (diff !== 0) return diff;
    return b.id - a.id;
  });
}
