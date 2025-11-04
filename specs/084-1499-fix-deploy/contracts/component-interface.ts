/**
 * Component Interface Contract: Unified Deploy Preview Icon
 *
 * This file defines the TypeScript interfaces and types for the unified deploy
 * preview icon feature. No API endpoints are involved - this is a UI-only refactor.
 *
 * Feature: Consolidate preview and deploy icons into single stateful icon
 * Branch: 084-1499-fix-deploy
 * Date: 2025-11-04
 */

import { Job, JobStatus } from '@prisma/client';
import { TicketWithVersion } from '@/lib/types';

// ============================================================================
// ICON STATE DEFINITIONS
// ============================================================================

/**
 * Represents the visual and interaction state of the unified deploy preview icon.
 * States are prioritized from highest to lowest as defined.
 */
export type DeployIconState =
  | 'preview'    // Green ExternalLink icon, clickable, opens preview URL
  | 'deploying'  // Blue Rocket icon, bounce animation, disabled (job PENDING/RUNNING)
  | 'deployable' // Neutral Rocket icon, clickable, opens deploy modal (isDeployable OR job FAILED/CANCELLED)
  | 'hidden';    // No icon shown

/**
 * Icon configuration for each state, defining visual properties and behavior.
 */
export interface DeployIconConfig {
  /** Lucide icon component name */
  icon: 'ExternalLink' | 'Rocket';
  /** TailwindCSS color class */
  colorClass: 'text-green-400' | 'text-blue-400' | 'text-[#a6adc8]';
  /** Whether icon should have bounce animation */
  animated: boolean;
  /** Whether icon is clickable */
  clickable: boolean;
  /** Accessibility label for screen readers */
  ariaLabel: string;
  /** Tooltip text on hover */
  tooltipText: string;
}

/**
 * Maps each DeployIconState to its visual configuration.
 */
export const DEPLOY_ICON_CONFIG_MAP: Record<DeployIconState, DeployIconConfig | null> = {
  preview: {
    icon: 'ExternalLink',
    colorClass: 'text-green-400',
    animated: false,
    clickable: true,
    ariaLabel: 'Open preview deployment',
    tooltipText: 'Open preview deployment',
  },
  deploying: {
    icon: 'Rocket',
    colorClass: 'text-blue-400',
    animated: true,
    clickable: false,
    ariaLabel: 'Deployment in progress',
    tooltipText: 'Deployment in progress...',
  },
  deployable: {
    icon: 'Rocket',
    colorClass: 'text-[#a6adc8]',
    animated: false,
    clickable: true,
    ariaLabel: 'Deploy preview',
    tooltipText: 'Deploy preview',
  },
  hidden: null, // No configuration needed for hidden state
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Computes the unified deploy icon state based on ticket data, deploy job, and eligibility.
 *
 * Priority Order (Highest to Lowest):
 * 1. Preview: ticket.previewUrl !== null
 * 2. Deploying: deployJob.status === PENDING | RUNNING
 * 3. Deployable: isDeployable === true OR deployJob.status === FAILED | CANCELLED
 * 4. Hidden: None of the above
 *
 * @param ticket - Ticket with previewUrl field
 * @param deployJob - Current deploy job (if exists)
 * @param isDeployable - Whether ticket meets deployment criteria
 * @returns DeployIconState enum value
 *
 * @example
 * ```typescript
 * const state = getDeployIconState(ticket, deployJob, isDeployable);
 * // state: 'preview' | 'deploying' | 'deployable' | 'hidden'
 * ```
 */
export function getDeployIconState(
  ticket: Pick<TicketWithVersion, 'previewUrl'>,
  deployJob: Pick<Job, 'status'> | null | undefined,
  isDeployable: boolean
): DeployIconState {
  // Priority 1: Preview (highest)
  if (ticket.previewUrl !== null && ticket.previewUrl !== undefined) {
    return 'preview';
  }

  // Priority 2: Deploying
  if (deployJob?.status === 'PENDING' || deployJob?.status === 'RUNNING') {
    return 'deploying';
  }

  // Priority 3: Deployable (includes retry after failure)
  if (
    isDeployable ||
    deployJob?.status === 'FAILED' ||
    deployJob?.status === 'CANCELLED'
  ) {
    return 'deployable';
  }

  // Priority 4: Hidden (fallback)
  return 'hidden';
}

/**
 * Gets the icon configuration for a given deploy icon state.
 *
 * @param state - Current deploy icon state
 * @returns Icon configuration object or null if hidden
 *
 * @example
 * ```typescript
 * const config = getDeployIconConfig('preview');
 * // config: { icon: 'ExternalLink', colorClass: 'text-green-400', ... }
 * ```
 */
export function getDeployIconConfig(state: DeployIconState): DeployIconConfig | null {
  return DEPLOY_ICON_CONFIG_MAP[state];
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if a deploy icon state is clickable.
 *
 * @param state - Deploy icon state to check
 * @returns True if state is preview or deployable
 */
export function isClickableState(state: DeployIconState): boolean {
  return state === 'preview' || state === 'deployable';
}

/**
 * Type guard to check if a deploy icon state should be animated.
 *
 * @param state - Deploy icon state to check
 * @returns True if state is deploying
 */
export function isAnimatedState(state: DeployIconState): boolean {
  return state === 'deploying';
}

/**
 * Type guard to check if a deploy icon state should be visible.
 *
 * @param state - Deploy icon state to check
 * @returns True if state is not hidden
 */
export function isVisibleState(state: DeployIconState): boolean {
  return state !== 'hidden';
}

// ============================================================================
// COMPONENT PROPS
// ============================================================================

/**
 * Props for the unified deploy icon within TicketCard component.
 * These props are derived from existing TicketCard props.
 */
export interface UnifiedDeployIconProps {
  /** Current deploy icon state */
  state: DeployIconState;
  /** Ticket key for accessibility labels */
  ticketKey: string;
  /** Preview URL (only used when state is 'preview') */
  previewUrl?: string | null;
  /** Callback when deploy button clicked (only used when state is 'deployable') */
  onDeploy?: () => void;
}

// ============================================================================
// TESTING FIXTURES
// ============================================================================

/**
 * Mock ticket data for testing icon state logic (Vitest unit tests).
 */
export const MOCK_TICKET_WITH_PREVIEW = {
  previewUrl: 'https://test-preview.vercel.app',
} as const;

export const MOCK_TICKET_WITHOUT_PREVIEW = {
  previewUrl: null,
} as const;

/**
 * Mock deploy job data for testing icon state logic (Vitest unit tests).
 */
export const MOCK_DEPLOY_JOB_PENDING = {
  status: 'PENDING' as JobStatus,
} as const;

export const MOCK_DEPLOY_JOB_RUNNING = {
  status: 'RUNNING' as JobStatus,
} as const;

export const MOCK_DEPLOY_JOB_COMPLETED = {
  status: 'COMPLETED' as JobStatus,
} as const;

export const MOCK_DEPLOY_JOB_FAILED = {
  status: 'FAILED' as JobStatus,
} as const;

export const MOCK_DEPLOY_JOB_CANCELLED = {
  status: 'CANCELLED' as JobStatus,
} as const;

// ============================================================================
// MIGRATION NOTES
// ============================================================================

/**
 * DEPRECATED COMPONENTS (to be removed during implementation):
 * - components/board/ticket-card-preview-icon.tsx
 * - components/board/ticket-card-deploy-icon.tsx
 *
 * REPLACEMENT:
 * - Inline unified icon logic in components/board/ticket-card.tsx
 * - Use getDeployIconState() and getDeployIconConfig() from this contract
 *
 * BACKWARD COMPATIBILITY:
 * - TicketCard component props remain unchanged
 * - No API changes required
 * - Existing job polling and deploy workflows continue as-is
 */
