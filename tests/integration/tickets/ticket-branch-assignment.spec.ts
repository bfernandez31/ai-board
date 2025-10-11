import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Integration Test: Branch assignment workflow (Scenario 2)
 *
 * Tests the complete workflow of assigning a branch to a ticket:
 * 1. Create ticket (branch should be null)
 * 2. Update branch via specialized /branch endpoint
 * 3. Query ticket to verify persistence
 *
 * This simulates the /specify workflow creating a Git branch.
 */
test.describe('Integration: Branch assignment workflow', () => {
  let testProjectId: number;

  test.beforeAll(async () => {
    // Create a test project
    const project = await prisma.project.create({
      data: {
        name: 'Branch Assignment Test Project',
        description: 'Project for testing branch assignment workflow',
        githubOwner: 'integration-test-owner',
        githubRepo: 'branch-assignment-test',
      },
    });
    testProjectId = project.id;
  });

  test.afterAll(async () => {
    // Clean up all test data
    await prisma.ticket.deleteMany({
      where: { projectId: testProjectId },
    });
    await prisma.project.delete({
      where: { id: testProjectId },
    });
    await prisma.$disconnect();
  });

  test('should assign branch via specialized endpoint and persist to database', async ({
    request,
  }) => {
    // Step 1: Create ticket (branch should be null)
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: '[e2e] Feature requiring branch tracking',
          description: 'This ticket will have a branch assigned',
        },
      }
    );

    expect(createResponse.status()).toBe(201);

    const createdTicket = await createResponse.json();
    const ticketId = createdTicket.id;

    // Verify initial state: branch is null
    expect(createdTicket.branch).toBeNull();

    // Step 2: Assign branch via specialized /branch endpoint
    const updateResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}/branch`,
      {
        data: {
          branch: '014-add-github-branch',
        },
      }
    );

    expect(updateResponse.status()).toBe(200);

    const updateResult = await updateResponse.json();

    // Verify response from /branch endpoint (minimal response)
    expect(updateResult).toHaveProperty('id', ticketId);
    expect(updateResult).toHaveProperty('branch', '014-add-github-branch');
    expect(updateResult).toHaveProperty('updatedAt');

    // Step 3: Query ticket via GET to verify persistence
    const getResponse = await request.get(
      `/api/projects/${testProjectId}/tickets/${ticketId}`
    );

    expect(getResponse.status()).toBe(200);

    const fetchedTicket = await getResponse.json();

    // Verify branch persisted correctly
    expect(fetchedTicket.branch).toBe('014-add-github-branch');
    expect(fetchedTicket.title).toBe('[e2e] Feature requiring branch tracking');
    expect(fetchedTicket.autoMode).toBe(false); // Should remain unchanged

    // Step 4: Verify in database directly
    const dbTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    expect(dbTicket).not.toBeNull();
    expect(dbTicket!.branch).toBe('014-add-github-branch');

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  test('should support updating branch multiple times', async ({ request }) => {
    // Create ticket
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: '[e2e] Ticket with changing branch',
          description: 'Branch will be updated multiple times',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // First branch assignment
    await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}/branch`,
      {
        data: { branch: '001-initial-branch' },
      }
    );

    let fetchedTicket = await (
      await request.get(`/api/projects/${testProjectId}/tickets/${ticketId}`)
    ).json();
    expect(fetchedTicket.branch).toBe('001-initial-branch');

    // Second branch assignment (update)
    await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}/branch`,
      {
        data: { branch: '002-updated-branch' },
      }
    );

    fetchedTicket = await (
      await request.get(`/api/projects/${testProjectId}/tickets/${ticketId}`)
    ).json();
    expect(fetchedTicket.branch).toBe('002-updated-branch');

    // Third branch assignment (another update)
    await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}/branch`,
      {
        data: { branch: '003-final-branch' },
      }
    );

    fetchedTicket = await (
      await request.get(`/api/projects/${testProjectId}/tickets/${ticketId}`)
    ).json();
    expect(fetchedTicket.branch).toBe('003-final-branch');

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  test('should handle branch names with various valid formats', async ({
    request,
  }) => {
    const validBranchNames = [
      '014-add-github-branch',
      '123-feature-name',
      '999-fix-critical-bug',
      '001-simple',
      '42-answer-to-everything',
      '100-long-descriptive-feature-name-with-many-words',
    ];

    for (const branchName of validBranchNames) {
      // Create ticket
      const createResponse = await request.post(
        `/api/projects/${testProjectId}/tickets`,
        {
          data: {
            title: `Test ${branchName}`,
            description: 'Testing branch name format',
          },
        }
      );

      const ticket = await createResponse.json();

      // Assign branch
      const updateResponse = await request.patch(
        `/api/projects/${testProjectId}/tickets/${ticket.id}/branch`,
        {
          data: { branch: branchName },
        }
      );

      expect(updateResponse.status()).toBe(200);

      const result = await updateResponse.json();
      expect(result.branch).toBe(branchName);

      // Clean up
      await prisma.ticket.delete({ where: { id: ticket.id } });
    }
  });

  test('should preserve other ticket fields when updating branch', async ({
    request,
  }) => {
    // Create ticket with specific values
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: '[e2e] Original Title',
          description: 'Original Description',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Capture initial values
    const initialTitle = ticket.title;
    const initialDescription = ticket.description;
    const initialStage = ticket.stage;
    const initialVersion = ticket.version;
    const initialCreatedAt = ticket.createdAt;

    // Update only the branch
    await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}/branch`,
      {
        data: { branch: '014-new-branch' },
      }
    );

    // Fetch ticket and verify other fields unchanged
    const fetchedTicket = await (
      await request.get(`/api/projects/${testProjectId}/tickets/${ticketId}`)
    ).json();

    expect(fetchedTicket.branch).toBe('014-new-branch');
    expect(fetchedTicket.title).toBe(initialTitle);
    expect(fetchedTicket.description).toBe(initialDescription);
    expect(fetchedTicket.stage).toBe(initialStage);
    expect(fetchedTicket.version).toBe(initialVersion);
    expect(fetchedTicket.createdAt).toBe(initialCreatedAt);

    // updatedAt should change
    expect(fetchedTicket.updatedAt).not.toBe(ticket.updatedAt);

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  test('should update updatedAt timestamp when branch changes', async ({
    request,
  }) => {
    // Create ticket
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: '[e2e] Timestamp test',
          description: 'Testing updatedAt changes',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;
    const initialUpdatedAt = new Date(ticket.updatedAt);

    // Wait a moment to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Update branch
    const updateResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}/branch`,
      {
        data: { branch: '014-timestamp-test' },
      }
    );

    const updateResult = await updateResponse.json();
    const newUpdatedAt = new Date(updateResult.updatedAt);

    // Verify timestamp was updated
    expect(newUpdatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });
});
