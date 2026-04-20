import { describe, it, expect, beforeEach } from "vitest";
import { getTestContext, type TestContext } from "@/tests/fixtures/vitest/setup";
import { getPrismaClient } from "@/tests/helpers/db-cleanup";
import { getHeatmapData } from "@/lib/db/activity";
import { Agent, JobStatus } from "@prisma/client";
import { subDays, startOfDay, endOfDay } from "date-fns";

describe("Heatmap Aggregation Integration", () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();
  const TEST_USER_ID = "test-user-id";

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    
    // Ensure test user exists
    await prisma.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        email: "test@e2e.local",
        name: "E2E Test User",
        updatedAt: new Date(),
      },
    });

    // Link project to test user
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { userId: TEST_USER_ID },
    });
  });

  it("should aggregate job counts and costs by day", async () => {
    const today = new Date();
    const yesterday = subDays(today, 1);
    
    // Create a ticket (needed for FK)
    const ticket = await ctx.createTicket();

    // Create some jobs
    await prisma.job.createMany({
      data: [
        {
          projectId: ctx.projectId,
          ticketId: ticket.id,
          command: "build",
          status: JobStatus.COMPLETED,
          startedAt: today,
          costUsd: 0.5,
          updatedAt: new Date(),
        },
        {
          projectId: ctx.projectId,
          ticketId: ticket.id,
          command: "verify",
          status: JobStatus.COMPLETED,
          startedAt: today,
          costUsd: 0.3,
          updatedAt: new Date(),
        },
        {
          projectId: ctx.projectId,
          ticketId: ticket.id,
          command: "build",
          status: JobStatus.COMPLETED,
          startedAt: yesterday,
          costUsd: 0.4,
          updatedAt: new Date(),
        },
      ],
    });

    const start = subDays(today, 7);
    const end = today;

    const result = await getHeatmapData({
      userId: TEST_USER_ID,
      start,
      end,
    });

    expect(result.stats.totalJobs).toBe(3);
    
    const todayStr = today.toISOString().split("T")[0];
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    
    const todayData = result.days.find(d => d.date === todayStr);
    const yesterdayData = result.days.find(d => d.date === yesterdayStr);

    expect(todayData?.jobCount).toBe(2);
    expect(todayData?.totalCost).toBeCloseTo(0.8);
    
    expect(yesterdayData?.jobCount).toBe(1);
    expect(yesterdayData?.totalCost).toBeCloseTo(0.4);
  });

  it("should aggregate shipped tickets correctly", async () => {
    const today = new Date();
    
    // Create a ticket
    const ticket = await ctx.createTicket();

    // Create 2 "ship" jobs for the same ticket on same day -> should count as 1 shipped ticket
    await prisma.job.createMany({
      data: [
        {
          projectId: ctx.projectId,
          ticketId: ticket.id,
          command: "ship",
          status: JobStatus.COMPLETED,
          startedAt: today,
          costUsd: 0.1,
          updatedAt: new Date(),
        },
        {
          projectId: ctx.projectId,
          ticketId: ticket.id,
          command: "ship",
          status: JobStatus.COMPLETED,
          startedAt: today,
          costUsd: 0.1,
          updatedAt: new Date(),
        },
      ],
    });

    const result = await getHeatmapData({
      userId: TEST_USER_ID,
      start: subDays(today, 1),
      end: today,
    });

    const todayStr = today.toISOString().split("T")[0];
    const todayData = result.days.find(d => d.date === todayStr);

    expect(todayData?.shippedTicketCount).toBe(1);
    expect(result.stats.totalShippedTickets).toBe(1);
  });

  it("should filter by agent correctly", async () => {
    const today = new Date();
    
    // Project has default agent CLAUDE
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { defaultAgent: Agent.CLAUDE },
    });

    // Ticket 1: Agent MISTRAL
    const ticketMistral = await prisma.ticket.create({
      data: {
        title: "Mistral Ticket",
        description: "Test",
        projectId: ctx.projectId,
        ticketNumber: 2,
        ticketKey: "TEST-2",
        agent: Agent.MISTRAL,
      },
    });

    // Ticket 2: Default Agent (CLAUDE)
    const ticketClaude = await prisma.ticket.create({
      data: {
        title: "Claude Ticket",
        description: "Test",
        projectId: ctx.projectId,
        ticketNumber: 3,
        ticketKey: "TEST-3",
        agent: null, // Should use project default
      },
    });

    await prisma.job.createMany({
      data: [
        {
          projectId: ctx.projectId,
          ticketId: ticketMistral.id,
          command: "build",
          status: JobStatus.COMPLETED,
          startedAt: today,
          costUsd: 0.1,
          updatedAt: new Date(),
        },
        {
          projectId: ctx.projectId,
          ticketId: ticketClaude.id,
          command: "build",
          status: JobStatus.COMPLETED,
          startedAt: today,
          costUsd: 0.1,
          updatedAt: new Date(),
        },
      ],
    });

    // Filter by MISTRAL
    const mistralResult = await getHeatmapData({
      userId: TEST_USER_ID,
      start: subDays(today, 1),
      end: today,
      agent: Agent.MISTRAL,
    });
    expect(mistralResult.stats.totalJobs).toBe(1);

    // Filter by CLAUDE
    const claudeResult = await getHeatmapData({
      userId: TEST_USER_ID,
      start: subDays(today, 1),
      end: today,
      agent: Agent.CLAUDE,
    });
    expect(claudeResult.stats.totalJobs).toBe(1);
  });
});
