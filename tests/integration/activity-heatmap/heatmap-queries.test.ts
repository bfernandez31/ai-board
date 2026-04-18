import { beforeEach, describe, expect, it } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { getActivityHeatmapData } from '@/lib/activity-heatmap/queries';

/**
 * Heatmap queries are user-scoped (pull activity across ALL projects the user
 * can access), so we create a dedicated isolated user + project per test to
 * avoid cross-test contamination that the default worker project would share
 * with other integration tests.
 */

describe('getActivityHeatmapData', () => {
  const prisma = getPrismaClient();
  let userId: string;
  let projectId: number;
  let projectKey: string;

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    userId = `heatmap-user-${suffix}`;
    const email = `heatmap-${suffix}@project.e2e.test`;

    await prisma.user.create({
      data: {
        id: userId,
        email,
        name: 'Heatmap Test User',
        emailVerified: new Date(),
        updatedAt: new Date(),
        createdAt: new Date(Date.UTC(2023, 0, 1)),
      },
    });

    // Pick a unique, short key (max 6 chars) + unique owner/repo pair
    projectKey = `H${suffix.slice(-4).toUpperCase()}`;
    const project = await prisma.project.create({
      data: {
        key: projectKey,
        name: `[e2e] heatmap ${suffix}`,
        description: 'Isolated heatmap test project',
        githubOwner: `heatmap-${suffix}`,
        githubRepo: 'repo',
        userId,
        defaultAgent: Agent.CLAUDE,
        updatedAt: new Date(),
      },
    });
    projectId = project.id;
  });

  async function createTicket(params: {
    ticketNumber: number;
    ticketKey: string;
    title: string;
    agent?: Agent;
    stage?: Stage;
    workflowType?: WorkflowType;
  }) {
    return prisma.ticket.create({
      data: {
        projectId,
        title: params.title,
        description: 'heatmap fixture ticket',
        stage: params.stage ?? Stage.SHIP,
        workflowType: params.workflowType ?? WorkflowType.FULL,
        ticketNumber: params.ticketNumber,
        ticketKey: params.ticketKey,
        agent: params.agent,
        updatedAt: new Date(),
      },
    });
  }

  function daysAgo(n: number): Date {
    const d = new Date();
    d.setUTCHours(12, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - n);
    return d;
  }

  it('aggregates jobs and ship-command shipments, respecting cost incompleteness', async () => {
    const claudeTicket = await createTicket({
      ticketNumber: 1,
      ticketKey: 'HT-1',
      title: '[e2e] default claude',
    });
    const codexTicket = await createTicket({
      ticketNumber: 2,
      ticketKey: 'HT-2',
      title: '[e2e] explicit codex',
      agent: Agent.CODEX,
      workflowType: WorkflowType.QUICK,
    });
    const stageOnlyTicket = await createTicket({
      ticketNumber: 3,
      ticketKey: 'HT-3',
      title: '[e2e] stage SHIP without ship job',
    });

    await prisma.job.createMany({
      data: [
        // Claude ticket: implement (3d ago) + ship (3d ago) + failed verify (5d ago)
        {
          ticketId: claudeTicket.id,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: 0.5,
        },
        {
          ticketId: claudeTicket.id,
          projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: 0.25,
        },
        {
          ticketId: claudeTicket.id,
          projectId,
          command: 'verify',
          status: JobStatus.FAILED,
          startedAt: daysAgo(5),
          completedAt: daysAgo(5),
          updatedAt: daysAgo(5),
          costUsd: 0.05,
        },
        // Codex ticket: implement (null cost) + ship — on the same day
        {
          ticketId: codexTicket.id,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
          costUsd: null,
        },
        {
          ticketId: codexTicket.id,
          projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
          costUsd: 1.25,
        },
        // Stage SHIP but no ship command → must NOT count as shipped
        {
          ticketId: stageOnlyTicket.id,
          projectId,
          command: 'verify',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(1),
          completedAt: daysAgo(1),
          updatedAt: daysAgo(1),
          costUsd: 0.1,
        },
      ],
    });

    const data = await getActivityHeatmapData({
      userId,
      userCreatedAt: new Date(Date.UTC(2023, 0, 1)),
    });

    expect(data.totals.jobCount).toBe(6);
    expect(data.totals.ticketsShipped).toBe(2);

    expect(data.period.value).toBe('last-12m');
    expect(data.days.length).toBeGreaterThan(360);
    expect(data.days.length).toBeLessThanOrEqual(366);

    const codexShipDay = data.days.find((d) =>
      d.shippedTickets.some((t) => t.ticketKey === 'HT-2')
    );
    expect(codexShipDay).toBeDefined();
    expect(codexShipDay!.costIncomplete).toBe(true);
    expect(codexShipDay!.totalCost).toBe(1.25);
    expect(codexShipDay!.jobCount).toBe(2);

    const claudeShipDay = data.days.find((d) =>
      d.shippedTickets.some((t) => t.ticketKey === 'HT-1')
    );
    expect(claudeShipDay).toBeDefined();
    expect(claudeShipDay!.costIncomplete).toBe(false);
    expect(claudeShipDay!.totalCost).toBe(0.75);

    const shippedKeys = data.days.flatMap((d) => d.shippedTickets.map((t) => t.ticketKey));
    expect(shippedKeys).not.toContain('HT-3');

    // Agent filter dropdown includes CLAUDE + CODEX (both have activity)
    const agentValues = data.availableAgents.map((a) => a.value);
    expect(agentValues).toContain('all');
    expect(agentValues).toContain(Agent.CLAUDE);
    expect(agentValues).toContain(Agent.CODEX);
  });

  it('resolves the effective agent when filtering (project default fallback)', async () => {
    const claudeTicket = await createTicket({
      ticketNumber: 10,
      ticketKey: 'HT-C',
      title: '[e2e] implicit claude',
    });
    const codexTicket = await createTicket({
      ticketNumber: 11,
      ticketKey: 'HT-X',
      title: '[e2e] explicit codex',
      agent: Agent.CODEX,
    });

    await prisma.job.createMany({
      data: [
        {
          ticketId: claudeTicket.id,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
          costUsd: 0.3,
        },
        {
          ticketId: codexTicket.id,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
          costUsd: 0.4,
        },
      ],
    });

    const claudeOnly = await getActivityHeatmapData({
      userId,
      userCreatedAt: new Date(Date.UTC(2023, 0, 1)),
      filters: { period: 'last-12m', agent: Agent.CLAUDE },
    });
    expect(claudeOnly.totals.jobCount).toBe(1);

    const codexOnly = await getActivityHeatmapData({
      userId,
      userCreatedAt: new Date(Date.UTC(2023, 0, 1)),
      filters: { period: 'last-12m', agent: Agent.CODEX },
    });
    expect(codexOnly.totals.jobCount).toBe(1);

    const all = await getActivityHeatmapData({
      userId,
      userCreatedAt: new Date(Date.UTC(2023, 0, 1)),
      filters: { period: 'last-12m', agent: 'all' },
    });
    expect(all.totals.jobCount).toBe(2);
  });

  it('scopes results to a specific calendar year', async () => {
    const ticket = await createTicket({
      ticketNumber: 20,
      ticketKey: 'HT-Y',
      title: '[e2e] year 2024 ticket',
    });
    const mid2024 = new Date(Date.UTC(2024, 5, 15));

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'implement',
        status: JobStatus.COMPLETED,
        startedAt: mid2024,
        completedAt: mid2024,
        updatedAt: mid2024,
        costUsd: 0.5,
      },
    });
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'verify',
        status: JobStatus.COMPLETED,
        startedAt: daysAgo(0),
        completedAt: daysAgo(0),
        updatedAt: daysAgo(0),
        costUsd: 0.2,
      },
    });

    const data2024 = await getActivityHeatmapData({
      userId,
      userCreatedAt: new Date(Date.UTC(2023, 0, 1)),
      filters: { period: '2024', agent: 'all' },
    });

    expect(data2024.period.startDate).toBe('2024-01-01');
    expect(data2024.period.endDate).toBe('2024-12-31');
    expect(data2024.totals.jobCount).toBe(1);
  });

  it('builds period options from the user creation year', async () => {
    const now = new Date(Date.UTC(2026, 3, 18));

    const data = await getActivityHeatmapData({
      userId,
      userCreatedAt: new Date(Date.UTC(2024, 5, 1)),
      now,
    });

    expect(data.periodOptions[0]).toEqual({ value: 'last-12m', label: 'Last 12 months' });
    expect(data.periodOptions.slice(1)).toEqual([
      { value: '2026', label: '2026' },
      { value: '2025', label: '2025' },
      { value: '2024', label: '2024' },
    ]);
  });

  it('returns only the rolling option when user was created this year', async () => {
    const now = new Date(Date.UTC(2026, 3, 18));
    const data = await getActivityHeatmapData({
      userId,
      userCreatedAt: new Date(Date.UTC(2026, 0, 5)),
      now,
    });

    expect(data.periodOptions).toHaveLength(1);
    expect(data.periodOptions[0]).toEqual({ value: 'last-12m', label: 'Last 12 months' });
  });
});
