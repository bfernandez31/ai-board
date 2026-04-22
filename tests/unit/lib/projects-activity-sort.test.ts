/**
 * Unit tests for project activity sorting (AIB-713).
 *
 * Projects on the projects page are ordered by recent activity — the most
 * recent timestamp across: the project itself, its tickets (state transitions
 * bump ticket.updatedAt via @updatedAt), and its jobs (last workflow run).
 */
import { describe, it, expect } from 'vitest';
import {
  computeLastActivityAt,
  sortProjectsByActivity,
  type ProjectWithActivity,
} from '@/lib/db/projects-activity';

describe('computeLastActivityAt', () => {
  it('returns project.updatedAt when no ticket or job activity exists', () => {
    const projectUpdated = new Date('2026-01-10T00:00:00Z');
    const result = computeLastActivityAt(projectUpdated, null, null);
    expect(result.toISOString()).toBe(projectUpdated.toISOString());
  });

  it('picks the latest ticket updatedAt when newer than project', () => {
    const projectUpdated = new Date('2026-01-01T00:00:00Z');
    const ticketUpdated = new Date('2026-02-01T00:00:00Z');
    const result = computeLastActivityAt(projectUpdated, ticketUpdated, null);
    expect(result.toISOString()).toBe(ticketUpdated.toISOString());
  });

  it('picks the latest job startedAt when newer than project and tickets', () => {
    const projectUpdated = new Date('2026-01-01T00:00:00Z');
    const ticketUpdated = new Date('2026-02-01T00:00:00Z');
    const jobStarted = new Date('2026-03-01T00:00:00Z');
    const result = computeLastActivityAt(projectUpdated, ticketUpdated, jobStarted);
    expect(result.toISOString()).toBe(jobStarted.toISOString());
  });

  it('picks the project updatedAt when it is the most recent signal', () => {
    const projectUpdated = new Date('2026-04-01T00:00:00Z');
    const ticketUpdated = new Date('2026-02-01T00:00:00Z');
    const jobStarted = new Date('2026-03-01T00:00:00Z');
    const result = computeLastActivityAt(projectUpdated, ticketUpdated, jobStarted);
    expect(result.toISOString()).toBe(projectUpdated.toISOString());
  });
});

describe('sortProjectsByActivity', () => {
  const baseProject = {
    id: 0,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    lastTicketUpdatedAt: null,
    lastJobStartedAt: null,
  } satisfies ProjectWithActivity;

  it('orders projects from most active to least active', () => {
    const projects: ProjectWithActivity[] = [
      { ...baseProject, id: 1, updatedAt: new Date('2026-01-01T00:00:00Z') },
      {
        ...baseProject,
        id: 2,
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        lastTicketUpdatedAt: new Date('2026-03-01T00:00:00Z'),
      },
      {
        ...baseProject,
        id: 3,
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        lastJobStartedAt: new Date('2026-04-15T00:00:00Z'),
      },
    ];

    const sorted = sortProjectsByActivity(projects);
    expect(sorted.map((p) => p.id)).toEqual([3, 2, 1]);
  });

  it('places projects with no ticket/job activity at the bottom when project.updatedAt is old', () => {
    const projects: ProjectWithActivity[] = [
      {
        ...baseProject,
        id: 10,
        updatedAt: new Date('2020-01-01T00:00:00Z'),
      },
      {
        ...baseProject,
        id: 11,
        updatedAt: new Date('2020-01-01T00:00:00Z'),
        lastTicketUpdatedAt: new Date('2026-04-01T00:00:00Z'),
      },
    ];

    const sorted = sortProjectsByActivity(projects);
    expect(sorted.map((p) => p.id)).toEqual([11, 10]);
  });

  it('breaks ties deterministically by project id (desc)', () => {
    const sameDate = new Date('2026-04-01T00:00:00Z');
    const projects: ProjectWithActivity[] = [
      { ...baseProject, id: 5, updatedAt: sameDate },
      { ...baseProject, id: 7, updatedAt: sameDate },
      { ...baseProject, id: 3, updatedAt: sameDate },
    ];

    const sorted = sortProjectsByActivity(projects);
    expect(sorted.map((p) => p.id)).toEqual([7, 5, 3]);
  });

  it('does not mutate the input array', () => {
    const projects: ProjectWithActivity[] = [
      { ...baseProject, id: 1, updatedAt: new Date('2026-01-01T00:00:00Z') },
      { ...baseProject, id: 2, updatedAt: new Date('2026-03-01T00:00:00Z') },
    ];
    const original = projects.map((p) => p.id);
    sortProjectsByActivity(projects);
    expect(projects.map((p) => p.id)).toEqual(original);
  });
});
