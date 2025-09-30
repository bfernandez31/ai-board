import { Stage } from '@prisma/client';

/**
 * Configuration for each workflow stage
 * Includes display information and styling
 */
export const STAGE_CONFIG = {
  IDLE: {
    label: 'Idle',
    color: 'gray',
    bgColor: 'bg-gray-500',
    textColor: 'text-gray-500',
    borderColor: 'border-gray-500',
    description: 'Tickets awaiting work',
    order: 0,
  },
  PLAN: {
    label: 'Plan',
    color: 'blue',
    bgColor: 'bg-blue-500',
    textColor: 'text-blue-500',
    borderColor: 'border-blue-500',
    description: 'Planning in progress',
    order: 1,
  },
  BUILD: {
    label: 'Build',
    color: 'green',
    bgColor: 'bg-green-500',
    textColor: 'text-green-500',
    borderColor: 'border-green-500',
    description: 'Implementation in progress',
    order: 2,
  },
  REVIEW: {
    label: 'Review',
    color: 'orange',
    bgColor: 'bg-orange-500',
    textColor: 'text-orange-500',
    borderColor: 'border-orange-500',
    description: 'Under review',
    order: 3,
  },
  SHIPPED: {
    label: 'Shipped',
    color: 'purple',
    bgColor: 'bg-purple-500',
    textColor: 'text-purple-500',
    borderColor: 'border-purple-500',
    description: 'Successfully deployed',
    order: 4,
  },
  ERRORED: {
    label: 'Errored',
    color: 'red',
    bgColor: 'bg-red-500',
    textColor: 'text-red-500',
    borderColor: 'border-red-500',
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