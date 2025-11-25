/**
 * TypeScript Interface Contracts
 * Feature: Notification Click Navigation to Ticket Conversation Tab
 *
 * These interfaces define the contracts between components and services.
 * They serve as the "source of truth" for type definitions during implementation.
 */

// ============================================================================
// Navigation Types
// ============================================================================

/**
 * Navigation context for determining same-project vs cross-project navigation
 */
export interface NavigationContext {
  /** Project ID user is currently viewing */
  currentProjectId: number;

  /** Project ID of the notification's ticket */
  targetProjectId: number;

  /** Whether navigation stays within the same project */
  isSameProject: boolean;

  /** Full URL to navigate to (includes modal, tab, and comment anchor) */
  targetUrl: string;

  /** Whether navigation should open in a new browser tab */
  shouldOpenNewTab: boolean;
}

/**
 * Data required to build a notification navigation URL
 */
export interface NotificationUrlParams {
  /** Target project ID */
  projectId: number;

  /** Target ticket key (e.g., "ABC-123") */
  ticketKey: string;

  /** Target comment ID for scroll anchor */
  commentId: number;

  /** Tab to open in ticket modal (default: 'comments') */
  tab?: 'details' | 'comments' | 'files';
}

/**
 * Result of navigation action
 */
export interface NavigationResult {
  /** Whether navigation was successful */
  success: boolean;

  /** Navigation method used */
  method: 'push' | 'newTab';

  /** Error message if navigation failed */
  error?: string;
}

// ============================================================================
// Notification Types (Extended from Prisma)
// ============================================================================

/**
 * Notification with enriched navigation data
 *
 * Extends base Notification with joined fields from relations
 * needed for navigation and display.
 */
export interface NotificationWithNavData {
  // Base notification fields
  id: number;
  recipientId: string;
  actorId: string;
  commentId: number;
  ticketId: number;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
  deletedAt: Date | null;

  // Joined fields for navigation (from relations)
  projectId: number;              // From ticket.projectId
  ticketKey: string;              // From ticket.ticketKey
  actorName: string;              // From actor.name
  actorImage: string | null;      // From actor.image
  commentPreview: string;         // From comment.content (truncated)
}

/**
 * Notification click event data
 *
 * Contains all information needed to handle a notification click,
 * including current context and target information.
 */
export interface NotificationClickEvent {
  /** The notification being clicked */
  notification: NotificationWithNavData;

  /** Current project context */
  currentProjectId: number;

  /** Timestamp of click event */
  timestamp: Date;
}

// ============================================================================
// API Types
// ============================================================================

/**
 * Request to mark notification as read
 */
export interface MarkNotificationReadRequest {
  notificationId: number;
}

/**
 * Response from mark-as-read API endpoint
 */
export interface MarkNotificationReadResponse {
  success: boolean;
  notification?: {
    id: number;
    read: boolean;
    readAt: string;  // ISO 8601 string
  };
  error?: string;
}

/**
 * Notification list API response
 */
export interface NotificationListResponse {
  notifications: NotificationWithNavData[];
  unreadCount: number;
  hasMore: boolean;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR';
  issues?: Array<{
    path: string[];
    message: string;
  }>;
}

// ============================================================================
// Component Props
// ============================================================================

/**
 * Props for TicketDetailModal (EXISTING - for reference)
 *
 * Modal already supports initialTab prop, so no changes needed.
 */
export interface TicketDetailModalProps {
  ticket: TicketData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: (ticket: TicketData) => void;
  projectId: number;

  /**
   * Initial tab to display when modal opens
   * Defaults to 'details' if not specified
   */
  initialTab?: 'details' | 'comments' | 'files';
}

/**
 * Ticket data shape expected by modal (EXISTING - for reference)
 */
export interface TicketData {
  id: number;
  ticketNumber: number;
  ticketKey: string;
  title: string;
  description: string | null;
  stage: string;
  version: number;
  projectId: number;
  branch: string | null;
  autoMode: boolean;
  clarificationPolicy: ClarificationPolicy | null;
  workflowType: 'FULL' | 'QUICK' | 'CLEAN';
  attachments?: TicketAttachment[] | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  project?: {
    clarificationPolicy: ClarificationPolicy;
    githubOwner?: string;
    githubRepo?: string;
  };
}

// ============================================================================
// Hook Return Types
// ============================================================================

/**
 * Return type for useNotificationNavigation hook
 */
export interface UseNotificationNavigationReturn {
  /**
   * Navigate to a notification's target ticket
   * Handles mark-as-read, URL construction, and navigation
   */
  navigateToNotification: (
    notification: NotificationWithNavData,
    currentProjectId: number
  ) => Promise<NavigationResult>;

  /**
   * Whether a navigation is currently in progress
   */
  isPending: boolean;

  /**
   * Error from last navigation attempt
   */
  error: Error | null;
}

/**
 * Return type for useMarkNotificationRead mutation
 */
export interface UseMarkNotificationReadReturn {
  /**
   * Mark notification as read
   * Uses optimistic updates
   */
  mutate: (notificationId: number) => void;

  /**
   * Async version with promise
   */
  mutateAsync: (notificationId: number) => Promise<MarkNotificationReadResponse>;

  /**
   * Whether mutation is in progress
   */
  isPending: boolean;

  /**
   * Error from last mutation attempt
   */
  error: Error | null;

  /**
   * Reset mutation state
   */
  reset: () => void;
}

// ============================================================================
// Utility Function Types
// ============================================================================

/**
 * Build navigation URL from notification data
 */
export type BuildNotificationUrl = (params: NotificationUrlParams) => string;

/**
 * Determine if notification is in same project as current context
 */
export type IsSameProject = (currentProjectId: number, targetProjectId: number) => boolean;

/**
 * Create navigation context from notification and current state
 */
export type CreateNavigationContext = (
  notification: NotificationWithNavData,
  currentProjectId: number
) => NavigationContext;

/**
 * Execute navigation based on context
 */
export type ExecuteNavigation = (context: NavigationContext) => Promise<NavigationResult>;

// ============================================================================
// State Types
// ============================================================================

/**
 * Notification navigation state (for UI components)
 */
export interface NotificationNavigationState {
  /** ID of notification being navigated to (null if none) */
  activeNotificationId: number | null;

  /** Whether navigation is in progress */
  isNavigating: boolean;

  /** Error message if navigation failed */
  error: string | null;
}

/**
 * Modal state (for Board component)
 */
export interface ModalState {
  /** Whether modal is open */
  isOpen: boolean;

  /** Ticket to display in modal */
  selectedTicket: TicketData | null;

  /** Initial tab to show when opening modal */
  initialTab: 'details' | 'comments' | 'files';
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation result for notification data
 */
export interface NotificationValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * URL validation result
 */
export interface UrlValidationResult {
  valid: boolean;
  sanitizedUrl?: string;
  error?: string;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Custom event dispatched when notification navigation completes
 */
export interface NotificationNavigationCompleteEvent extends CustomEvent {
  detail: {
    notificationId: number;
    success: boolean;
    method: 'push' | 'newTab';
    timestamp: Date;
  };
}

/**
 * Custom event dispatched when notification is marked as read
 */
export interface NotificationReadEvent extends CustomEvent {
  detail: {
    notificationId: number;
    readAt: Date;
    unreadCount: number;
  };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if value is NotificationWithNavData
 */
export function isNotificationWithNavData(value: unknown): value is NotificationWithNavData {
  const n = value as NotificationWithNavData;
  return (
    typeof n === 'object' &&
    n !== null &&
    typeof n.id === 'number' &&
    typeof n.projectId === 'number' &&
    typeof n.ticketKey === 'string' &&
    typeof n.commentId === 'number'
  );
}

/**
 * Type guard to check if value is MarkNotificationReadResponse
 */
export function isMarkNotificationReadResponse(
  value: unknown
): value is MarkNotificationReadResponse {
  const r = value as MarkNotificationReadResponse;
  return (
    typeof r === 'object' &&
    r !== null &&
    typeof r.success === 'boolean'
  );
}

/**
 * Type guard to check if value is ApiErrorResponse
 */
export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  const e = value as ApiErrorResponse;
  return (
    typeof e === 'object' &&
    e !== null &&
    e.success === false &&
    typeof e.error === 'string'
  );
}
