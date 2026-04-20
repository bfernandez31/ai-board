import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  ACTIVITY_AGENT_VALUES,
  DEFAULT_ACTIVITY_AGENT,
  DEFAULT_ACTIVITY_PERIOD,
  InvalidActivityHeatmapFilterError,
  getProjectsActivityHeatmap,
} from "@/lib/projects/activity-heatmap"

const querySchema = z.object({
  activityPeriod: z
    .union([
      z.literal(DEFAULT_ACTIVITY_PERIOD),
      z.string().regex(/^\d{4}$/),
    ])
    .default(DEFAULT_ACTIVITY_PERIOD),
  activityAgent: z.enum(ACTIVITY_AGENT_VALUES).default(DEFAULT_ACTIVITY_AGENT),
})

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const filters = querySchema.parse({
      activityPeriod: searchParams.get("activityPeriod") ?? undefined,
      activityAgent: searchParams.get("activityAgent") ?? undefined,
    })

    const data = await getProjectsActivityHeatmap(
      {
        selectedPeriod: filters.activityPeriod,
        selectedAgent: filters.activityAgent,
      },
      {
        request,
        strictPeriodValidation: true,
      }
    )

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof InvalidActivityHeatmapFilterError) {
      return NextResponse.json(
        { error: "Invalid activity heatmap filters", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized", code: "AUTH_ERROR" },
        { status: 401 }
      )
    }

    console.error("Projects activity heatmap API error:", error)
    return NextResponse.json(
      { error: "Failed to load project activity heatmap", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
