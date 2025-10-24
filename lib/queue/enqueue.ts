import { workflowQueue } from './client';
import type { WorkflowJobData, WorkflowCommand } from './types';
import { Job, Ticket, Project } from '@prisma/client';

interface EnqueueOptions {
  ticket: Ticket;
  project: Project;
  command: WorkflowCommand;
  job: Job;
}

/**
 * Enqueue a workflow job to be processed by the worker
 * Replaces the GitHub Actions dispatch
 */
export async function enqueueWorkflow({
  ticket,
  project,
  command,
  job,
}: EnqueueOptions): Promise<string> {
  const jobData: WorkflowJobData = {
    ticketId: ticket.id,
    projectId: project.id,
    command,
    ticketTitle: ticket.title,
    ticketDescription: ticket.description || '',
    branch: ticket.branch,
    githubOwner: project.githubOwner,
    githubRepo: project.githubRepo,
    jobId: job.id,
  };

  // Use job.id as the queue job ID for easy correlation
  const queueJob = await workflowQueue.add(command, jobData, {
    jobId: job.id.toString(),
    // Priority based on command type
    priority: getPriority(command),
  });

  console.log(`Enqueued job ${queueJob.id} for ticket ${ticket.id} with command ${command}`);

  return queueJob.id || '';
}

/**
 * Get job priority based on command type
 * Lower number = higher priority
 */
function getPriority(command: WorkflowCommand): number {
  const priorities: Record<WorkflowCommand, number> = {
    'quick-impl': 1, // Highest priority for quick implementations
    'comment-specify': 2,
    'comment-plan': 2,
    'comment-build': 2,
    'comment-verify': 2,
    'specify': 3,
    'plan': 3,
    'implement': 4, // Lowest priority for full implementations
  };

  return priorities[command] || 5;
}

/**
 * Check if there are any active jobs for a ticket
 * Used to prevent concurrent workflows
 */
export async function hasActiveJob(ticketId: number): Promise<boolean> {
  const jobs = await workflowQueue.getJobs(['active', 'waiting', 'delayed']);
  return jobs.some(job => job.data.ticketId === ticketId);
}