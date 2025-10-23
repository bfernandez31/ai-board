import type { Job } from '@prisma/client'
import { prisma } from './db/client'

/**
 * Job Query Functions
 *
 * Optimized database queries for fetching job status information.
 * Uses composite indexes for efficient lookups.
 *
 * See: specs/020-9179-real-time/data-model.md for query patterns
 */

/**
 * Get Most Recent Active Job for Ticket
 *
 * Query logic:
 * 1. First, try to find most recent PENDING or RUNNING job
 * 2. If none found, fall back to most recent terminal job (COMPLETED, FAILED, CANCELLED)
 * 3. Return null if no jobs exist for ticket
 *
 * Performance:
 * - Uses composite index [ticketId, status, startedAt]
 * - Two queries maximum (one for active, one fallback)
 * - Average query time: <10ms
 *
 * @param ticketId - Ticket ID to query jobs for
 * @returns Most recent active job or null
 */
export async function getMostRecentActiveJob(ticketId: number): Promise<Job | null> {
  // Step 1: Try to find most recent active job (PENDING or RUNNING)
  const activeJob = await prisma.job.findFirst({
    where: {
      ticketId,
      status: {
        in: ['PENDING', 'RUNNING'],
      },
    },
    orderBy: {
      startedAt: 'desc',
    },
  })

  if (activeJob) {
    return activeJob
  }

  // Step 2: Fall back to most recent terminal job
  const terminalJob = await prisma.job.findFirst({
    where: {
      ticketId,
      status: {
        in: ['COMPLETED', 'FAILED', 'CANCELLED'],
      },
    },
    orderBy: {
      startedAt: 'desc',
    },
  })

  return terminalJob
}

/**
 * Get Jobs for Multiple Tickets (Batch Query)
 *
 * Fetches most recent active job for each ticket in a single database query.
 * Client-side filtering prioritizes active jobs over terminal jobs.
 *
 * Performance:
 * - Single database query for all tickets (no N+1 problem)
 * - Uses [ticketId] index
 * - Client-side filtering is O(n) where n = total jobs
 * - Typical n ≈ 50-200 for board with 10-50 tickets
 *
 * @param ticketIds - Array of ticket IDs
 * @returns Map of ticketId → most recent active Job
 */
export async function getJobsForTickets(ticketIds: number[]): Promise<Map<number, Job>> {
  // Fetch all jobs for these tickets in single query
  const jobs = await prisma.job.findMany({
    where: {
      ticketId: {
        in: ticketIds,
      },
    },
    orderBy: {
      startedAt: 'desc',
    },
  })

  // Client-side filtering to get most recent active job per ticket
  const jobMap = new Map<number, Job>()

  // First pass: Find active jobs (PENDING or RUNNING)
  for (const job of jobs) {
    if (!jobMap.has(job.ticketId)) {
      // First job for this ticket (most recent due to ordering)
      if (job.status === 'PENDING' || job.status === 'RUNNING') {
        jobMap.set(job.ticketId, job)
      }
    }
  }

  // Second pass: Fill in terminal jobs for tickets without active jobs
  for (const job of jobs) {
    if (!jobMap.has(job.ticketId)) {
      // No active job found, use terminal job
      if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
        jobMap.set(job.ticketId, job)
      }
    }
  }

  return jobMap
}

/**
 * Get All Jobs for Ticket
 *
 * Returns all jobs for a ticket, ordered by most recent first.
 * Useful for displaying job history.
 *
 * @param ticketId - Ticket ID
 * @returns Array of jobs ordered by startedAt descending
 */
export async function getAllJobsForTicket(ticketId: number): Promise<Job[]> {
  return await prisma.job.findMany({
    where: {
      ticketId,
    },
    orderBy: {
      startedAt: 'desc',
    },
  })
}

/**
 * Get All Jobs for Multiple Tickets (Batch Query)
 *
 * Fetches ALL jobs for each ticket in a single database query.
 * Used for dual job display (workflow + AI-BOARD jobs).
 *
 * Performance:
 * - Single database query for all tickets (no N+1 problem)
 * - Uses [ticketId] index
 * - Returns full job array per ticket for client-side filtering
 *
 * @param ticketIds - Array of ticket IDs
 * @returns Map of ticketId → array of Jobs ordered by startedAt desc
 */
export async function getAllJobsForTickets(ticketIds: number[]): Promise<Map<number, Job[]>> {
  // Fetch all jobs for these tickets in single query
  const jobs = await prisma.job.findMany({
    where: {
      ticketId: {
        in: ticketIds,
      },
    },
    orderBy: {
      startedAt: 'desc',
    },
  })

  // Group jobs by ticketId
  const jobMap = new Map<number, Job[]>()

  for (const job of jobs) {
    const existingJobs = jobMap.get(job.ticketId) || []
    existingJobs.push(job)
    jobMap.set(job.ticketId, existingJobs)
  }

  return jobMap
}

/**
 * Get Active Jobs Count for Project
 *
 * Returns count of PENDING and RUNNING jobs for a project.
 * Useful for dashboard statistics.
 *
 * @param projectId - Project ID
 * @returns Count of active jobs
 */
export async function getActiveJobsCount(projectId: number): Promise<number> {
  return await prisma.job.count({
    where: {
      ticket: {
        projectId,
      },
      status: {
        in: ['PENDING', 'RUNNING'],
      },
    },
  })
}

/**
 * Cleanup Prisma Connection
 *
 * Call this when shutting down the application to properly
 * close database connections.
 */
export async function disconnectJobQueries() {
  await prisma.$disconnect()
}
