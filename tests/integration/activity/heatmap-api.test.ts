import { describe, it, expect, beforeEach } from "vitest";
import { getTestContext, type TestContext } from "@/tests/fixtures/vitest/setup";
import { ActivityHeatmapResponseSchema } from "@/lib/types/activity";

describe("Heatmap API", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it("should return valid heatmap data for rolling 12 months", async () => {
    const response = await ctx.api.get("/api/activity/heatmap");
    
    expect(response.status).toBe(200);
    
    // Validate response structure using Zod
    const validation = ActivityHeatmapResponseSchema.safeParse(response.data);
    if (!validation.success) {
      console.error(validation.error);
    }
    expect(validation.success).toBe(true);
    
    expect(response.data.filters.currentYear).toBe("last-12-months");
  });

  it("should return valid heatmap data for a specific year", async () => {
    const response = await ctx.api.get("/api/activity/heatmap?year=2025");
    
    expect(response.status).toBe(200);
    expect(response.data.filters.currentYear).toBe("2025");
    expect(response.data.stats.period.start).toBe("2025-01-01");
    expect(response.data.stats.period.end).toBe("2025-12-31");
  });

  it("should filter by agent via query param", async () => {
    const response = await ctx.api.get("/api/activity/heatmap?agent=CLAUDE");
    
    expect(response.status).toBe(200);
    expect(response.data.filters.currentAgent).toBe("CLAUDE");
  });
});
