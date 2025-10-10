import { describe, test, expect, beforeEach } from '@jest/globals'
import { PrismaClient } from '@prisma/client'
import { getMostRecentActiveJob, getJobsForTickets } from '@/lib/job-queries'

/**
 * Integration Tests for Job Query Functions
 *
 * Tests verify:
 * - getMostRecentActiveJob returns most recent RUNNING/PENDING job
 * - Falls back to most recent terminal job if no active jobs
 * - getJobsForTickets returns Map with single database query
 * - Prioritizes active jobs over terminal jobs
 *
 * Expected: FAIL (functions not implemented yet)
 */

const prisma = new PrismaClient()

describe('Job Query Functions', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.job.deleteMany({
      where: {
        ticket: {
          title: {
            startsWith: '[e2e]',
          },
        },
      },
    })

    await prisma.ticket.deleteMany({
      where: {
        title: {
          startsWith: '[e2e]',
        },
      },
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('getMostRecentActiveJob', () => {
    test('should return most recent RUNNING job if exists', async () => {
      // Create test ticket
      const ticket = await prisma.ticket.create({
        data: {
          title: '[e2e] Test Ticket for RUNNING Job',
          description: 'Testing job query',
          stage: 'SPECIFY',
          projectId: 1,
        },
      })

      // Create multiple jobs with different statuses
      await prisma.job.create({
        data: {
          ticketId: ticket.id,
          command: 'specify',
          status: 'COMPLETED',
          startedAt: new Date('2025-01-01T10:00:00Z'),
          completedAt: new Date('2025-01-01T10:05:00Z'),
        },
      })

      const runningJob = await prisma.job.create({
        data: {
          ticketId: ticket.id,
          command: 'plan',
          status: 'RUNNING',
          startedAt: new Date('2025-01-01T10:10:00Z'),
        },
      })

      // Query for most recent active job
      const result = await getMostRecentActiveJob(ticket.id)

      expect(result).not.toBeNull()
      expect(result?.id).toBe(runningJob.id)
      expect(result?.status).toBe('RUNNING')
      expect(result?.command).toBe('plan')
    })

    test('should return most recent PENDING job if no RUNNING', async () => {
      const ticket = await prisma.ticket.create({
        data: {
          title: '[e2e] Test Ticket for PENDING Job',
          description: 'Testing job query',
          stage: 'INBOX',
          projectId: 1,
        },
      })

      const pendingJob = await prisma.job.create({
        data: {
          ticketId: ticket.id,
          command: 'specify',
          status: 'PENDING',
          startedAt: new Date('2025-01-01T10:00:00Z'),
        },
      })

      await prisma.job.create({
        data: {
          ticketId: ticket.id,
          command: 'build',
          status: 'COMPLETED',
          startedAt: new Date('2025-01-01T09:00:00Z'),
          completedAt: new Date('2025-01-01T09:30:00Z'),
        },
      })

      const result = await getMostRecentActiveJob(ticket.id)

      expect(result).not.toBeNull()
      expect(result?.id).toBe(pendingJob.id)
      expect(result?.status).toBe('PENDING')
    })

    test('should fall back to most recent COMPLETED if no active jobs', async () => {
      const ticket = await prisma.ticket.create({
        data: {
          title: '[e2e] Test Ticket for Terminal Jobs',
          description: 'Testing job query fallback',
          stage: 'BUILD',
          projectId: 1,
        },
      })

      await prisma.job.create({
        data: {
          ticketId: ticket.id,
          command: 'specify',
          status: 'COMPLETED',
          startedAt: new Date('2025-01-01T09:00:00Z'),
          completedAt: new Date('2025-01-01T09:30:00Z'),
        },
      })

      const latestCompletedJob = await prisma.job.create({
        data: {
          ticketId: ticket.id,
          command: 'plan',
          status: 'COMPLETED',
          startedAt: new Date('2025-01-01T10:00:00Z'),
          completedAt: new Date('2025-01-01T10:30:00Z'),
        },
      })

      const result = await getMostRecentActiveJob(ticket.id)

      expect(result).not.toBeNull()
      expect(result?.id).toBe(latestCompletedJob.id)
      expect(result?.status).toBe('COMPLETED')
    })

    test('should return most recent FAILED if no active or completed', async () => {
      const ticket = await prisma.ticket.create({
        data: {
          title: '[e2e] Test Ticket for FAILED Job',
          description: 'Testing job query',
          stage: 'BUILD',
          projectId: 1,
        },
      })

      const failedJob = await prisma.job.create({
        data: {
          ticketId: ticket.id,
          command: 'build',
          status: 'FAILED',
          startedAt: new Date('2025-01-01T10:00:00Z'),
          completedAt: new Date('2025-01-01T10:05:00Z'),
        },
      })

      const result = await getMostRecentActiveJob(ticket.id)

      expect(result).not.toBeNull()
      expect(result?.id).toBe(failedJob.id)
      expect(result?.status).toBe('FAILED')
    })

    test('should return null if no jobs for ticket', async () => {
      const ticket = await prisma.ticket.create({
        data: {
          title: '[e2e] Test Ticket with No Jobs',
          description: 'Testing null case',
          stage: 'INBOX',
          projectId: 1,
        },
      })

      const result = await getMostRecentActiveJob(ticket.id)

      expect(result).toBeNull()
    })
  })

  describe('getJobsForTickets', () => {
    test('should return Map of ticketId to Job for all tickets', async () => {
      // Create multiple tickets with jobs
      const ticket1 = await prisma.ticket.create({
        data: {
          title: '[e2e] Ticket 1',
          description: 'Test',
          stage: 'INBOX',
          projectId: 1,
        },
      })

      const ticket2 = await prisma.ticket.create({
        data: {
          title: '[e2e] Ticket 2',
          description: 'Test',
          stage: 'SPECIFY',
          projectId: 1,
        },
      })

      const ticket3 = await prisma.ticket.create({
        data: {
          title: '[e2e] Ticket 3',
          description: 'Test',
          stage: 'PLAN',
          projectId: 1,
        },
      })

      // Create jobs
      const job1 = await prisma.job.create({
        data: {
          ticketId: ticket1.id,
          command: 'specify',
          status: 'RUNNING',
          startedAt: new Date(),
        },
      })

      const job2 = await prisma.job.create({
        data: {
          ticketId: ticket2.id,
          command: 'plan',
          status: 'PENDING',
          startedAt: new Date(),
        },
      })

      const job3 = await prisma.job.create({
        data: {
          ticketId: ticket3.id,
          command: 'build',
          status: 'COMPLETED',
          startedAt: new Date(),
          completedAt: new Date(),
        },
      })

      // Query for all jobs
      const result = await getJobsForTickets([ticket1.id, ticket2.id, ticket3.id])

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(3)
      expect(result.get(ticket1.id)?.id).toBe(job1.id)
      expect(result.get(ticket2.id)?.id).toBe(job2.id)
      expect(result.get(ticket3.id)?.id).toBe(job3.id)
    })

    test('should prioritize active jobs over terminal jobs', async () => {
      const ticket = await prisma.ticket.create({
        data: {
          title: '[e2e] Ticket with Multiple Jobs',
          description: 'Test priority',
          stage: 'BUILD',
          projectId: 1,
        },
      })

      // Create older completed job
      await prisma.job.create({
        data: {
          ticketId: ticket.id,
          command: 'specify',
          status: 'COMPLETED',
          startedAt: new Date('2025-01-01T09:00:00Z'),
          completedAt: new Date('2025-01-01T09:30:00Z'),
        },
      })

      // Create newer running job
      const runningJob = await prisma.job.create({
        data: {
          ticketId: ticket.id,
          command: 'plan',
          status: 'RUNNING',
          startedAt: new Date('2025-01-01T10:00:00Z'),
        },
      })

      const result = await getJobsForTickets([ticket.id])

      expect(result.get(ticket.id)?.id).toBe(runningJob.id)
      expect(result.get(ticket.id)?.status).toBe('RUNNING')
    })

    test('should handle tickets without jobs', async () => {
      const ticketWithJob = await prisma.ticket.create({
        data: {
          title: '[e2e] Ticket with Job',
          description: 'Has job',
          stage: 'SPECIFY',
          projectId: 1,
        },
      })

      const ticketWithoutJob = await prisma.ticket.create({
        data: {
          title: '[e2e] Ticket without Job',
          description: 'No jobs',
          stage: 'INBOX',
          projectId: 1,
        },
      })

      const job = await prisma.job.create({
        data: {
          ticketId: ticketWithJob.id,
          command: 'specify',
          status: 'RUNNING',
          startedAt: new Date(),
        },
      })

      const result = await getJobsForTickets([ticketWithJob.id, ticketWithoutJob.id])

      expect(result.size).toBe(1)
      expect(result.get(ticketWithJob.id)?.id).toBe(job.id)
      expect(result.has(ticketWithoutJob.id)).toBe(false)
    })

    test('should use single database query (no N+1)', async () => {
      // Create 10 tickets with jobs
      const ticketIds: number[] = []

      for (let i = 0; i < 10; i++) {
        const ticket = await prisma.ticket.create({
          data: {
            title: `[e2e] Batch Test Ticket ${i}`,
            description: 'Test batch query',
            stage: 'INBOX',
            projectId: 1,
          },
        })

        await prisma.job.create({
          data: {
            ticketId: ticket.id,
            command: 'specify',
            status: 'PENDING',
            startedAt: new Date(),
          },
        })

        ticketIds.push(ticket.id)
      }

      // Query all tickets at once
      const result = await getJobsForTickets(ticketIds)

      // Should return all 10 jobs
      expect(result.size).toBe(10)

      // Note: N+1 detection would require query monitoring
      // This test verifies the function works with batch input
      // Actual query count validation would need database query logging
    })
  })
})
