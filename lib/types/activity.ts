import { z } from "zod";

/**
 * Zod schema for a single day in the heatmap
 */
export const HeatmapDaySchema = z.object({
  date: z.string().describe("ISO 8601 date string (YYYY-MM-DD)"),
  jobCount: z.number().int().min(0),
  shippedTicketCount: z.number().int().min(0),
  totalCost: z.number().nullable(),
});

export type HeatmapDay = z.infer<typeof HeatmapDaySchema>;

/**
 * Zod schema for heatmap statistics
 */
export const HeatmapStatsSchema = z.object({
  totalJobs: z.number().int().min(0),
  totalShippedTickets: z.number().int().min(0),
  period: z.object({
    start: z.string(),
    end: z.string(),
  }),
});

export type HeatmapStats = z.infer<typeof HeatmapStatsSchema>;

/**
 * Zod schema for heatmap filters
 */
export const HeatmapFiltersSchema = z.object({
  availableAgents: z.array(z.string()),
  availableYears: z.array(z.number()),
  currentAgent: z.string().nullable(),
  currentYear: z.string().describe("'last-12-months' or 'YYYY'"),
});

export type HeatmapFilters = z.infer<typeof HeatmapFiltersSchema>;

/**
 * Zod schema for the full heatmap API response
 */
export const ActivityHeatmapResponseSchema = z.object({
  days: z.array(HeatmapDaySchema),
  stats: HeatmapStatsSchema,
  filters: HeatmapFiltersSchema,
});

export type ActivityHeatmapResponse = z.infer<typeof ActivityHeatmapResponseSchema>;
