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
    shipTotal: (projectId: number) =>
      ['projects', projectId, 'tickets', 'ship-total'] as const,
    setupJob: (projectId: number) =>
      ['projects', projectId, 'setup', 'job'] as const,
    retroSpecJob: (projectId: number) =>
      ['projects', projectId, 'setup', 'retro-spec'] as const,
    credentialCheck: (projectId: number, agent: string) =>
      ['projects', projectId, 'setup', 'credential', agent] as const,
    activity: (projectId: number, cursor?: string | null) =>
      cursor
        ? (['projects', projectId, 'activity', cursor] as const)
        : (['projects', projectId, 'activity'] as const),
    jobLog: (projectId: number, ticketId: number, jobId: number) =>
      ['projects', projectId, 'tickets', ticketId, 'jobs', jobId, 'log'] as const,
    jobLogRaw: (projectId: number, ticketId: number, jobId: number) =>
      ['projects', projectId, 'tickets', ticketId, 'jobs', jobId, 'log', 'raw'] as const,
    analysis: (projectId: number, ticketId: number) =>
      ['projects', projectId, 'tickets', ticketId, 'analysis'] as const,
  },

  comments: {
    list: (ticketId: number) => ['comments', ticketId] as const,
  },

  analytics: {
    all: (projectId: number) => ['analytics', projectId] as const,
    data: (projectId: number, range: string, outcome: string, agent: string) =>
      ['analytics', projectId, range, outcome, agent] as const,
  },

  heatmap: {
    data: (userId: string, period: string, agent: string) =>
      ['heatmap', userId, period, agent] as const,
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
    scan: (projectId: number, scanId: number | null) =>
      ['health', projectId, 'scan', scanId] as const,
    scanHistory: (projectId: number, type?: string) =>
      type
        ? (['health', projectId, 'history', type] as const)
        : (['health', projectId, 'history'] as const),
    trends: (projectId: number) => ['health', projectId, 'trends'] as const,
  },

  tokens: {
    all: ['tokens'] as const,
  },

  credentials: {
    all: ['credentials'] as const,
  },
} as const;

export type QueryKeys = typeof queryKeys;
