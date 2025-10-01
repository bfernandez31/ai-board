import { Stage } from '@prisma/client';

/**
 * Configuration for each workflow stage
 * Includes display information and styling
 */
export const STAGE_CONFIG = {
  IDLE: {
    label: 'IDLE',
    color: 'gray',
    bgColor: 'bg-zinc-950/80',
    headerBgColor: 'bg-zinc-900/80',
    headerBorderColor: 'border-zinc-800/40',
    accentBarColor: 'bg-zinc-700/40',
    textColor: 'text-zinc-100',
    borderColor: 'border-zinc-800/40',
    badgeBgColor: 'bg-zinc-800/70',
    badgeTextColor: 'text-zinc-50',
    description: 'Tickets awaiting work',
    order: 0,
  },
  PLAN: {
    label: 'PLAN',
    color: 'blue',
    bgColor: 'bg-blue-950/40',
    headerBgColor: 'bg-blue-950/60',
    headerBorderColor: 'border-blue-900/40',
    accentBarColor: 'bg-blue-500/40',
    textColor: 'text-blue-100',
    borderColor: 'border-blue-950/40',
    badgeBgColor: 'bg-blue-800/70',
    badgeTextColor: 'text-blue-100',
    description: 'Planning in progress',
    order: 1,
  },
  BUILD: {
    label: 'BUILD',
    color: 'green',
    bgColor: 'bg-emerald-950/40',
    headerBgColor: 'bg-emerald-950/60',
    headerBorderColor: 'border-emerald-900/40',
    accentBarColor: 'bg-emerald-500/40',
    textColor: 'text-emerald-100',
    borderColor: 'border-emerald-950/40',
    badgeBgColor: 'bg-emerald-800/70',
    badgeTextColor: 'text-emerald-50',
    description: 'Implementation in progress',
    order: 2,
  },
  REVIEW: {
    label: 'REVIEW',
    color: 'orange',
    bgColor: 'bg-orange-950/40',
    headerBgColor: 'bg-orange-950/60',
    headerBorderColor: 'border-orange-900/40',
    accentBarColor: 'bg-orange-500/40',
    textColor: 'text-orange-100',
    borderColor: 'border-orange-950/40',
    badgeBgColor: 'bg-orange-800/70',
    badgeTextColor: 'text-orange-50',
    description: 'Under review',
    order: 3,
  },
  SHIPPED: {
    label: 'SHIPPED',
    color: 'purple',
    bgColor: 'bg-purple-950/40',
    headerBgColor: 'bg-purple-950/60',
    headerBorderColor: 'border-purple-900/40',
    accentBarColor: 'bg-purple-500/40',
    textColor: 'text-purple-100',
    borderColor: 'border-purple-950/40',
    badgeBgColor: 'bg-purple-800/70',
    badgeTextColor: 'text-purple-50',
    description: 'Successfully deployed',
    order: 4,
  },
  ERRORED: {
    label: 'ERRORED',
    color: 'red',
    bgColor: 'bg-rose-950/40',
    headerBgColor: 'bg-rose-950/60',
    headerBorderColor: 'border-rose-900/40',
    accentBarColor: 'bg-rose-500/40',
    textColor: 'text-rose-100',
    borderColor: 'border-rose-950/40',
    badgeBgColor: 'bg-rose-800/70',
    badgeTextColor: 'text-rose-50',
    description: 'Error occurred',
    order: 5,
  },
} as const;

export type StageKey = keyof typeof STAGE_CONFIG;

/**
 * Get stage configuration by stage key
 */
export function getStageConfig(stage: Stage) {
  return STAGE_CONFIG[stage];
}

/**
 * Get all stages in display order
 */
export function getAllStagesInOrder(): Stage[] {
  return Object.entries(STAGE_CONFIG)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key]) => key as Stage);
}
