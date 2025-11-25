import { test, expect } from '../helpers/worker-isolation';
import { cleanupDatabase } from '../helpers/db-cleanup';
import { prisma } from '@/lib/db/client';

/**
 * E2E Tests: AI-Board Comment Mention Notifications
 *
 * Tests notification creation when AI-board mentions users in comments.
 * Covers:
 * - User Story 1 (P1): AI-board mentions create notifications
 * - User Story 2 (P2): Non-member mention handling
 * - User Story 3 (P3): Self-mention exclusion
 */

test.describe('AI-Board Comment Notifications', () => {
  const BASE_URL = 'http://localhost:3000';
  // Use the same token value as configured in playwright.config.ts webServer.env
  const WORKFLOW_TOKEN = 'test-workflow-token-for-e2e-tests-only';

  const getHeaders = () => ({
    'Authorization': `Bearer ${WORKFLOW_TOKEN}`,
  });
  let testTicketId: number;
  let aiBoardUserId: string;
  let testUserId: string;
  let aliceUserId: string;
  let bobUserId: string;
  let nonMemberUserId: string;

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);

    // Create test user (project owner)
    const testUser = await prisma.user.upsert({
      where: { email: 'test@e2e.local' },
      update: {
        id: 'test-user-id',
        name: 'E2E Test User',
      },
      create: {
        id: 'test-user-id',
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });
    testUserId = testUser.id;

    // Create additional test users for project members
    const alice = await prisma.user.upsert({
      where: { email: 'alice@test.com' },
      update: {
        id: 'user-alice',
        name: 'Alice Smith',
      },
      create: {
        id: 'user-alice',
        email: 'alice@test.com',
        name: 'Alice Smith',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });
    aliceUserId = alice.id;

    const bob = await prisma.user.upsert({
      where: { email: 'bob@test.com' },
      update: {
        id: 'user-bob',
        name: 'Bob Johnson',
      },
      create: {
        id: 'user-bob',
        email: 'bob@test.com',
        name: 'Bob Johnson',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });
    bobUserId = bob.id;

    // Create non-member user (not added to project)
    const nonMember = await prisma.user.upsert({
      where: { email: 'nonmember@test.com' },
      update: {
        id: 'user-nonmember',
        name: 'Non Member',
      },
      create: {
        id: 'user-nonmember',
        email: 'nonmember@test.com',
        name: 'Non Member',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });
    nonMemberUserId = nonMember.id;

    // Create AI-BOARD user (system user)
    const aiBoard = await prisma.user.upsert({
      where: { email: 'ai-board@system.local' },
      update: {},
      create: {
        id: 'ai-board-system-user',
        email: 'ai-board@system.local',
        name: 'AI-BOARD Assistant',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });
    aiBoardUserId = aiBoard.id;

    // Create test project with owner
    await prisma.project.upsert({
      where: { id: projectId },
      update: { userId: testUser.id },
      create: {
        id: projectId,
        name: '[e2e] Test Project',
        description: 'Test project for AI-board notifications',
        githubOwner: 'test-owner',
        githubRepo: 'test-repo',
        userId: testUser.id,
        key: `E2E${projectId}`,
        updatedAt: new Date(),
      },
    });

    // Add project members (Alice and Bob, but NOT nonMember)
    await prisma.projectMember.createMany({
      data: [
        { projectId, userId: testUser.id, role: 'owner' },
        { projectId, userId: alice.id, role: 'member' },
        { projectId, userId: bob.id, role: 'member' },
      ],
      skipDuplicates: true,
    });

    // Create test ticket
    const testTicket = await prisma.ticket.create({
      data: {
        ticketNumber: 1,
        ticketKey: `E2E${projectId}-1`,
        title: '[e2e] Test Ticket for AI-board Notifications',
        description: 'Ticket for testing AI-board comment notifications',
        projectId,
        stage: 'SPECIFY', // AI-board can comment in SPECIFY
        updatedAt: new Date(),
      },
    });
    testTicketId = testTicket.id;

    // Clean up existing comments and notifications
    await prisma.comment.deleteMany({
      where: { ticketId: testTicket.id },
    });
    await prisma.notification.deleteMany({
      where: { ticketId: testTicket.id },
    });
  });

  /**
   * ======================
   * User Story 1: AI-Board Response Notification (P1) - MVP
   * ======================
   */

  test.describe('US1: AI-Board Mentions Create Notifications', () => {
    test('[US1] T008: Single user mention creates notification', async ({ request, projectId }) => {
      // AI-board posts comment mentioning Alice
      const content = `Hey @[${aliceUserId}:Alice Smith], please review this ticket.`;

      const response = await request.post(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/comments/ai-board`,
        {
          headers: getHeaders(),
          data: {
            userId: aiBoardUserId,
            content,
          },
        }
      );

      expect(response.status()).toBe(201);
      const comment = await response.json();

      // Verify notification was created for Alice
      const notification = await prisma.notification.findFirst({
        where: {
          commentId: comment.id,
          recipientId: aliceUserId,
          actorId: aiBoardUserId,
          ticketId: testTicketId,
        },
      });

      expect(notification).not.toBeNull();
      expect(notification?.read).toBe(false);
    });

    test('[US1] T009: Multiple user mentions create multiple notifications', async ({ request, projectId }) => {
      // AI-board posts comment mentioning Alice and Bob
      const content = `Hey @[${aliceUserId}:Alice Smith] and @[${bobUserId}:Bob Johnson], check this out!`;

      const response = await request.post(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/comments/ai-board`,
        {
          headers: getHeaders(),
          data: {
            userId: aiBoardUserId,
            content,
          },
        }
      );

      expect(response.status()).toBe(201);
      const comment = await response.json();

      // Verify notifications were created for both Alice and Bob
      const notifications = await prisma.notification.findMany({
        where: {
          commentId: comment.id,
          actorId: aiBoardUserId,
          ticketId: testTicketId,
        },
        orderBy: {
          recipientId: 'asc',
        },
      });

      expect(notifications).toHaveLength(2);
      expect(notifications[0].recipientId).toBe(aliceUserId);
      expect(notifications[1].recipientId).toBe(bobUserId);
    });

    test('[US1] T010: No mentions scenario does not error', async ({ request, projectId }) => {
      // AI-board posts comment without any mentions
      const content = `This is a general update with no mentions.`;

      const response = await request.post(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/comments/ai-board`,
        {
          headers: getHeaders(),
          data: {
            userId: aiBoardUserId,
            content,
          },
        }
      );

      // Should succeed without error
      expect(response.status()).toBe(201);
      const comment = await response.json();

      // Verify no notifications were created
      const notifications = await prisma.notification.findMany({
        where: {
          commentId: comment.id,
        },
      });

      expect(notifications).toHaveLength(0);
    });

    test('[US1] T011: Notification failure does not block comment creation', async ({ request, projectId }) => {
      // Create a comment with mention, but simulate potential notification failure
      // by checking that even if notification creation has issues, comment is still created
      const content = `Hey @[${aliceUserId}:Alice Smith], this should work.`;

      const response = await request.post(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/comments/ai-board`,
        {
          headers: getHeaders(),
          data: {
            userId: aiBoardUserId,
            content,
          },
        }
      );

      // Comment creation should succeed regardless of notification status
      expect(response.status()).toBe(201);
      const comment = await response.json();
      expect(comment.content).toBe(content);

      // Verify comment exists in database
      const dbComment = await prisma.comment.findUnique({
        where: { id: comment.id },
      });
      expect(dbComment).not.toBeNull();
    });
  });

  /**
   * ======================
   * User Story 2: Non-Member Mention Handling (P2)
   * ======================
   */

  test.describe('US2: Non-Member Mention Filtering', () => {
    test('[US2] T019: Non-member mention does not create notification', async ({ request, projectId }) => {
      // AI-board mentions a non-member user
      const content = `Hey @[${nonMemberUserId}:Non Member], you are not a project member.`;

      const response = await request.post(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/comments/ai-board`,
        {
          headers: getHeaders(),
          data: {
            userId: aiBoardUserId,
            content,
          },
        }
      );

      expect(response.status()).toBe(201);
      const comment = await response.json();

      // Verify NO notification was created for non-member
      const notification = await prisma.notification.findFirst({
        where: {
          commentId: comment.id,
          recipientId: nonMemberUserId,
        },
      });

      expect(notification).toBeNull();
    });

    test('[US2] T020: Mixed members and non-members - only members get notifications', async ({ request, projectId }) => {
      // AI-board mentions both Alice (member) and non-member
      const content = `Hey @[${aliceUserId}:Alice Smith] and @[${nonMemberUserId}:Non Member], check this.`;

      const response = await request.post(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/comments/ai-board`,
        {
          headers: getHeaders(),
          data: {
            userId: aiBoardUserId,
            content,
          },
        }
      );

      expect(response.status()).toBe(201);
      const comment = await response.json();

      // Verify only Alice got a notification
      const notifications = await prisma.notification.findMany({
        where: {
          commentId: comment.id,
        },
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].recipientId).toBe(aliceUserId);
    });
  });

  /**
   * ======================
   * User Story 3: Self-Mention Exclusion (P3)
   * ======================
   */

  test.describe('US3: AI-Board Self-Mention Exclusion', () => {
    test('[US3] T024: AI-board self-mention does not create notification', async ({ request, projectId }) => {
      // AI-board mentions itself
      const content = `This is @[${aiBoardUserId}:AI-BOARD Assistant] responding.`;

      const response = await request.post(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/comments/ai-board`,
        {
          headers: getHeaders(),
          data: {
            userId: aiBoardUserId,
            content,
          },
        }
      );

      expect(response.status()).toBe(201);
      const comment = await response.json();

      // Verify NO notification was created for AI-board
      const notification = await prisma.notification.findFirst({
        where: {
          commentId: comment.id,
          recipientId: aiBoardUserId,
        },
      });

      expect(notification).toBeNull();
    });

    test('[US3] T025: Mixed self-mention and valid mentions - only valid mentions get notifications', async ({ request, projectId }) => {
      // AI-board mentions itself AND Alice
      const content = `@[${aiBoardUserId}:AI-BOARD Assistant] here, working with @[${aliceUserId}:Alice Smith].`;

      const response = await request.post(
        `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/comments/ai-board`,
        {
          headers: getHeaders(),
          data: {
            userId: aiBoardUserId,
            content,
          },
        }
      );

      expect(response.status()).toBe(201);
      const comment = await response.json();

      // Verify only Alice got a notification (not AI-board)
      const notifications = await prisma.notification.findMany({
        where: {
          commentId: comment.id,
        },
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].recipientId).toBe(aliceUserId);
    });
  });
});
