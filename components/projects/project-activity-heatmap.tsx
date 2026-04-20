"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { queryKeys } from "@/app/lib/query-keys"
import type {
  ActivityAgentValue,
  ActivityHeatmapCell,
  ActivityHeatmapData,
  ActivityPeriodValue,
} from "@/lib/projects/activity-heatmap"

interface ProjectActivityHeatmapProps {
  initialData: ActivityHeatmapData
}

interface HeatmapFilters {
  period: ActivityPeriodValue
  agent: ActivityAgentValue
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
const LEGEND_LEVELS = [0, 1, 2, 3, 4] as const

function formatCount(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`
}

function formatSummary(data: ActivityHeatmapData): string {
  return `${formatCount(data.summary.jobCount, "job")} · ${formatCount(
    data.summary.shippedTicketCount,
    "ticket"
  )} shipped in ${data.summary.periodLabel}`
}

function formatDateLabel(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

function formatCost(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatShippedLine(value: number): string {
  return `${formatCount(value, "ticket")} shipped`
}

function buildFilterSearchParams(searchParams: URLSearchParams, filters: HeatmapFilters): string {
  const params = new URLSearchParams(searchParams.toString())
  params.set("activityPeriod", filters.period)
  params.set("activityAgent", filters.agent)
  return `?${params.toString()}`
}

function filtersMatch(data: ActivityHeatmapData, filters: HeatmapFilters): boolean {
  return data.selectedPeriod === filters.period && data.selectedAgent === filters.agent
}

async function fetchProjectActivityHeatmap(filters: HeatmapFilters): Promise<ActivityHeatmapData> {
  const params = new URLSearchParams({
    activityPeriod: filters.period,
    activityAgent: filters.agent,
  })
  const response = await fetch(`/api/projects/activity-heatmap?${params.toString()}`)
  if (!response.ok) {
    throw new Error("Failed to fetch project activity heatmap")
  }

  return response.json()
}

function getInitialFilters(
  initialData: ActivityHeatmapData
): HeatmapFilters {
  return {
    period: initialData.selectedPeriod,
    agent: initialData.selectedAgent,
  }
}

function getIntensityClass(level: number): string {
  switch (level) {
    case 0:
      return "bg-muted/60"
    case 1:
      return "bg-violet-200"
    case 2:
      return "bg-violet-300"
    case 3:
      return "bg-violet-400"
    case 4:
      return "bg-violet-500"
    default:
      return "bg-muted/60"
  }
}

function groupCellsByWeek(cells: ActivityHeatmapData["cells"]): Map<number, ActivityHeatmapCell[]> {
  const weeks = new Map<number, ActivityHeatmapCell[]>()

  for (const cell of cells) {
    const weekCells = weeks.get(cell.weekIndex) ?? []
    weekCells.push(cell)
    weeks.set(cell.weekIndex, weekCells)
  }

  return new Map(Array.from(weeks.entries()).sort(([left], [right]) => left - right))
}

function buildMonthLabelMap(
  monthLabels: ActivityHeatmapData["monthLabels"]
): Map<number, string> {
  return new Map(monthLabels.map((label) => [label.weekIndex, label.label] as const))
}

function getNextPeriodFilters(period: string): HeatmapFilters {
  return {
    period: period as ActivityPeriodValue,
    agent: "all",
  }
}

function getNextAgentFilters(
  currentFilters: HeatmapFilters,
  agent: string
): HeatmapFilters {
  return {
    period: currentFilters.period,
    agent: agent as ActivityAgentValue,
  }
}

export function ProjectActivityHeatmap({
  initialData,
}: ProjectActivityHeatmapProps): JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [activeDate, setActiveDate] = useState<string | null>(null)
  const [filters, setFilters] = useState<HeatmapFilters>(() =>
    getInitialFilters(initialData)
  )

  const shouldUseInitialData = filtersMatch(initialData, filters)

  const { data } = useQuery({
    queryKey: queryKeys.projects.activityHeatmap(filters.period, filters.agent),
    queryFn: () => fetchProjectActivityHeatmap(filters),
    initialData: shouldUseInitialData ? initialData : undefined,
    placeholderData: (previousData) => previousData,
    staleTime: 10000,
    refetchInterval: 15000,
  })

  const heatmap = data ?? initialData
  const weeks = useMemo(() => groupCellsByWeek(heatmap.cells), [heatmap.cells])
  const monthLabelByWeek = useMemo(() => buildMonthLabelMap(heatmap.monthLabels), [heatmap.monthLabels])
  const activeCell = heatmap.cells.find((cell) => cell.date === activeDate) ?? null

  useEffect(() => {
    if (!activeDate) {
      return undefined
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setActiveDate(null)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [activeDate])

  function updateFilters(nextFilters: HeatmapFilters): void {
    setFilters(nextFilters)
    router.push(buildFilterSearchParams(searchParams, nextFilters), { scroll: false })
  }

  return (
    <Card className="border-border/60 aurora-bg-subtle" ref={rootRef}>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl text-foreground">Project Activity</CardTitle>
            <p className="text-sm text-muted-foreground">{formatSummary(heatmap)}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {heatmap.periods.length > 1 && (
              <Select
                value={filters.period}
                onValueChange={(value) => updateFilters(getNextPeriodFilters(value))}
              >
                <SelectTrigger
                  className="w-full sm:w-[180px]"
                  data-testid="activity-period-filter"
                >
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  {heatmap.periods.map((period) => (
                    <SelectItem key={period.value} value={period.value}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {heatmap.agents.length > 1 && (
              <Select
                value={filters.agent}
                onValueChange={(value) => updateFilters(getNextAgentFilters(filters, value))}
              >
                <SelectTrigger
                  className="w-full sm:w-[180px]"
                  data-testid="activity-agent-filter"
                >
                  <SelectValue placeholder="Agent" />
                </SelectTrigger>
                <SelectContent>
                  {heatmap.agents.map((agent) => (
                    <SelectItem key={agent.value} value={agent.value}>
                      {agent.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Less</span>
          {LEGEND_LEVELS.map((level) => (
            <span
              key={level}
              className={`h-3 w-3 rounded-sm ${getIntensityClass(level)}`}
              aria-hidden="true"
            />
          ))}
          <span>More</span>
        </div>

        {activeCell && (
          <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm">
            <div className="font-medium text-foreground">{formatDateLabel(activeCell.date)}</div>
            <div className="text-muted-foreground">
              {formatCount(activeCell.jobCount, "job")}
            </div>
            <div className="text-muted-foreground">
              {formatShippedLine(activeCell.shippedTicketCount)}
            </div>
            {activeCell.hasCostData && activeCell.totalCostUsd != null && (
              <div className="text-muted-foreground">{formatCost(activeCell.totalCostUsd)}</div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {!heatmap.hasActivity ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-background/40 px-4 py-10 text-sm text-muted-foreground">
            No activity to show yet — your AI work will appear here
          </div>
        ) : (
          <div className="flex gap-3">
            <div
              className="sticky left-0 z-10 flex min-w-12 flex-col bg-transparent pt-7"
              data-testid="activity-day-labels"
            >
              {DAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="flex h-5 items-center text-xs text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>

            <ScrollArea className="w-full">
              <div className="inline-flex gap-2 pb-2">
                {Array.from(weeks.entries()).map(([weekIndex, cells]) => (
                  <div key={weekIndex} className="flex flex-col gap-2">
                    <div className="h-5 text-xs text-muted-foreground">
                      {monthLabelByWeek.get(weekIndex) ?? ""}
                    </div>
                    <div className="grid h-[calc(7*1.25rem)] w-4 grid-rows-7 gap-1">
                      {cells.map((cell) => (
                        <button
                          key={cell.date}
                          aria-label={`Activity for ${cell.date}`}
                          className={`h-4 w-4 rounded-sm transition-opacity hover:opacity-90 ${getIntensityClass(
                            cell.intensityLevel
                          )}`}
                          onMouseEnter={() => setActiveDate(cell.date)}
                          onFocus={() => setActiveDate(cell.date)}
                          onClick={() => setActiveDate(cell.date)}
                          style={{ gridRowStart: cell.dayOfWeek + 1 }}
                          type="button"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
