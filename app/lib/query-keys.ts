export const queryKeys = {
  projects: {
    all: ['projects'] as const,
    detail: (id: number) => ['projects', id] as const,
    tickets: (id: number) => ['projects', id, 'tickets'] as const,
    ticket: (projectId: number, ticketId: number) =>
      ['projects', projectId, 'tickets', ticketId] as const,
    jobsStatus: (id: number) => ['projects', id, 'jobs', 'status'] as const,
    settings: (id: number) => ['projects', id, 'settings'] as const,
    documentation: (projectId: number, ticketId: number, docType: 'spec' | 'plan' | 'tasks' | 'summary') =>
      ['projects', projectId, 'tickets', ticketId, 'documentation', docType] as const,
    documentationHistory: (projectId: number, ticketId: number, docType: 'spec' | 'plan' | 'tasks' | 'summary') =>
      ['projects', projectId, 'tickets', ticketId, 'documentation', docType, 'history'] as const,
    members: (id: number) => ['projects', id, 'members'] as const,
    timeline: (projectId: number, ticketId: number) =>
      ['projects', projectId, 'tickets', ticketId, 'timeline'] as const,
    constitution: (projectId: number) =>
      ['projects', projectId, 'constitution'] as const,
    constitutionHistory: (projectId: number) =>
      ['projects', projectId, 'constitution', 'history'] as const,
    constitutionDiff: (projectId: number, sha: string) =>
      ['projects', projectId, 'constitution', 'diff', sha] as const,
    ticketSearch: (projectId: number, query: string) =>
      ['projects', projectId, 'tickets', 'search', query] as const,
    ticketJobs: (projectId: number, ticketId: number) =>
      ['projects', projectId, 'tickets', ticketId, 'jobs'] as const,
    ticketByKey: (projectId: number, ticketKey: string) =>
      ['projects', projectId, 'tickets', 'by-key', ticketKey] as const,
    activity: (projectId: number, cursor?: string | null) =>
      cursor
        ? (['projects', projectId, 'activity', cursor] as const)
        : (['projects', projectId, 'activity'] as const),
  },

  comments: {
    list: (ticketId: number) => ['comments', ticketId] as const,
  },

  analytics: {
    all: (projectId: number) => ['analytics', projectId] as const,
    data: (projectId: number, range: string, outcome: string, agent: string) =>
      ['analytics', projectId, range, outcome, agent] as const,
  },

  users: {
    all: ['users'] as const,
    current: ['users', 'current'] as const,
    detail: (id: string) => ['users', id] as const,
  },

  push: {
    status: ['push', 'status'] as const,
  },

  health: {
    score: (projectId: number) => ['health', projectId, 'score'] as const,
    scans: (projectId: number) => ['health', projectId, 'scans'] as const,
    scanHistory: (projectId: number, type?: string) =>
      type
        ? (['health', projectId, 'history', type] as const)
        : (['health', projectId, 'history'] as const),
    scanReport: (projectId: number, moduleType: string) =>
      ['health', projectId, 'scanReport', moduleType] as const,
    scanDetail: (projectId: number, scanId: number) =>
      ['health', projectId, 'scanDetail', scanId] as const,
    generatedTickets: (projectId: number, scanId: number) =>
      ['health', projectId, 'generatedTickets', scanId] as const,
  },

  tokens: {
    all: ['tokens'] as const,
  },
} as const;

export type QueryKeys = typeof queryKeys;
