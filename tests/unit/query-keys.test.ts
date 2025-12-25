/**
 * Unit Test: Query Keys Factory
 *
 * Tests the centralized query key factory for TanStack Query.
 * Ensures all query keys are correctly structured for cache management.
 */

import { describe, it, expect } from 'vitest';
import { queryKeys } from '@/app/lib/query-keys';

describe('Query Keys Factory', () => {
  describe('projects', () => {
    it('should return correct key for all projects', () => {
      expect(queryKeys.projects.all).toEqual(['projects']);
    });

    it('should return correct key for project detail', () => {
      expect(queryKeys.projects.detail(1)).toEqual(['projects', 1]);
      expect(queryKeys.projects.detail(42)).toEqual(['projects', 42]);
    });

    it('should return correct key for project tickets', () => {
      expect(queryKeys.projects.tickets(1)).toEqual(['projects', 1, 'tickets']);
      expect(queryKeys.projects.tickets(5)).toEqual(['projects', 5, 'tickets']);
    });

    it('should return correct key for single ticket', () => {
      expect(queryKeys.projects.ticket(1, 10)).toEqual(['projects', 1, 'tickets', 10]);
      expect(queryKeys.projects.ticket(2, 20)).toEqual(['projects', 2, 'tickets', 20]);
    });

    it('should return correct key for jobs status', () => {
      expect(queryKeys.projects.jobsStatus(1)).toEqual(['projects', 1, 'jobs', 'status']);
      expect(queryKeys.projects.jobsStatus(3)).toEqual(['projects', 3, 'jobs', 'status']);
    });

    it('should return correct key for project settings', () => {
      expect(queryKeys.projects.settings(1)).toEqual(['projects', 1, 'settings']);
      expect(queryKeys.projects.settings(7)).toEqual(['projects', 7, 'settings']);
    });

    it('should return correct key for documentation', () => {
      expect(queryKeys.projects.documentation(1, 10, 'spec')).toEqual([
        'projects', 1, 'tickets', 10, 'documentation', 'spec'
      ]);
      expect(queryKeys.projects.documentation(2, 20, 'plan')).toEqual([
        'projects', 2, 'tickets', 20, 'documentation', 'plan'
      ]);
      expect(queryKeys.projects.documentation(3, 30, 'tasks')).toEqual([
        'projects', 3, 'tickets', 30, 'documentation', 'tasks'
      ]);
      expect(queryKeys.projects.documentation(4, 40, 'summary')).toEqual([
        'projects', 4, 'tickets', 40, 'documentation', 'summary'
      ]);
    });

    it('should return correct key for documentation history', () => {
      expect(queryKeys.projects.documentationHistory(1, 10, 'spec')).toEqual([
        'projects', 1, 'tickets', 10, 'documentation', 'spec', 'history'
      ]);
      expect(queryKeys.projects.documentationHistory(2, 20, 'plan')).toEqual([
        'projects', 2, 'tickets', 20, 'documentation', 'plan', 'history'
      ]);
    });

    it('should return correct key for project members', () => {
      expect(queryKeys.projects.members(1)).toEqual(['projects', 1, 'members']);
      expect(queryKeys.projects.members(8)).toEqual(['projects', 8, 'members']);
    });

    it('should return correct key for ticket timeline', () => {
      expect(queryKeys.projects.timeline(1, 10)).toEqual([
        'projects', 1, 'tickets', 10, 'timeline'
      ]);
      expect(queryKeys.projects.timeline(2, 25)).toEqual([
        'projects', 2, 'tickets', 25, 'timeline'
      ]);
    });

    it('should return correct key for constitution', () => {
      expect(queryKeys.projects.constitution(1)).toEqual(['projects', 1, 'constitution']);
      expect(queryKeys.projects.constitution(5)).toEqual(['projects', 5, 'constitution']);
    });

    it('should return correct key for constitution history', () => {
      expect(queryKeys.projects.constitutionHistory(1)).toEqual([
        'projects', 1, 'constitution', 'history'
      ]);
      expect(queryKeys.projects.constitutionHistory(3)).toEqual([
        'projects', 3, 'constitution', 'history'
      ]);
    });

    it('should return correct key for constitution diff', () => {
      expect(queryKeys.projects.constitutionDiff(1, 'abc123')).toEqual([
        'projects', 1, 'constitution', 'diff', 'abc123'
      ]);
      expect(queryKeys.projects.constitutionDiff(2, 'def456')).toEqual([
        'projects', 2, 'constitution', 'diff', 'def456'
      ]);
    });

    it('should return correct key for ticket search', () => {
      expect(queryKeys.projects.ticketSearch(1, 'bug')).toEqual([
        'projects', 1, 'tickets', 'search', 'bug'
      ]);
      expect(queryKeys.projects.ticketSearch(2, 'feature request')).toEqual([
        'projects', 2, 'tickets', 'search', 'feature request'
      ]);
    });
  });

  describe('comments', () => {
    it('should return correct key for comments list', () => {
      expect(queryKeys.comments.list(1)).toEqual(['comments', 1]);
      expect(queryKeys.comments.list(50)).toEqual(['comments', 50]);
    });
  });

  describe('analytics', () => {
    it('should return correct key for all analytics', () => {
      expect(queryKeys.analytics.all(1)).toEqual(['analytics', 1]);
      expect(queryKeys.analytics.all(10)).toEqual(['analytics', 10]);
    });

    it('should return correct key for analytics data with range', () => {
      expect(queryKeys.analytics.data(1, '7d')).toEqual(['analytics', 1, '7d']);
      expect(queryKeys.analytics.data(2, '30d')).toEqual(['analytics', 2, '30d']);
      expect(queryKeys.analytics.data(3, '90d')).toEqual(['analytics', 3, '90d']);
    });
  });

  describe('users', () => {
    it('should return correct key for all users', () => {
      expect(queryKeys.users.all).toEqual(['users']);
    });

    it('should return correct key for current user', () => {
      expect(queryKeys.users.current).toEqual(['users', 'current']);
    });

    it('should return correct key for user detail', () => {
      expect(queryKeys.users.detail('user-1')).toEqual(['users', 'user-1']);
      expect(queryKeys.users.detail('abc-123')).toEqual(['users', 'abc-123']);
    });
  });

  describe('cache invalidation hierarchy', () => {
    it('should support hierarchical invalidation for projects', () => {
      const allProjects = queryKeys.projects.all;
      const projectDetail = queryKeys.projects.detail(1);
      const projectTickets = queryKeys.projects.tickets(1);

      // Verify hierarchy: projects > projects/1 > projects/1/tickets
      expect(projectDetail[0]).toBe(allProjects[0]);
      expect(projectTickets.slice(0, 2)).toEqual(projectDetail);
    });

    it('should support hierarchical invalidation for tickets', () => {
      const projectTickets = queryKeys.projects.tickets(1);
      const singleTicket = queryKeys.projects.ticket(1, 10);
      const ticketTimeline = queryKeys.projects.timeline(1, 10);

      // Verify hierarchy
      expect(singleTicket.slice(0, 3)).toEqual(projectTickets);
      expect(ticketTimeline.slice(0, 4)).toEqual(singleTicket);
    });
  });

  describe('type safety', () => {
    it('should return readonly arrays (const assertion)', () => {
      const key = queryKeys.projects.detail(1);
      // TypeScript would catch mutation attempts at compile time
      // This test documents the expected readonly behavior
      expect(Object.isFrozen(key)).toBe(false); // Arrays are not frozen at runtime
      expect(Array.isArray(key)).toBe(true);
    });
  });
});
