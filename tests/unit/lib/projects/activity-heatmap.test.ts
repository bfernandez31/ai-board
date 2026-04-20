import { Agent, JobStatus } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getCurrentUserWithCreatedAt } from "@/lib/db/users"
import { prisma } from "@/lib/db/client"

vi.mock("@/lib/db/users", () => ({
  getCurrentUserWithCreatedAt: vi.fn(),
}))

vi.mock("@/lib/db/client", () => ({
  prisma: {
    job: {
      findMany: vi.fn(),
    },
  },
}))

import {
  buildActivityHeatmapFromJobs,
  buildActivityPeriods,
  buildMonthLabels,
  DEFAULT_ACTIVITY_AGENT,
  DEFAULT_ACTIVITY_PERIOD,
  getProjectsActivityHeatmap,
  resolveSelectedAgent,
  resolveSelectedPeriod,
  type ActivityHeatmapAgentOption,
} from "@/lib/projects/activity-heatmap"

describe("activity heatmap periods", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-20T12:00:00.000Z"))
  })

  it("builds last-12-months and calendar-year options from user creation year", () => {
    const periods = buildActivityPeriods(
      new Date("2024-02-10T00:00:00.000Z"),
      new Date("2026-04-20T12:00:00.000Z")
    )

    expect(periods).toEqual([
      {
        value: DEFAULT_ACTIVITY_PERIOD,
        label: "Last 12 months",
        startDate: "2025-04-21",
        endDate: "2026-04-20",
        isDefault: true,
      },
      {
        value: "2026",
        label: "2026",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        isDefault: false,
      },
      {
        value: "2025",
        label: "2025",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        isDefault: false,
      },
      {
        value: "2024",
        label: "2024",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        isDefault: false,
      },
    ])
  })

  it("falls back to the default period when an invalid period is selected", () => {
    const periods = buildActivityPeriods(
      new Date("2026-01-15T00:00:00.000Z"),
      new Date("2026-04-20T12:00:00.000Z")
    )

    expect(resolveSelectedPeriod(periods, "1999")).toEqual(periods[0])
  })
})

describe("activity heatmap aggregation", () => {
  const range = {
    value: DEFAULT_ACTIVITY_PERIOD,
    label: "Last 12 months",
    start: new Date("2026-01-01T00:00:00.000Z"),
    end: new Date("2026-01-10T23:59:59.999Z"),
  } as const

  const jobs = [
    {
      ticketId: 10,
      command: "ship",
      status: JobStatus.COMPLETED,
      completedAt: new Date("2026-01-02T12:00:00.000Z"),
      costUsd: 1.25,
      ticketAgent: null,
      projectDefaultAgent: Agent.CLAUDE,
    },
    {
      ticketId: 10,
      command: "ship",
      status: JobStatus.COMPLETED,
      completedAt: new Date("2026-01-02T18:00:00.000Z"),
      costUsd: null,
      ticketAgent: null,
      projectDefaultAgent: Agent.CLAUDE,
    },
    {
      ticketId: 11,
      command: "implement",
      status: JobStatus.FAILED,
      completedAt: new Date("2026-01-03T09:00:00.000Z"),
      costUsd: null,
      ticketAgent: Agent.CODEX,
      projectDefaultAgent: Agent.CLAUDE,
    },
    {
      ticketId: 12,
      command: "verify",
      status: JobStatus.COMPLETED,
      completedAt: new Date("2026-01-08T09:00:00.000Z"),
      costUsd: 3.5,
      ticketAgent: Agent.CODEX,
      projectDefaultAgent: Agent.CLAUDE,
    },
  ] as const

  it("dedupes shipped tickets per ticket per day and derives agent options", () => {
    const data = buildActivityHeatmapFromJobs({
      jobs: [...jobs],
      range: { ...range },
      selectedAgent: DEFAULT_ACTIVITY_AGENT,
      generatedAt: new Date("2026-01-10T12:00:00.000Z"),
    })

    const shippedDay = data.cells.find((cell) => cell.date === "2026-01-02")
    const codexDay = data.cells.find((cell) => cell.date === "2026-01-08")

    expect(shippedDay).toMatchObject({
      date: "2026-01-02",
      jobCount: 2,
      shippedTicketCount: 1,
      totalCostUsd: 1.25,
      hasCostData: true,
    })
    expect(codexDay).toMatchObject({
      date: "2026-01-08",
      jobCount: 1,
      shippedTicketCount: 0,
      totalCostUsd: 3.5,
      hasCostData: true,
    })
    expect(data.summary).toEqual({
      jobCount: 4,
      shippedTicketCount: 1,
      periodLabel: "the last 12 months",
    })
    expect(data.agents).toEqual([
      {
        value: "all",
        label: "All agents",
        jobCount: 4,
        isDefault: true,
      },
      {
        value: "CLAUDE",
        label: "Claude",
        jobCount: 2,
        isDefault: false,
      },
      {
        value: "CODEX",
        label: "Codex",
        jobCount: 2,
        isDefault: false,
      },
    ])
  })

  it("filters by effective agent and falls back to all when the requested agent is unavailable", () => {
    const options: ActivityHeatmapAgentOption[] = [
      { value: "all", label: "All agents", jobCount: 2, isDefault: true },
      { value: "CLAUDE", label: "Claude", jobCount: 2, isDefault: false },
    ]

    expect(resolveSelectedAgent(options, "MISTRAL")).toBe(DEFAULT_ACTIVITY_AGENT)

    const data = buildActivityHeatmapFromJobs({
      jobs: [...jobs],
      range: { ...range },
      selectedAgent: "CODEX",
      generatedAt: new Date("2026-01-10T12:00:00.000Z"),
    })

    expect(data.summary).toEqual({
      jobCount: 2,
      shippedTicketCount: 0,
      periodLabel: "the last 12 months",
    })
    expect(data.cells.find((cell) => cell.date === "2026-01-02")).toMatchObject({
      jobCount: 0,
      shippedTicketCount: 0,
    })
    expect(data.cells.find((cell) => cell.date === "2026-01-03")).toMatchObject({
      jobCount: 1,
      hasCostData: false,
      totalCostUsd: null,
    })
  })

  it("places month labels on the first in-period day of each month and preserves chipped weeks", () => {
    const labels = buildMonthLabels({
      value: DEFAULT_ACTIVITY_PERIOD,
      label: "Last 12 months",
      start: new Date("2026-01-30T00:00:00.000Z"),
      end: new Date("2026-02-03T23:59:59.999Z"),
    })

    expect(labels).toEqual([
      { label: "Jan", weekIndex: 0 },
      { label: "Feb", weekIndex: 1 },
    ])

    const data = buildActivityHeatmapFromJobs({
      jobs: [],
      range: {
        value: DEFAULT_ACTIVITY_PERIOD,
        label: "Last 12 months",
        start: new Date("2026-01-30T00:00:00.000Z"),
        end: new Date("2026-02-03T23:59:59.999Z"),
      },
      selectedAgent: DEFAULT_ACTIVITY_AGENT,
      generatedAt: new Date("2026-02-03T12:00:00.000Z"),
    })

    expect(data.cells).toHaveLength(5)
    expect(data.cells[0]).toMatchObject({
      date: "2026-01-30",
      weekIndex: 0,
      dayOfWeek: 5,
    })
    expect(data.cells.at(-1)).toMatchObject({
      date: "2026-02-03",
      weekIndex: 1,
      dayOfWeek: 2,
    })
  })
})

describe("getProjectsActivityHeatmap", () => {
  it("queries only accessible projects for the authenticated user", async () => {
    vi.mocked(getCurrentUserWithCreatedAt).mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "User",
      source: "test-override",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
    })
    vi.mocked(prisma.job.findMany).mockResolvedValue([])

    await getProjectsActivityHeatmap()

    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ticket: {
            is: {
              project: {
                is: {
                  OR: [
                    { userId: "user-1" },
                    { members: { some: { userId: "user-1" } } },
                  ],
                },
              },
            },
          },
        }),
      })
    )
  })
})
