import { Agent, JobStatus, type Prisma } from "@prisma/client"
import { getAgentLabel, resolveEffectiveAgent } from "@/app/lib/utils/agent-resolution"
import { prisma } from "@/lib/db/client"
import { getCurrentUserWithCreatedAt } from "@/lib/db/users"
import type { NextRequest } from "next/server"

export const DEFAULT_ACTIVITY_PERIOD = "last-12-months" as const
export const DEFAULT_ACTIVITY_AGENT = "all" as const
export const ACTIVITY_AGENT_VALUES = [
  DEFAULT_ACTIVITY_AGENT,
  Agent.CLAUDE,
  Agent.CODEX,
  Agent.MISTRAL,
  Agent.GEMINI,
] as const

export type ActivityPeriodValue = typeof DEFAULT_ACTIVITY_PERIOD | `${number}`
export type ActivityAgentValue = (typeof ACTIVITY_AGENT_VALUES)[number]

export interface ActivityHeatmapPeriodOption {
  value: ActivityPeriodValue
  label: string
  startDate: string
  endDate: string
  isDefault: boolean
}

export interface ActivityHeatmapAgentOption {
  value: ActivityAgentValue
  label: string
  jobCount: number
  isDefault: boolean
}

export interface ActivityHeatmapCell {
  date: string
  weekIndex: number
  dayOfWeek: number
  jobCount: number
  shippedTicketCount: number
  totalCostUsd: number | null
  hasCostData: boolean
  intensityLevel: number
  isInSelectedMonth: boolean
}

export interface ActivityHeatmapMonthLabel {
  label: string
  weekIndex: number
}

export interface ActivityHeatmapSummary {
  jobCount: number
  shippedTicketCount: number
  periodLabel: string
}

export interface ActivityHeatmapData {
  summary: ActivityHeatmapSummary
  periods: ActivityHeatmapPeriodOption[]
  agents: ActivityHeatmapAgentOption[]
  cells: ActivityHeatmapCell[]
  monthLabels: ActivityHeatmapMonthLabel[]
  selectedPeriod: ActivityPeriodValue
  selectedAgent: ActivityAgentValue
  hasActivity: boolean
  generatedAt: string
}

export interface ActivityHeatmapFilters {
  selectedPeriod?: string | null
  selectedAgent?: string | null
}

export interface GetProjectsActivityHeatmapOptions {
  request?: NextRequest
  strictPeriodValidation?: boolean
}

export class InvalidActivityHeatmapFilterError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidActivityHeatmapFilterError"
  }
}

interface PeriodRange {
  value: ActivityPeriodValue
  start: Date
  end: Date
  label: string
}

interface ActivityJobRecord {
  ticketId: number
  command: string
  status: JobStatus
  completedAt: Date
  costUsd: number | null
  ticketAgent: Agent | null
  projectDefaultAgent: Agent
}

interface AggregationInput {
  jobs: ActivityJobRecord[]
  range: PeriodRange
  selectedAgent: ActivityAgentValue
  generatedAt: Date
}

interface BucketState {
  date: string
  dayDate: Date
  jobCount: number
  shippedTicketCount: number
  totalCostUsd: number | null
  hasCostData: boolean
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function startOfUtcWeek(date: Date): Date {
  return addUtcDays(startOfUtcDay(date), -date.getUTCDay())
}

function differenceInUtcDays(left: Date, right: Date): number {
  return Math.round((startOfUtcDay(left).getTime() - startOfUtcDay(right).getTime()) / 86400000)
}

function clampIntensityLevel(value: number): number {
  return Math.max(0, Math.min(4, value))
}

function isActivityAgent(value: string | null | undefined): value is ActivityAgentValue {
  return ACTIVITY_AGENT_VALUES.includes(value as ActivityAgentValue)
}

export function buildActivityPeriods(userCreatedAt: Date, now: Date): ActivityHeatmapPeriodOption[] {
  const today = startOfUtcDay(now)
  const periods: ActivityHeatmapPeriodOption[] = [
    {
      value: DEFAULT_ACTIVITY_PERIOD,
      label: "Last 12 months",
      startDate: toDateKey(addUtcDays(today, -364)),
      endDate: toDateKey(today),
      isDefault: true,
    },
  ]

  const firstYear = userCreatedAt.getUTCFullYear()
  const currentYear = now.getUTCFullYear()

  if (firstYear < currentYear) {
    for (let year = currentYear; year >= firstYear; year -= 1) {
      periods.push({
        value: `${year}`,
        label: `${year}`,
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
        isDefault: false,
      })
    }
  }

  return periods
}

export function resolveSelectedPeriod(
  periods: ActivityHeatmapPeriodOption[],
  selectedPeriod: string | null | undefined
): ActivityHeatmapPeriodOption {
  return (
    periods.find((period) => period.value === selectedPeriod) ??
    periods.find((period) => period.isDefault) ??
    periods[0]!
  )
}

function toPeriodRange(period: ActivityHeatmapPeriodOption): PeriodRange {
  return {
    value: period.value,
    label: period.label,
    start: new Date(`${period.startDate}T00:00:00.000Z`),
    end: new Date(`${period.endDate}T23:59:59.999Z`),
  }
}

function getPeriodLabel(period: PeriodRange): string {
  if (period.value === DEFAULT_ACTIVITY_PERIOD) {
    return "the last 12 months"
  }

  return period.label
}

function getJobEffectiveAgent(job: ActivityJobRecord): Agent {
  return resolveEffectiveAgent(job.ticketAgent, job.projectDefaultAgent)
}

function buildAccessibleJobsWhere(userId: string, range: PeriodRange): Prisma.JobWhereInput {
  return {
    status: {
      in: [JobStatus.COMPLETED, JobStatus.FAILED],
    },
    completedAt: {
      gte: range.start,
      lte: range.end,
    },
    ticket: {
      is: {
        project: {
          is: {
            OR: [
              { userId },
              { members: { some: { userId } } },
            ],
          },
        },
      },
    },
  }
}

function buildEmptyBuckets(range: PeriodRange): Map<string, BucketState> {
  const buckets = new Map<string, BucketState>()

  for (
    let dayDate = startOfUtcDay(range.start);
    dayDate.getTime() <= startOfUtcDay(range.end).getTime();
    dayDate = addUtcDays(dayDate, 1)
  ) {
    const date = toDateKey(dayDate)
    buckets.set(date, {
      date,
      dayDate,
      jobCount: 0,
      shippedTicketCount: 0,
      totalCostUsd: null,
      hasCostData: false,
    })
  }

  return buckets
}

function buildAgentOptions(jobs: ActivityJobRecord[]): ActivityHeatmapAgentOption[] {
  const counts = new Map<Agent, number>()

  for (const job of jobs) {
    const agent = getJobEffectiveAgent(job)
    counts.set(agent, (counts.get(agent) ?? 0) + 1)
  }

  const options: ActivityHeatmapAgentOption[] = [
    {
      value: DEFAULT_ACTIVITY_AGENT,
      label: "All agents",
      jobCount: jobs.length,
      isDefault: true,
    },
  ]

  for (const agent of ACTIVITY_AGENT_VALUES) {
    if (agent === DEFAULT_ACTIVITY_AGENT) {
      continue
    }

    const jobCount = counts.get(agent) ?? 0
    if (jobCount > 0) {
      options.push({
        value: agent,
        label: getAgentLabel(agent),
        jobCount,
        isDefault: false,
      })
    }
  }

  return options
}

export function resolveSelectedAgent(
  options: ActivityHeatmapAgentOption[],
  selectedAgent: string | null | undefined
): ActivityAgentValue {
  if (isActivityAgent(selectedAgent) && options.some((option) => option.value === selectedAgent)) {
    return selectedAgent
  }

  return DEFAULT_ACTIVITY_AGENT
}

export function buildMonthLabels(range: PeriodRange): ActivityHeatmapMonthLabel[] {
  const labels: ActivityHeatmapMonthLabel[] = []
  const startWeek = startOfUtcWeek(range.start)
  const seen = new Set<string>()

  for (
    let dayDate = startOfUtcDay(range.start);
    dayDate.getTime() <= startOfUtcDay(range.end).getTime();
    dayDate = addUtcDays(dayDate, 1)
  ) {
    const monthKey = `${dayDate.getUTCFullYear()}-${dayDate.getUTCMonth()}`
    const isStartOfPeriod = dayDate.getTime() === startOfUtcDay(range.start).getTime()
    const isMonthStart = dayDate.getUTCDate() === 1

    if (!isStartOfPeriod && !isMonthStart) {
      continue
    }

    if (seen.has(monthKey)) {
      continue
    }

    labels.push({
      label: dayDate.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
      weekIndex: Math.floor(differenceInUtcDays(startOfUtcWeek(dayDate), startWeek) / 7),
    })
    seen.add(monthKey)
  }

  return labels
}

export function buildActivityHeatmapFromJobs({
  jobs,
  range,
  selectedAgent,
  generatedAt,
}: AggregationInput): ActivityHeatmapData {
  const buckets = buildEmptyBuckets(range)
  const shipKeys = new Set<string>()

  for (const job of jobs) {
    const effectiveAgent = getJobEffectiveAgent(job)
    if (selectedAgent !== DEFAULT_ACTIVITY_AGENT && effectiveAgent !== selectedAgent) {
      continue
    }

    const date = toDateKey(job.completedAt)
    const bucket = buckets.get(date)
    if (!bucket) {
      continue
    }

    bucket.jobCount += 1
    if (job.costUsd != null) {
      bucket.totalCostUsd = (bucket.totalCostUsd ?? 0) + job.costUsd
      bucket.hasCostData = true
    }

    if (job.command === "ship" && job.status === JobStatus.COMPLETED) {
      const shipKey = `${job.ticketId}:${date}`
      if (!shipKeys.has(shipKey)) {
        shipKeys.add(shipKey)
        bucket.shippedTicketCount += 1
      }
    }
  }

  const maxJobCount = Math.max(0, ...Array.from(buckets.values(), (bucket) => bucket.jobCount))
  const startWeek = startOfUtcWeek(range.start)
  const cells = Array.from(buckets.values()).map((bucket) => ({
    date: bucket.date,
    weekIndex: Math.floor(differenceInUtcDays(startOfUtcWeek(bucket.dayDate), startWeek) / 7),
    dayOfWeek: bucket.dayDate.getUTCDay(),
    jobCount: bucket.jobCount,
    shippedTicketCount: bucket.shippedTicketCount,
    totalCostUsd: bucket.totalCostUsd,
    hasCostData: bucket.hasCostData,
    intensityLevel:
      bucket.jobCount === 0 || maxJobCount === 0
        ? 0
        : clampIntensityLevel(Math.ceil((bucket.jobCount / maxJobCount) * 4)),
    isInSelectedMonth: true,
  }))

  const summary = cells.reduce(
    (accumulator, cell) => {
      accumulator.jobCount += cell.jobCount
      accumulator.shippedTicketCount += cell.shippedTicketCount
      return accumulator
    },
    {
      jobCount: 0,
      shippedTicketCount: 0,
    }
  )

  const agents = buildAgentOptions(jobs)
  const normalizedSelectedAgent = resolveSelectedAgent(agents, selectedAgent)

  return {
    summary: {
      ...summary,
      periodLabel: getPeriodLabel(range),
    },
    periods: [],
    agents,
    cells,
    monthLabels: buildMonthLabels(range),
    selectedPeriod: range.value,
    selectedAgent: normalizedSelectedAgent,
    hasActivity: summary.jobCount > 0 || summary.shippedTicketCount > 0,
    generatedAt: generatedAt.toISOString(),
  }
}

export async function getProjectsActivityHeatmap(
  filters: ActivityHeatmapFilters = {},
  options: GetProjectsActivityHeatmapOptions = {}
): Promise<ActivityHeatmapData> {
  const user = await getCurrentUserWithCreatedAt(options.request)
  const now = new Date()
  const periods = buildActivityPeriods(user.createdAt, now)

  if (
    options.strictPeriodValidation &&
    filters.selectedPeriod &&
    filters.selectedPeriod !== DEFAULT_ACTIVITY_PERIOD &&
    !periods.some((period) => period.value === filters.selectedPeriod)
  ) {
    throw new InvalidActivityHeatmapFilterError("Invalid activity period")
  }

  const selectedPeriod = resolveSelectedPeriod(periods, filters.selectedPeriod)
  const range = toPeriodRange(selectedPeriod)

  const jobs = await prisma.job.findMany({
    where: buildAccessibleJobsWhere(user.id, range),
    select: {
      ticketId: true,
      command: true,
      status: true,
      completedAt: true,
      costUsd: true,
      ticket: {
        select: {
          agent: true,
          project: {
            select: {
              defaultAgent: true,
            },
          },
        },
      },
    },
    orderBy: {
      completedAt: "asc",
    },
  })

  const records: ActivityJobRecord[] = jobs.flatMap((job) => {
    if (!job.completedAt) {
      return []
    }

    return [
      {
        ticketId: job.ticketId,
        command: job.command,
        status: job.status,
        completedAt: job.completedAt,
        costUsd: job.costUsd,
        ticketAgent: job.ticket.agent,
        projectDefaultAgent: job.ticket.project.defaultAgent,
      },
    ]
  })

  const agentOptions = buildAgentOptions(records)
  const normalizedSelectedAgent = resolveSelectedAgent(agentOptions, filters.selectedAgent)
  const data = buildActivityHeatmapFromJobs({
    jobs: records,
    range,
    selectedAgent: normalizedSelectedAgent,
    generatedAt: now,
  })

  return {
    ...data,
    periods,
    agents: agentOptions,
    selectedAgent: normalizedSelectedAgent,
  }
}
