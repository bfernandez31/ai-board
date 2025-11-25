/**
 * Unit Tests for Navigation Utilities
 * Feature: Notification Click Navigation to Ticket Conversation Tab
 */

import { describe, it, expect } from 'vitest';
import {
  isSameProject,
  buildNotificationUrl,
  createNavigationContext,
  isValidNotificationForNavigation,
  parseProjectIdFromRoute,
} from '../../lib/utils/navigation-utils';
import type { NotificationWithNavData } from '../../lib/types/notification-navigation';

describe('isSameProject', () => {
  it('should return true when project IDs are equal', () => {
    expect(isSameProject(1, 1)).toBe(true);
    expect(isSameProject(123, 123)).toBe(true);
  });

  it('should return false when project IDs are different', () => {
    expect(isSameProject(1, 2)).toBe(false);
    expect(isSameProject(123, 456)).toBe(false);
  });

  it('should handle large project IDs', () => {
    expect(isSameProject(999999, 999999)).toBe(true);
    expect(isSameProject(999999, 999998)).toBe(false);
  });
});

describe('buildNotificationUrl', () => {
  it('should build URL with all required components', () => {
    const url = buildNotificationUrl({
      projectId: 1,
      ticketKey: 'ABC-123',
      commentId: 789,
    });

    expect(url).toBe('/projects/1/board?ticket=ABC-123&modal=open&tab=comments#comment-789');
  });

  it('should use custom tab parameter', () => {
    const url = buildNotificationUrl({
      projectId: 1,
      ticketKey: 'ABC-123',
      commentId: 789,
      tab: 'files',
    });

    expect(url).toBe('/projects/1/board?ticket=ABC-123&modal=open&tab=files#comment-789');
  });

  it('should default to comments tab', () => {
    const url = buildNotificationUrl({
      projectId: 1,
      ticketKey: 'ABC-123',
      commentId: 789,
    });

    expect(url).toContain('tab=comments');
  });

  it('should include ticket key as query parameter', () => {
    const url = buildNotificationUrl({
      projectId: 1,
      ticketKey: 'ABC-123',
      commentId: 789,
    });

    expect(url).toContain('ticket=ABC-123');
  });

  it('should throw error for invalid project ID', () => {
    expect(() =>
      buildNotificationUrl({
        projectId: 0,
        ticketKey: 'ABC-123',
        commentId: 789,
      })
    ).toThrow('Invalid project ID');

    expect(() =>
      buildNotificationUrl({
        projectId: -1,
        ticketKey: 'ABC-123',
        commentId: 789,
      })
    ).toThrow('Invalid project ID');
  });

  it('should throw error for empty ticket key', () => {
    expect(() =>
      buildNotificationUrl({
        projectId: 1,
        ticketKey: '',
        commentId: 789,
      })
    ).toThrow('Invalid ticket key');

    expect(() =>
      buildNotificationUrl({
        projectId: 1,
        ticketKey: '   ',
        commentId: 789,
      })
    ).toThrow('Invalid ticket key');
  });

  it('should throw error for invalid comment ID', () => {
    expect(() =>
      buildNotificationUrl({
        projectId: 1,
        ticketKey: 'ABC-123',
        commentId: 0,
      })
    ).toThrow('Invalid comment ID');

    expect(() =>
      buildNotificationUrl({
        projectId: 1,
        ticketKey: 'ABC-123',
        commentId: -1,
      })
    ).toThrow('Invalid comment ID');
  });
});

describe('createNavigationContext', () => {
  const mockNotification: NotificationWithNavData = {
    id: 1,
    recipientId: 'user-123',
    actorId: 'user-456',
    commentId: 789,
    ticketId: 100,
    read: false,
    readAt: null,
    createdAt: new Date(),
    deletedAt: null,
    projectId: 1,
    ticketKey: 'ABC-123',
    actorName: 'John Doe',
    actorImage: 'https://example.com/avatar.jpg',
    commentPreview: 'Test comment',
  };

  it('should create context for same-project navigation', () => {
    const context = createNavigationContext(mockNotification, 1);

    expect(context).toEqual({
      currentProjectId: 1,
      targetProjectId: 1,
      isSameProject: true,
      targetUrl: '/projects/1/board?ticket=ABC-123&modal=open&tab=comments#comment-789',
      shouldOpenNewTab: false,
    });
  });

  it('should create context for cross-project navigation', () => {
    const context = createNavigationContext(mockNotification, 2);

    expect(context).toEqual({
      currentProjectId: 2,
      targetProjectId: 1,
      isSameProject: false,
      targetUrl: '/projects/1/board?ticket=ABC-123&modal=open&tab=comments#comment-789',
      shouldOpenNewTab: true,
    });
  });

  it('should throw error for missing notification', () => {
    expect(() =>
      createNavigationContext(null as any, 1)
    ).toThrow('Notification is required');
  });

  it('should throw error for invalid projectId in notification', () => {
    const invalidNotification = { ...mockNotification, projectId: 0 };

    expect(() =>
      createNavigationContext(invalidNotification, 1)
    ).toThrow('Notification must have valid projectId');
  });

  it('should throw error for missing ticketKey', () => {
    const invalidNotification = { ...mockNotification, ticketKey: '' };

    expect(() =>
      createNavigationContext(invalidNotification, 1)
    ).toThrow('Notification must have valid ticketKey');
  });

  it('should throw error for invalid commentId', () => {
    const invalidNotification = { ...mockNotification, commentId: 0 };

    expect(() =>
      createNavigationContext(invalidNotification, 1)
    ).toThrow('Notification must have valid commentId');
  });

  it('should throw error for invalid currentProjectId', () => {
    expect(() =>
      createNavigationContext(mockNotification, 0)
    ).toThrow('Invalid current project ID');

    expect(() =>
      createNavigationContext(mockNotification, -1)
    ).toThrow('Invalid current project ID');
  });
});

describe('isValidNotificationForNavigation', () => {
  const validNotification = {
    id: 1,
    projectId: 1,
    ticketKey: 'ABC-123',
    commentId: 789,
  };

  it('should return true for valid notification', () => {
    expect(isValidNotificationForNavigation(validNotification)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isValidNotificationForNavigation(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isValidNotificationForNavigation(undefined)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(isValidNotificationForNavigation('string')).toBe(false);
    expect(isValidNotificationForNavigation(123)).toBe(false);
  });

  it('should return false for missing id', () => {
    const invalid = { ...validNotification };
    delete (invalid as any).id;
    expect(isValidNotificationForNavigation(invalid)).toBe(false);
  });

  it('should return false for invalid id', () => {
    expect(isValidNotificationForNavigation({ ...validNotification, id: 0 })).toBe(false);
    expect(isValidNotificationForNavigation({ ...validNotification, id: -1 })).toBe(false);
  });

  it('should return false for missing projectId', () => {
    const invalid = { ...validNotification };
    delete (invalid as any).projectId;
    expect(isValidNotificationForNavigation(invalid)).toBe(false);
  });

  it('should return false for invalid projectId', () => {
    expect(isValidNotificationForNavigation({ ...validNotification, projectId: 0 })).toBe(false);
    expect(isValidNotificationForNavigation({ ...validNotification, projectId: -1 })).toBe(false);
  });

  it('should return false for missing ticketKey', () => {
    const invalid = { ...validNotification };
    delete (invalid as any).ticketKey;
    expect(isValidNotificationForNavigation(invalid)).toBe(false);
  });

  it('should return false for empty ticketKey', () => {
    expect(isValidNotificationForNavigation({ ...validNotification, ticketKey: '' })).toBe(false);
    expect(isValidNotificationForNavigation({ ...validNotification, ticketKey: '   ' })).toBe(false);
  });

  it('should return false for missing commentId', () => {
    const invalid = { ...validNotification };
    delete (invalid as any).commentId;
    expect(isValidNotificationForNavigation(invalid)).toBe(false);
  });

  it('should return false for invalid commentId', () => {
    expect(isValidNotificationForNavigation({ ...validNotification, commentId: 0 })).toBe(false);
    expect(isValidNotificationForNavigation({ ...validNotification, commentId: -1 })).toBe(false);
  });
});

describe('parseProjectIdFromRoute', () => {
  it('should parse valid string project ID', () => {
    expect(parseProjectIdFromRoute('1')).toBe(1);
    expect(parseProjectIdFromRoute('123')).toBe(123);
  });

  it('should pass through valid number project ID', () => {
    expect(parseProjectIdFromRoute(1)).toBe(1);
    expect(parseProjectIdFromRoute(123)).toBe(123);
  });

  it('should return null for undefined', () => {
    expect(parseProjectIdFromRoute(undefined)).toBeNull();
  });

  it('should return null for null', () => {
    expect(parseProjectIdFromRoute(null)).toBeNull();
  });

  it('should return null for invalid string', () => {
    expect(parseProjectIdFromRoute('abc')).toBeNull();
    expect(parseProjectIdFromRoute('abc12')).toBeNull();
  });

  it('should return null for zero', () => {
    expect(parseProjectIdFromRoute('0')).toBeNull();
    expect(parseProjectIdFromRoute(0)).toBeNull();
  });

  it('should return null for negative numbers', () => {
    expect(parseProjectIdFromRoute('-1')).toBeNull();
    expect(parseProjectIdFromRoute(-1)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(parseProjectIdFromRoute('')).toBeNull();
  });
});
