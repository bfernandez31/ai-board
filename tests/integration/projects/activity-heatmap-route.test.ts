import { Agent, JobStatus, Stage, WorkflowType } from "@prisma/client"
import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it } from "vitest"
import { GET } from "@/app/api/projects/activity-heatmap/route"
import { TEST_AUTH_OVERRIDE_HEADER, TEST_USER_HEADER } from "@/lib/auth/test-user-override"
import { getTestContext, type TestContext } from "@/tests/fixtures/vitest/setup"
import { getPrismaClient, getTestUserId } from "@/tests/helpers/db-cleanup"

describe("GET /api/projects/activity-heatmap", () => {
  const prisma = getPrismaClient()
  let ctx: TestContext

  beforeEach(async () => {
    ctx = await getTestContext()
    await ctx.cleanup()
  })

  async function seedHeatmapFixtures() {
    const ownerId = await getTestUserId()
    const memberUser = await ctx.createUser("member-heatmap@project.e2e.test")
    const outsiderUser = await ctx.createUser("outsider-heatmap@project.e2e.test")

    await prisma.user.update({
      where: { id: ownerId },
      data: {
        createdAt: new Date("2025-01-15T00:00:00.000Z"),
        updatedAt: new Date(),
      },
    })

    await prisma.project.update({
      where: { id: ctx.projectId },
      data: {
        userId: ownerId,
        defaultAgent: Agent.CLAUDE,
        updatedAt: new Date(),
      },
    })

    const memberProject = await prisma.project.create({
      data: {
        name: "[e2e] Member Heatmap Project",
        description: "Accessible through membership",
        githubOwner: "test",
        githubRepo: `member-heatmap-${Date.now()}`,
        key: `MH${Date.now().toString().slice(-4)}`,
        userId: memberUser.id,
        defaultAgent: Agent.CODEX,
        updatedAt: new Date(),
      },
    })

    await prisma.projectMember.create({
      data: {
        projectId: memberProject.id,
        userId: ownerId,
        role: "member",
      },
    })

    const outsiderProject = await prisma.project.create({
      data: {
        name: "[e2e] Hidden Heatmap Project",
        description: "Not accessible",
        githubOwner: "test",
        githubRepo: `hidden-heatmap-${Date.now()}`,
        key: `HH${Date.now().toString().slice(-4)}`,
        userId: outsiderUser.id,
        defaultAgent: Agent.MISTRAL,
        updatedAt: new Date(),
      },
    })

    const tickets = await prisma.ticket.createManyAndReturn({
      data: [
        {
          projectId: ctx.projectId,
          title: "[e2e] owned ship ticket",
          description: "owned ship ticket",
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 1,
          ticketKey: "E2E-1",
          updatedAt: new Date("2026-04-19T10:00:00.000Z"),
        },
        {
          projectId: memberProject.id,
          title: "[e2e] member codex ticket",
          description: "member codex ticket",
          stage: Stage.BUILD,
          workflowType: WorkflowType.QUICK,
          ticketNumber: 1,
          ticketKey: "MHP-1",
          updatedAt: new Date("2026-04-18T10:00:00.000Z"),
          agent: Agent.CODEX,
        },
        {
          projectId: outsiderProject.id,
          title: "[e2e] hidden outsider ticket",
          description: "hidden outsider ticket",
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 1,
          ticketKey: "HHP-1",
          updatedAt: new Date("2026-04-17T10:00:00.000Z"),
          agent: Agent.MISTRAL,
        },
      ],
    })

    const byKey = new Map(tickets.map((ticket) => [ticket.ticketKey, ticket.id]))

    await prisma.job.createMany({
      data: [
        {
          ticketId: byKey.get("E2E-1")!,
          projectId: ctx.projectId,
          command: "ship",
          status: JobStatus.COMPLETED,
          startedAt: new Date("2026-04-19T10:00:00.000Z"),
          completedAt: new Date("2026-04-19T11:00:00.000Z"),
          updatedAt: new Date("2026-04-19T11:00:00.000Z"),
          costUsd: 1.5,
          durationMs: 1000,
        },
        {
          ticketId: byKey.get("E2E-1")!,
          projectId: ctx.projectId,
          command: "ship",
          status: JobStatus.COMPLETED,
          startedAt: new Date("2026-04-19T12:00:00.000Z"),
          completedAt: new Date("2026-04-19T12:30:00.000Z"),
          updatedAt: new Date("2026-04-19T12:30:00.000Z"),
          costUsd: null,
          durationMs: 1000,
        },
        {
          ticketId: byKey.get("MHP-1")!,
          projectId: memberProject.id,
          command: "implement",
          status: JobStatus.FAILED,
          startedAt: new Date("2026-04-18T08:00:00.000Z"),
          completedAt: new Date("2026-04-18T08:45:00.000Z"),
          updatedAt: new Date("2026-04-18T08:45:00.000Z"),
          costUsd: 2.75,
          durationMs: 1000,
        },
        {
          ticketId: byKey.get("HHP-1")!,
          projectId: outsiderProject.id,
          command: "ship",
          status: JobStatus.COMPLETED,
          startedAt: new Date("2026-04-17T08:00:00.000Z"),
          completedAt: new Date("2026-04-17T08:45:00.000Z"),
          updatedAt: new Date("2026-04-17T08:45:00.000Z"),
          costUsd: 9.99,
          durationMs: 1000,
        },
      ],
    })
  }

  async function buildAuthHeaders(userId?: string): Promise<Record<string, string>> {
    return {
      [TEST_USER_HEADER]: userId ?? await getTestUserId(),
      [TEST_AUTH_OVERRIDE_HEADER]: "true",
    }
  }

  it("returns default heatmap data across owned and member projects while excluding inaccessible projects", async () => {
    await seedHeatmapFixtures()

    const response = await GET(
      new NextRequest("http://localhost/api/projects/activity-heatmap", {
        headers: await buildAuthHeaders(),
      })
    )

    expect(response.status).toBe(200)

    const payload = await response.json()

    expect(payload.summary).toEqual({
      jobCount: 3,
      shippedTicketCount: 1,
      periodLabel: "the last 12 months",
    })
    expect(payload.selectedPeriod).toBe("last-12-months")
    expect(payload.selectedAgent).toBe("all")
    expect(payload.hasActivity).toBe(true)
    expect(payload.periods.map((period: { value: string }) => period.value)).toEqual([
      "last-12-months",
      "2026",
      "2025",
    ])
    expect(payload.agents).toEqual([
      { value: "all", label: "All agents", jobCount: 3, isDefault: true },
      { value: "CLAUDE", label: "Claude", jobCount: 2, isDefault: false },
      { value: "CODEX", label: "Codex", jobCount: 1, isDefault: false },
    ])
    expect(payload.cells.find((cell: { date: string }) => cell.date === "2026-04-19")).toMatchObject({
      jobCount: 2,
      shippedTicketCount: 1,
    })
    expect(payload.cells.find((cell: { date: string }) => cell.date === "2026-04-17")).toMatchObject({
      jobCount: 0,
      shippedTicketCount: 0,
    })
  })

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/projects/activity-heatmap")
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
      code: "AUTH_ERROR",
    })
  })

  it("returns an empty payload when the selected period has no activity", async () => {
    const ownerId = await getTestUserId()
    await prisma.user.update({
      where: { id: ownerId },
      data: {
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date(),
      },
    })

    const response = await GET(
      new NextRequest("http://localhost/api/projects/activity-heatmap", {
        headers: await buildAuthHeaders(ownerId),
      })
    )

    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(payload.summary).toEqual({
      jobCount: 0,
      shippedTicketCount: 0,
      periodLabel: "the last 12 months",
    })
    expect(payload.hasActivity).toBe(false)
    expect(payload.cells.length).toBeGreaterThan(0)
  })

  it("returns 400 for invalid filters", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/projects/activity-heatmap?activityPeriod=abc", {
        headers: await buildAuthHeaders(),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Invalid activity heatmap filters",
      code: "VALIDATION_ERROR",
    })
  })

  it("limits periods to last-12-months for users created in the current year", async () => {
    const ownerId = await getTestUserId()
    await prisma.user.update({
      where: { id: ownerId },
      data: {
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        updatedAt: new Date(),
      },
    })

    const response = await GET(
      new NextRequest("http://localhost/api/projects/activity-heatmap", {
        headers: await buildAuthHeaders(ownerId),
      })
    )

    const payload = await response.json()
    expect(payload.periods).toEqual([
      {
        value: "last-12-months",
        label: "Last 12 months",
        startDate: "2025-04-21",
        endDate: "2026-04-20",
        isDefault: true,
      },
    ])
  })

  it("filters the heatmap by effective agent for the selected period", async () => {
    await seedHeatmapFixtures()

    const response = await GET(
      new NextRequest(
        "http://localhost/api/projects/activity-heatmap?activityAgent=CODEX",
        {
          headers: await buildAuthHeaders(),
        }
      )
    )

    expect(response.status).toBe(200)

    const payload = await response.json()

    expect(payload.summary).toEqual({
      jobCount: 1,
      shippedTicketCount: 0,
      periodLabel: "the last 12 months",
    })
    expect(payload.selectedAgent).toBe("CODEX")
    expect(payload.cells.find((cell: { date: string }) => cell.date === "2026-04-18")).toMatchObject({
      jobCount: 1,
      shippedTicketCount: 0,
    })
    expect(payload.cells.find((cell: { date: string }) => cell.date === "2026-04-19")).toMatchObject({
      jobCount: 0,
      shippedTicketCount: 0,
    })
  })
})
