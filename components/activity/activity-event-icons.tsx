/**
 * Activity Event Icons Mapping
 * Feature: AIB-172 Project Activity Feed
 *
 * Maps activity event types to appropriate icons with semantic colors
 */

import {
  PlusCircle,
  ArrowRight,
  MessageSquare,
  PlayCircle,
  CheckCircle,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { ActivityEventType } from '@/app/lib/types/activity-event';

/**
 * Icon configuration for each activity event type
 */
interface EventIconConfig {
  icon: LucideIcon;
  colorClass: string;
  label: string;
}

/**
 * Icon mapping for all activity event types
 */
export const ACTIVITY_EVENT_ICONS: Record<ActivityEventType, EventIconConfig> = {
  ticket_created: {
    icon: PlusCircle,
    colorClass: 'text-green-500',
    label: 'Ticket created',
  },
  ticket_stage_changed: {
    icon: ArrowRight,
    colorClass: 'text-blue-500',
    label: 'Stage changed',
  },
  comment_posted: {
    icon: MessageSquare,
    colorClass: 'text-purple-500',
    label: 'Comment posted',
  },
  job_started: {
    icon: PlayCircle,
    colorClass: 'text-blue-500',
    label: 'Job started',
  },
  job_completed: {
    icon: CheckCircle,
    colorClass: 'text-green-500',
    label: 'Job completed',
  },
  job_failed: {
    icon: XCircle,
    colorClass: 'text-red-500',
    label: 'Job failed',
  },
};

/**
 * Get icon configuration for an activity event type
 *
 * @param type - Activity event type
 * @returns Icon configuration with icon component, color class, and label
 */
export function getActivityEventIcon(type: ActivityEventType): EventIconConfig {
  return ACTIVITY_EVENT_ICONS[type];
}

interface ActivityEventIconProps {
  type: ActivityEventType;
  className?: string;
}

/**
 * Render an activity event icon
 *
 * @param type - Activity event type
 * @param className - Additional CSS classes for the icon
 */
export function ActivityEventIcon({ type, className = '' }: ActivityEventIconProps) {
  const config = getActivityEventIcon(type);
  const IconComponent = config.icon;

  return (
    <IconComponent
      className={`w-4 h-4 ${config.colorClass} ${className}`}
      aria-label={config.label}
    />
  );
}
