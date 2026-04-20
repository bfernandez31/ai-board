import { format, startOfDay, endOfDay, subDays, startOfYear, endOfYear, eachDayOfInterval, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";

/**
 * Returns the date range for the last 12 months (365 days including today)
 */
export function getRollingAnnualRange() {
  const end = endOfDay(new Date());
  const start = startOfDay(subDays(end, 364)); // 365 days total
  return { start, end };
}

/**
 * Returns the date range for a specific calendar year
 */
export function getCalendarYearRange(year: number) {
  const start = startOfYear(new Date(year, 0, 1));
  const end = endOfYear(new Date(year, 0, 1));
  return { start, end };
}

/**
 * Formats a date as YYYY-MM-DD for consistency
 */
export function formatDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Generates the full grid of dates for the heatmap, including padding
 * to align with full weeks (Sunday to Saturday).
 * 
 * @param start The actual start of the data range
 * @param end The actual end of the data range
 * @returns Array of dates representing the grid
 */
export function getHeatmapGridDates(start: Date, end: Date) {
  // Align to week boundaries (Sunday to Saturday)
  const gridStart = startOfWeek(start, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(end, { weekStartsOn: 0 });

  return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

/**
 * Checks if a date is within the "active" range (not a chipped edge)
 */
export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  return isWithinInterval(date, { start, end });
}
