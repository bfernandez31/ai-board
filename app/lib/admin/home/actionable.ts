import type { DashboardSnapshot } from './types';

export interface ActionableResult {
  tables: DashboardSnapshot['actionable'];
  totals: {
    newPayingUsersTotal: number;
    recentCancellationsTotal: number;
  };
}

export async function computeActionable(): Promise<ActionableResult> {
  return {
    tables: {
      newPayingUsers: [],
      recentCancellations: [],
      topActiveUsers: [],
      topProjects: [],
    },
    totals: {
      newPayingUsersTotal: 0,
      recentCancellationsTotal: 0,
    },
  };
}
