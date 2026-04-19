export interface HeatmapCell {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0 (Sun) - 6 (Sat)
  weekIndex: number;
  isWithinPeriod: boolean;
}

export function calculateDateRange(range: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  if (range === 'last-12-months') {
    endDate = new Date(now);
    startDate = new Date(now);
    startDate.setFullYear(now.getFullYear() - 1);
    startDate.setHours(0, 0, 0, 0);
  } else {
    const year = parseInt(range, 10);
    startDate = new Date(year, 0, 1); // Jan 1st
    endDate = new Date(year, 11, 31, 23, 59, 59, 999); // Dec 31st
  }

  return { startDate, endDate };
}

export function generateHeatmapGrid(startDate: Date, endDate: Date): HeatmapCell[][] {
  // Align start date to the preceding Sunday to start the grid
  const startGrid = new Date(startDate);
  startGrid.setHours(0, 0, 0, 0);
  const startDay = startGrid.getDay();
  startGrid.setDate(startGrid.getDate() - startDay);

  // Align end date to the following Saturday to end the grid
  const endGrid = new Date(endDate);
  endGrid.setHours(23, 59, 59, 999);
  const endDay = endGrid.getDay();
  endGrid.setDate(endGrid.getDate() + (6 - endDay));

  const grid: HeatmapCell[][] = [];
  let current = new Date(startGrid);
  let weekIndex = 0;

  while (current <= endGrid) {
    const week: HeatmapCell[] = [];
    for (let i = 0; i < 7; i++) {
      const dateStr = current.toISOString().split('T')[0] || '';
      const isWithinPeriod = current >= startDate && current <= endDate;
      
      week.push({
        date: dateStr,
        dayOfWeek: i,
        weekIndex,
        isWithinPeriod,
      });

      current.setDate(current.getDate() + 1);
    }
    grid.push(week);
    weekIndex++;
  }

  return grid;
}

export function getMonthLabels(grid: HeatmapCell[][]): { label: string; weekIndex: number }[] {
  const labels: { label: string; weekIndex: number }[] = [];
  let lastMonth = -1;

  grid.forEach((week, index) => {
    // Check the first cell of the week that is within period
    const firstValidCell = week.find(c => c.isWithinPeriod);
    if (firstValidCell) {
      const date = new Date(firstValidCell.date);
      const month = date.getMonth();
      if (month !== lastMonth) {
        labels.push({
          label: date.toLocaleString('default', { month: 'short' }),
          weekIndex: index,
        });
        lastMonth = month;
      }
    }
  });

  // Ensure labels are not too close to each other (at least 2 weeks apart)
  const filteredLabels: { label: string; weekIndex: number }[] = [];
  labels.forEach((label, i) => {
    const prevLabel = filteredLabels[filteredLabels.length - 1];
    if (i === 0 || !prevLabel || label.weekIndex - prevLabel.weekIndex >= 2) {
      filteredLabels.push(label);
    }
  });

  return filteredLabels;
}
