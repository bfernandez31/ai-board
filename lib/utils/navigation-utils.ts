/**
 * Navigation Utility Functions
 * Feature: Notification Click Navigation to Ticket Conversation Tab
 */

import type {
  NavigationContext,
  NotificationUrlParams,
  NotificationWithNavData,
} from '../types/notification-navigation';

/**
 * Determine if notification is for the same project as current context
 *
 * @param currentProjectId - Project ID user is currently viewing
 * @param targetProjectId - Project ID of notification's ticket
 * @returns true if same project, false otherwise
 */
export function isSameProject(
  currentProjectId: number,
  targetProjectId: number
): boolean {
  return currentProjectId === targetProjectId;
}

/**
 * Build notification navigation URL with modal, tab, and comment anchor
 *
 * Format: /projects/{projectId}/tickets/{ticketKey}?modal=open&tab=comments#comment-{commentId}
 *
 * @param params - URL parameters (projectId, ticketKey, commentId, tab)
 * @returns Full URL string for navigation
 */
export function buildNotificationUrl(params: NotificationUrlParams): string {
  const { projectId, ticketKey, commentId, tab = 'comments' } = params;

  // Validate inputs
  if (!projectId || projectId <= 0) {
    throw new Error('Invalid project ID');
  }
  if (!ticketKey || ticketKey.trim() === '') {
    throw new Error('Invalid ticket key');
  }
  if (!commentId || commentId <= 0) {
    throw new Error('Invalid comment ID');
  }

  // Build URL components
  const basePath = `/projects/${projectId}/tickets/${encodeURIComponent(ticketKey)}`;
  const queryParams = new URLSearchParams({
    modal: 'open',
    tab: tab,
  });
  const anchor = `#comment-${commentId}`;

  return `${basePath}?${queryParams.toString()}${anchor}`;
}

/**
 * Create navigation context from notification and current project
 *
 * Determines navigation strategy (same window vs new tab) based on
 * whether notification is for same project or cross-project.
 *
 * @param notification - Notification with navigation data
 * @param currentProjectId - Project ID user is currently viewing
 * @returns Navigation context with URL and strategy
 */
export function createNavigationContext(
  notification: NotificationWithNavData,
  currentProjectId: number
): NavigationContext {
  // Validate inputs
  if (!notification) {
    throw new Error('Notification is required');
  }
  if (!notification.projectId || notification.projectId <= 0) {
    throw new Error('Notification must have valid projectId');
  }
  if (!notification.ticketKey || notification.ticketKey.trim() === '') {
    throw new Error('Notification must have valid ticketKey');
  }
  if (!notification.commentId || notification.commentId <= 0) {
    throw new Error('Notification must have valid commentId');
  }
  if (!currentProjectId || currentProjectId <= 0) {
    throw new Error('Invalid current project ID');
  }

  const targetProjectId = notification.projectId;
  const sameProject = isSameProject(currentProjectId, targetProjectId);

  // Build target URL
  const targetUrl = buildNotificationUrl({
    projectId: targetProjectId,
    ticketKey: notification.ticketKey,
    commentId: notification.commentId,
    tab: 'comments',
  });

  return {
    currentProjectId,
    targetProjectId,
    isSameProject: sameProject,
    targetUrl,
    shouldOpenNewTab: !sameProject,
  };
}

/**
 * Validate notification data before navigation
 *
 * Checks that notification has all required fields for navigation
 *
 * @param notification - Notification to validate
 * @returns true if valid, false otherwise
 */
export function isValidNotificationForNavigation(
  notification: unknown
): notification is NotificationWithNavData {
  if (!notification || typeof notification !== 'object') {
    return false;
  }

  const n = notification as Partial<NotificationWithNavData>;

  return (
    typeof n.id === 'number' &&
    n.id > 0 &&
    typeof n.projectId === 'number' &&
    n.projectId > 0 &&
    typeof n.ticketKey === 'string' &&
    n.ticketKey.trim() !== '' &&
    typeof n.commentId === 'number' &&
    n.commentId > 0
  );
}

/**
 * Extract project ID from Next.js route params
 *
 * Handles both string and number project IDs
 *
 * @param projectIdParam - Project ID from route params (string or number)
 * @returns Parsed project ID as number, or null if invalid
 */
export function parseProjectIdFromRoute(
  projectIdParam: string | number | undefined | null
): number | null {
  if (projectIdParam === undefined || projectIdParam === null) {
    return null;
  }

  const parsed = typeof projectIdParam === 'string'
    ? parseInt(projectIdParam, 10)
    : projectIdParam;

  return !isNaN(parsed) && parsed > 0 ? parsed : null;
}
