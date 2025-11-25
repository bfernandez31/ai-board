/**
 * Zod Validation Schemas for Notification Navigation
 * Feature: Notification Click Navigation to Ticket Conversation Tab
 */

import { z } from 'zod';

/**
 * Schema for notification navigation parameters
 * Used to validate data before building navigation URLs
 */
export const NotificationNavigationSchema = z.object({
  notificationId: z.number().int().positive('Notification ID must be a positive integer'),
  currentProjectId: z.number().int().positive('Current project ID must be a positive integer'),
  targetProjectId: z.number().int().positive('Target project ID must be a positive integer'),
  ticketKey: z.string().min(1, 'Ticket key is required').max(20, 'Ticket key must be at most 20 characters'),
  commentId: z.number().int().positive('Comment ID must be a positive integer'),
});

export type NotificationNavigation = z.infer<typeof NotificationNavigationSchema>;

/**
 * Schema for URL parameters when building notification navigation URLs
 */
export const NotificationUrlParamsSchema = z.object({
  projectId: z.number().int().positive('Project ID must be a positive integer'),
  ticketKey: z.string().min(1, 'Ticket key is required').max(20, 'Ticket key must be at most 20 characters'),
  commentId: z.number().int().positive('Comment ID must be a positive integer'),
  tab: z.enum(['details', 'comments', 'files']).optional().default('comments'),
});

export type NotificationUrlParams = z.infer<typeof NotificationUrlParamsSchema>;

/**
 * Schema for mark notification as read request
 * Used in API endpoint
 */
export const MarkNotificationReadRequestSchema = z.object({
  notificationId: z.number().int().positive('Notification ID must be a positive integer'),
});

export type MarkNotificationReadRequest = z.infer<typeof MarkNotificationReadRequestSchema>;

/**
 * Schema for mark notification as read response
 * Returned by API endpoint
 */
export const MarkNotificationReadResponseSchema = z.object({
  success: z.boolean(),
  notification: z.object({
    id: z.number(),
    read: z.boolean(),
    readAt: z.string().datetime(),
  }).optional(),
  error: z.string().optional(),
});

export type MarkNotificationReadResponse = z.infer<typeof MarkNotificationReadResponseSchema>;

/**
 * Schema for notification with navigation data
 * Extended notification object with joined fields for navigation
 */
export const NotificationWithNavDataSchema = z.object({
  // Base notification fields
  id: z.number().int().positive(),
  recipientId: z.string().min(1),
  actorId: z.string().min(1),
  commentId: z.number().int().positive(),
  ticketId: z.number().int().positive(),
  read: z.boolean(),
  readAt: z.date().nullable(),
  createdAt: z.date(),
  deletedAt: z.date().nullable(),

  // Joined fields for navigation
  projectId: z.number().int().positive(),
  ticketKey: z.string().min(1).max(20),
  actorName: z.string().min(1),
  actorImage: z.string().url().nullable(),
  commentPreview: z.string().max(100),
});

export type NotificationWithNavData = z.infer<typeof NotificationWithNavDataSchema>;

/**
 * Schema for navigation context
 * Used to determine navigation strategy (same window vs new tab)
 */
export const NavigationContextSchema = z.object({
  currentProjectId: z.number().int().positive(),
  targetProjectId: z.number().int().positive(),
  isSameProject: z.boolean(),
  targetUrl: z.string().url(),
  shouldOpenNewTab: z.boolean(),
});

export type NavigationContext = z.infer<typeof NavigationContextSchema>;
