/**
 * Integration Tests: Database Constraints
 *
 * Migrated from: tests/database/ticket-project-constraints.spec.ts,
 *                tests/database/project-uniqueness.spec.ts,
 *                tests/database/project-cascade.spec.ts
 *
 * Tests for database-level constraints (NOT NULL, foreign keys, cascades).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createTestProject, createTestTicket } from '@/tests/helpers/db-setup';

const uniqueId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

describe('Database Constraints', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();
  const createdProjectIds: number[] = [];

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    createdProjectIds.length = 0;
  });

  afterEach(async () => {
    if (createdProjectIds.length > 0) {
      await prisma.project.deleteMany({
        where: { id: { in: createdProjectIds } },
      });
    }
  });

  describe('Ticket-Project Constraints', () => {
    it('should fail to create ticket without projectId', async () => {
      // Test that projectId is required at database level
      const createPromise = prisma.$executeRaw`
        INSERT INTO "Ticket" ("title", "description", "stage", "version", "createdAt", "updatedAt")
        VALUES ('Test Ticket', 'Test description', 'INBOX', 1, NOW(), NOW())
      `;

      await expect(createPromise).rejects.toThrow();
    });

    it('should fail to create ticket with invalid projectId', async () => {
      const createPromise = prisma.ticket.create({
        data: {
          title: '[e2e] Test Ticket',
          description: 'Test description',
          projectId: 99999, // Non-existent project ID
          ticketNumber: 1,
          ticketKey: 'TST-1',
          updatedAt: new Date(),
        },
      });

      await expect(createPromise).rejects.toThrow();
    });

    it('should cascade delete tickets when project is deleted', async () => {
      const id = uniqueId();

      const project = await createTestProject({
        name: '[e2e] Cascade Test Project',
        description: 'Project for testing cascade delete',
        githubOwner: `test-owner-${id}`,
        githubRepo: `cascade-test-repo-${id}`,
        key: 'CAD',
      });
      createdProjectIds.push(project.id);

      // Create multiple tickets
      await createTestTicket(project.id, {
        title: '[e2e] Ticket 1',
        description: 'First ticket',
        ticketNumber: 1,
        ticketKey: `CAD-1-${id}`,
      });

      await createTestTicket(project.id, {
        title: '[e2e] Ticket 2',
        description: 'Second ticket',
        ticketNumber: 2,
        ticketKey: `CAD-2-${id}`,
      });

      await createTestTicket(project.id, {
        title: '[e2e] Ticket 3',
        description: 'Third ticket',
        ticketNumber: 3,
        ticketKey: `CAD-3-${id}`,
      });

      // Verify tickets were created
      const ticketsBeforeDelete = await prisma.ticket.findMany({
        where: { projectId: project.id },
      });
      expect(ticketsBeforeDelete).toHaveLength(3);

      // Delete the project
      await prisma.project.delete({
        where: { id: project.id },
      });

      // Verify all tickets were cascaded
      const ticketsAfterDelete = await prisma.ticket.findMany({
        where: { projectId: project.id },
      });
      expect(ticketsAfterDelete).toHaveLength(0);
    });

    it('should return only tickets for specified project', async () => {
      const id = uniqueId();

      const project1 = await createTestProject({
        name: '[e2e] Project 1',
        description: 'First project',
        githubOwner: `owner1-${id}`,
        githubRepo: `repo1-${id}`,
        key: 'P1X',
      });
      createdProjectIds.push(project1.id);

      const project2 = await createTestProject({
        name: '[e2e] Project 2',
        description: 'Second project',
        githubOwner: `owner2-${id}`,
        githubRepo: `repo2-${id}`,
        key: 'P2X',
      });
      createdProjectIds.push(project2.id);

      // Create tickets for project 1
      await createTestTicket(project1.id, {
        title: '[e2e] Project 1 - Ticket 1',
        ticketNumber: 1,
        ticketKey: `P1X-1-${id}`,
      });

      await createTestTicket(project1.id, {
        title: '[e2e] Project 1 - Ticket 2',
        ticketNumber: 2,
        ticketKey: `P1X-2-${id}`,
      });

      // Create tickets for project 2
      await createTestTicket(project2.id, {
        title: '[e2e] Project 2 - Ticket 1',
        ticketNumber: 1,
        ticketKey: `P2X-1-${id}`,
      });

      // Query tickets for project 1 only
      const project1Tickets = await prisma.ticket.findMany({
        where: { projectId: project1.id },
      });

      expect(project1Tickets).toHaveLength(2);
      expect(project1Tickets.every((t) => t.projectId === project1.id)).toBe(true);

      // Query tickets for project 2 only
      const project2Tickets = await prisma.ticket.findMany({
        where: { projectId: project2.id },
      });

      expect(project2Tickets).toHaveLength(1);
      expect(project2Tickets.every((t) => t.projectId === project2.id)).toBe(true);
    });

    it('should allow querying tickets via project relation', async () => {
      const id = uniqueId();

      const project = await createTestProject({
        name: '[e2e] Relation Test Project',
        description: 'Project for testing relations',
        githubOwner: `relation-owner-${id}`,
        githubRepo: `relation-repo-${id}`,
        key: 'REL',
      });
      createdProjectIds.push(project.id);

      await createTestTicket(project.id, {
        title: '[e2e] Ticket 1',
        stage: 'INBOX',
        ticketNumber: 1,
        ticketKey: `REL-1-${id}`,
      });

      await createTestTicket(project.id, {
        title: '[e2e] Ticket 2',
        stage: 'PLAN',
        ticketNumber: 2,
        ticketKey: `REL-2-${id}`,
      });

      const projectWithTickets = await prisma.project.findUnique({
        where: { id: project.id },
        include: { tickets: true },
      });

      expect(projectWithTickets).toBeDefined();
      expect(projectWithTickets?.tickets).toHaveLength(2);
      expect(projectWithTickets?.tickets.every((t) => t.projectId === project.id)).toBe(true);
    });

    it('should enforce projectId NOT NULL constraint', async () => {
      const createPromise = prisma.ticket.create({
        data: {
          title: '[e2e] Test Ticket',
          description: 'Test description',
          projectId: null as unknown as number,
          ticketNumber: 1,
          ticketKey: 'TST-1',
          updatedAt: new Date(),
        },
      });

      await expect(createPromise).rejects.toThrow();
    });
  });

  describe('Project Uniqueness Constraints', () => {
    it('should enforce unique project key', async () => {
      const id = uniqueId();

      const project1 = await createTestProject({
        name: '[e2e] Unique Key Test 1',
        githubOwner: `owner-${id}`,
        githubRepo: `repo1-${id}`,
        key: 'UNI',
      });
      createdProjectIds.push(project1.id);

      const createPromise = createTestProject({
        name: '[e2e] Unique Key Test 2',
        githubOwner: `owner2-${id}`,
        githubRepo: `repo2-${id}`,
        key: 'UNI', // Same key should fail
      });

      await expect(createPromise).rejects.toThrow();
    });

    it('should enforce unique github owner/repo combination', async () => {
      const id = uniqueId();

      const project1 = await createTestProject({
        name: '[e2e] Unique Repo Test 1',
        githubOwner: `unique-owner-${id}`,
        githubRepo: `unique-repo-${id}`,
        key: 'UN1',
      });
      createdProjectIds.push(project1.id);

      const createPromise = createTestProject({
        name: '[e2e] Unique Repo Test 2',
        githubOwner: `unique-owner-${id}`, // Same owner
        githubRepo: `unique-repo-${id}`, // Same repo
        key: 'UN2',
      });

      await expect(createPromise).rejects.toThrow();
    });
  });
});
