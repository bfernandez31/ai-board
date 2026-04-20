import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent } from "@testing-library/react"
import {
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from "@/tests/utils/component-test-utils"
import { ProjectActivityHeatmap } from "@/components/projects/project-activity-heatmap"
import type { ActivityHeatmapData } from "@/lib/projects/activity-heatmap"

const pushMock = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}))

vi.mock("@/components/ui/select", () => {
  const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  )

  const SelectTrigger = ({
    value,
    options,
    onValueChange,
    "data-testid": dataTestId,
  }: {
    value?: string
    options?: React.ReactNode[]
    onValueChange?: (value: string) => void
    "data-testid"?: string
  }) => (
    <select
      data-testid={dataTestId}
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {options}
    </select>
  )

  function collectOptions(children: React.ReactNode): React.ReactNode[] {
    return React.Children.toArray(children).flatMap((child) => {
      if (!React.isValidElement(child)) {
        return []
      }

      if (child.type === SelectItem) {
        return [child]
      }

      return collectOptions((child.props as { children?: React.ReactNode }).children)
    })
  }

  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value: string
      onValueChange: (value: string) => void
      children: React.ReactNode
    }) => {
      const options = collectOptions(children)

      return (
        <>
          {React.Children.map(children, (child) => {
            if (!React.isValidElement(child) || child.type !== SelectTrigger) {
              return null
            }

            return React.cloneElement(child, {
              value,
              onValueChange,
              options,
            })
          })}
        </>
      )
    },
    SelectTrigger,
    SelectValue: () => null,
    SelectContent: () => null,
    SelectItem,
  }
})

function makeHeatmapData(overrides: Partial<ActivityHeatmapData> = {}): ActivityHeatmapData {
  return {
    summary: {
      jobCount: 3,
      shippedTicketCount: 1,
      periodLabel: "the last 12 months",
    },
    periods: [
      {
        value: "last-12-months",
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
    ],
    agents: [
      { value: "all", label: "All agents", jobCount: 3, isDefault: true },
      { value: "CODEX", label: "Codex", jobCount: 1, isDefault: false },
    ],
    monthLabels: [
      { label: "Apr", weekIndex: 0 },
      { label: "May", weekIndex: 2 },
    ],
    cells: [
      {
        date: "2026-04-18",
        weekIndex: 0,
        dayOfWeek: 6,
        jobCount: 1,
        shippedTicketCount: 0,
        totalCostUsd: null,
        hasCostData: false,
        intensityLevel: 2,
        isInSelectedMonth: true,
      },
      {
        date: "2026-04-19",
        weekIndex: 1,
        dayOfWeek: 0,
        jobCount: 2,
        shippedTicketCount: 1,
        totalCostUsd: 4.25,
        hasCostData: true,
        intensityLevel: 4,
        isInSelectedMonth: true,
      },
    ],
    selectedPeriod: "last-12-months",
    selectedAgent: "all",
    hasActivity: true,
    generatedAt: "2026-04-20T12:00:00.000Z",
    ...overrides,
  }
}

describe("ProjectActivityHeatmap", () => {
  beforeEach(() => {
    pushMock.mockReset()
    mockSearchParams.forEach((_, key) => mockSearchParams.delete(key))
    vi.restoreAllMocks()
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(makeHeatmapData()))))
  })

  it("renders the summary, legend, month labels, and populated cells", () => {
    renderWithProviders(<ProjectActivityHeatmap initialData={makeHeatmapData()} />)

    expect(
      screen.getByText("3 jobs · 1 ticket shipped in the last 12 months")
    ).toBeInTheDocument()
    expect(screen.getByText("Less")).toBeInTheDocument()
    expect(screen.getByText("More")).toBeInTheDocument()
    expect(screen.getByText("Apr")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /activity for 2026-04-19/i })).toBeInTheDocument()
  })

  it("replaces the grid with the empty state while keeping the legend visible", () => {
    renderWithProviders(
      <ProjectActivityHeatmap
        initialData={makeHeatmapData({
          summary: {
            jobCount: 0,
            shippedTicketCount: 0,
            periodLabel: "the last 12 months",
          },
          cells: [],
          hasActivity: false,
        })}
      />
    )

    expect(
      screen.getByText("No activity to show yet — your AI work will appear here")
    ).toBeInTheDocument()
    expect(screen.getByText("Less")).toBeInTheDocument()
  })

  it("syncs selected filters into the URL and keeps previous data visible during refetch", async () => {
    let resolveFetch: ((value: Response) => void) | null = null
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve
          })
      )
    )

    renderWithProviders(<ProjectActivityHeatmap initialData={makeHeatmapData()} />)

    await userEvent.selectOptions(screen.getByTestId("activity-period-filter"), "2026")

    expect(pushMock).toHaveBeenCalledWith("?activityPeriod=2026&activityAgent=all", {
      scroll: false,
    })
    expect(
      screen.getByText("3 jobs · 1 ticket shipped in the last 12 months")
    ).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/activity-heatmap?activityPeriod=2026&activityAgent=all"
    )

    act(() => {
      resolveFetch?.(
        new Response(
          JSON.stringify(
            makeHeatmapData({
              summary: {
                jobCount: 1,
                shippedTicketCount: 0,
                periodLabel: "2026",
              },
              selectedPeriod: "2026",
            })
          )
        )
      )
    })
  })

  it("hides period and agent filters when there is nothing meaningful to select", () => {
    renderWithProviders(
      <ProjectActivityHeatmap
        initialData={makeHeatmapData({
          periods: [makeHeatmapData().periods[0]!],
          agents: [makeHeatmapData().agents[0]!],
        })}
      />
    )

    expect(screen.queryByTestId("activity-period-filter")).not.toBeInTheDocument()
    expect(screen.queryByTestId("activity-agent-filter")).not.toBeInTheDocument()
  })

  it("shows and dismisses day details on hover and outside tap, while omitting cost when unavailable", async () => {
    renderWithProviders(<ProjectActivityHeatmap initialData={makeHeatmapData()} />)

    const noCostCell = screen.getByRole("button", { name: /activity for 2026-04-18/i })
    fireEvent.mouseEnter(noCostCell)

    expect(screen.getByText("Apr 18, 2026")).toBeInTheDocument()
    expect(screen.getByText("1 job")).toBeInTheDocument()
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /activity for 2026-04-19/i }))
    expect(screen.getByText("Apr 19, 2026")).toBeInTheDocument()
    expect(screen.getByText("1 ticket shipped")).toBeInTheDocument()
    expect(screen.getByText("$4.25")).toBeInTheDocument()

    fireEvent.pointerDown(document.body)

    await waitFor(() => {
      expect(screen.queryByText("Apr 19, 2026")).not.toBeInTheDocument()
    })
  })

  it("renders sticky day labels beside the horizontal scroll area", () => {
    renderWithProviders(<ProjectActivityHeatmap initialData={makeHeatmapData()} />)

    expect(screen.getByTestId("activity-day-labels")).toHaveClass("sticky", "left-0")
  })
})
