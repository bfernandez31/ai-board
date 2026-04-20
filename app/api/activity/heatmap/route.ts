import { NextRequest, NextResponse } from "next/server";
import { getHeatmapData } from "@/lib/db/activity";
import { getRollingAnnualRange, getCalendarYearRange } from "@/lib/utils/activity-date-utils";
import { Agent } from "@prisma/client";
import { getCurrentUser } from "@/lib/db/users";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const userId = user.id;

    const searchParams = request.nextUrl.searchParams;
    const agent = searchParams.get("agent") as Agent | null;
    const year = searchParams.get("year");

    let range;
    if (year && year !== "last-12-months") {
      range = getCalendarYearRange(parseInt(year, 10));
    } else {
      range = getRollingAnnualRange();
    }

    const data = await getHeatmapData({
      userId,
      start: range.start,
      end: range.end,
      agent,
    });

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    console.error("Heatmap API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
