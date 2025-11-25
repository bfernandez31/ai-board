/**
 * Notification Navigation Type Exports
 * Feature: Notification Click Navigation to Ticket Conversation Tab
 *
 * This file re-exports type definitions from the contracts directory
 * to provide a centralized import location for application code.
 */

export type {
  NavigationContext,
  NotificationUrlParams,
  NavigationResult,
  NotificationWithNavData,
  NotificationClickEvent,
  MarkNotificationReadRequest,
  MarkNotificationReadResponse,
  NotificationListResponse,
  ApiErrorResponse,
  TicketDetailModalProps,
  TicketData,
  UseNotificationNavigationReturn,
  UseMarkNotificationReadReturn,
  BuildNotificationUrl,
  IsSameProject,
  CreateNavigationContext,
  ExecuteNavigation,
  NotificationNavigationState,
  ModalState,
  NotificationValidationResult,
  UrlValidationResult,
  NotificationNavigationCompleteEvent,
  NotificationReadEvent,
} from '../../specs/AIB-80-show-ticket-conversation/contracts/interfaces';

export {
  isNotificationWithNavData,
  isMarkNotificationReadResponse,
  isApiErrorResponse,
} from '../../specs/AIB-80-show-ticket-conversation/contracts/interfaces';
