import { endOfDay, endOfYear, format, startOfDay, startOfYear, subYears } from 'date-fns';
import { z } from 'zod';
import {
  type ProjectsActivityAgentFilter,
  type ProjectsActivityFilters,
  type ProjectsActivityPeriodOption,
} from '@/app/lib/types/project';
import { ALL_AGENTS, getAgentLabel, isSupportedAgent } from '@/app/lib/utils/agent-resolution';

const ROLLING_PERIOD = 'last-12-months' as const;
const PERIOD_VALUES = [ROLLING_PERIOD, 'year'] as const;

const looseQuerySchema = z.object({
  period: z.string().optional(),
  year: z.string().optional(),
  agent: z.string().optional(),
});

const strictQuerySchema = z.object({
  period: z.enum(PERIOD_VALUES).optional(),
  year: z.string().optional(),
  agent: z.union([z.literal('all'), z.enum(ALL_AGENTS)]).optional(),
});

export interface ProjectsActivityFilterInput {
  period?: string | undefined;
  year?: string | undefined;
  agent?: string | undefined;
}

export interface ProjectsActivityFilterParseResult {
  filters: ProjectsActivityFilters;
  periodOptions: ProjectsActivityPeriodOption[];
}

export interface ProjectsActivityDateRange {
  start: Date;
  end: Date;
}

export function getProjectsActivityPeriodOptions(
  userCreatedAt: Date,
  now: Date = new Date()
): ProjectsActivityPeriodOption[] {
  const rollingStart = startOfDay(subYears(now, 1));
  const rollingEnd = endOfDay(now);
  const options: ProjectsActivityPeriodOption[] = [
    {
      value: ROLLING_PERIOD,
      label: 'Last 12 months',
      kind: 'rolling',
      rangeStart: format(rollingStart, 'yyyy-MM-dd'),
      rangeEnd: format(rollingEnd, 'yyyy-MM-dd'),
    },
  ];

  const createdYear = userCreatedAt.getUTCFullYear();
  const currentYear = now.getUTCFullYear();

  if (createdYear >= currentYear) {
    return options;
  }

  for (let year = createdYear; year <= currentYear; year += 1) {
    options.push({
      value: serializeProjectsActivityPeriod({ period: 'year', year }),
      label: String(year),
      kind: 'calendar-year',
      rangeStart: format(startOfYear(new Date(Date.UTC(year, 0, 1))), 'yyyy-MM-dd'),
      rangeEnd: format(endOfYear(new Date(Date.UTC(year, 0, 1))), 'yyyy-MM-dd'),
    });
  }

  return options;
}

function createStrictFilterSchema(minYear: number, maxYear: number) {
  return strictQuerySchema.superRefine((value, ctx) => {
    if (value.period === 'year') {
      if (!value.year) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['year'],
          message: 'Year is required when period is year',
        });
        return;
      }

      const numericYear = Number(value.year);

      if (!Number.isInteger(numericYear) || numericYear < minYear || numericYear > maxYear) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['year'],
          message: `Year must be between ${minYear} and ${maxYear}`,
        });
      }
    }
  });
}

export function parseProjectsActivityFilters(
  input: ProjectsActivityFilterInput,
  userCreatedAt: Date,
  options?: {
    now?: Date;
    strict?: boolean;
  }
): ProjectsActivityFilterParseResult {
  const now = options?.now ?? new Date();
  const currentYear = now.getUTCFullYear();
  const createdYear = userCreatedAt.getUTCFullYear();
  const periodOptions = getProjectsActivityPeriodOptions(userCreatedAt, now);

  if (options?.strict) {
    const parsed = createStrictFilterSchema(createdYear, currentYear).parse(input);
    const year =
      parsed.period === 'year' && parsed.year ? Number(parsed.year) : null;

    return {
      filters: {
        period: parsed.period ?? ROLLING_PERIOD,
        year,
        agent: parsed.agent ?? 'all',
      },
      periodOptions,
    };
  }

  const parsed = looseQuerySchema.parse(input);
  const period = parsed.period === 'year' ? 'year' : ROLLING_PERIOD;
  const rawYear = parsed.year ? Number(parsed.year) : null;
  const validYear =
    rawYear !== null &&
    Number.isInteger(rawYear) &&
    rawYear >= createdYear &&
    rawYear <= currentYear;
  const agent: ProjectsActivityAgentFilter =
    parsed.agent && isSupportedAgent(parsed.agent) ? parsed.agent : 'all';

  if (period === 'year' && validYear) {
    return {
      filters: {
        period,
        year: rawYear,
        agent,
      },
      periodOptions,
    };
  }

  return {
    filters: {
      period: ROLLING_PERIOD,
      year: null,
      agent,
    },
    periodOptions,
  };
}

export function getProjectsActivityDateRange(
  filters: Pick<ProjectsActivityFilters, 'period' | 'year'>,
  now: Date = new Date()
): ProjectsActivityDateRange {
  if (filters.period === 'year' && filters.year !== null) {
    const baseDate = new Date(Date.UTC(filters.year, 0, 1));
    return {
      start: startOfYear(baseDate),
      end: endOfYear(baseDate),
    };
  }

  return {
    start: startOfDay(subYears(now, 1)),
    end: endOfDay(now),
  };
}

export function serializeProjectsActivityPeriod(
  filters: Pick<ProjectsActivityFilters, 'period' | 'year'>
): string {
  if (filters.period === 'year' && filters.year !== null) {
    return `year:${filters.year}`;
  }

  return ROLLING_PERIOD;
}

export function parseSerializedProjectsActivityPeriod(value: string): Pick<
  ProjectsActivityFilters,
  'period' | 'year'
> {
  if (value.startsWith('year:')) {
    const numericYear = Number(value.slice('year:'.length));

    if (Number.isInteger(numericYear)) {
      return {
        period: 'year',
        year: numericYear,
      };
    }
  }

  return {
    period: ROLLING_PERIOD,
    year: null,
  };
}

export function buildProjectsActivitySearchParams(
  filters: ProjectsActivityFilters,
  searchParams?: URLSearchParams
): URLSearchParams {
  const params = new URLSearchParams(searchParams?.toString() ?? '');

  params.set('period', filters.period);

  if (filters.period === 'year' && filters.year !== null) {
    params.set('year', String(filters.year));
  } else {
    params.delete('year');
  }

  params.set('agent', filters.agent);

  return params;
}

export function ensureProjectsActivityAgentOptions(
  agents: readonly ProjectsActivityAgentFilter[],
  selectedAgent: ProjectsActivityAgentFilter
): Array<{ value: ProjectsActivityAgentFilter; label: string }> {
  const values = new Set<ProjectsActivityAgentFilter>(['all']);

  for (const agent of agents) {
    values.add(agent);
  }

  if (selectedAgent !== 'all') {
    values.add(selectedAgent);
  }

  return Array.from(values).map((value) => ({
    value,
    label: value === 'all' ? 'All' : getAgentLabel(value),
  }));
}
