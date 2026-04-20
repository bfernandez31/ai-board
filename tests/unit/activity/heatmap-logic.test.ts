import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { 
  getRollingAnnualRange, 
  getCalendarYearRange, 
  formatDateKey, 
  getHeatmapGridDates, 
  isDateInRange 
} from "../../../lib/utils/activity-date-utils";
import { startOfDay, endOfDay, subDays, startOfYear, endOfYear, format, isSunday, isSaturday } from "date-fns";

describe("activity-date-utils", () => {
  beforeEach(() => {
    // Mock "today" to a fixed date: 2026-04-20 (Monday)
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 20)); // April is index 3
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return rolling annual range (last 365 days)", () => {
    const { start, end } = getRollingAnnualRange();
    
    expect(formatDateKey(end)).toBe("2026-04-20");
    // 365 days ago from 2026-04-20 is 2025-04-21
    expect(formatDateKey(start)).toBe("2025-04-21");
  });

  it("should return calendar year range", () => {
    const { start, end } = getCalendarYearRange(2025);
    
    expect(formatDateKey(start)).toBe("2025-01-01");
    expect(formatDateKey(end)).toBe("2025-12-31");
  });

  it("should generate heatmap grid dates with week alignment", () => {
    const start = new Date(2026, 3, 20); // Monday
    const end = new Date(2026, 3, 22);   // Wednesday
    
    const grid = getHeatmapGridDates(start, end);
    
    // Grid should start on Sunday before start (2026-04-19)
    // Grid should end on Saturday after end (2026-04-25)
    expect(grid.length).toBe(7);
    expect(formatDateKey(grid[0])).toBe("2026-04-19");
    expect(isSunday(grid[0])).toBe(true);
    expect(formatDateKey(grid[6])).toBe("2026-04-25");
    expect(isSaturday(grid[6])).toBe(true);
  });

  it("should correctly identify dates in range", () => {
    const start = new Date(2026, 3, 20);
    const end = new Date(2026, 3, 22);
    
    expect(isDateInRange(new Date(2026, 3, 19), start, end)).toBe(false); // Before
    expect(isDateInRange(new Date(2026, 3, 20), start, end)).toBe(true);  // On start
    expect(isDateInRange(new Date(2026, 3, 21), start, end)).toBe(true);  // Middle
    expect(isDateInRange(new Date(2026, 3, 22), start, end)).toBe(true);  // On end
    expect(isDateInRange(new Date(2026, 3, 23), start, end)).toBe(false); // After
  });
});
