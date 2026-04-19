import { prisma } from './client';
import { resolveEffectiveAgent } from '@/app/lib/utils/agent-resolution';
import { requireAuth } from './users';
import { calculateDateRange } from '@/lib/utils/heatmap-dates';
import type { NextRequest } from 'next/server';

export interface HeatmapDataPoint {
  date: string; // YYYY-MM-DD
  jobCount: number;
  totalCost: number | null;
  shippedTickets: {
    id: number;
    ticketKey: string;
    title: string;
  }[];
}

export interface ActivityHeatmapResponse {
  data: HeatmapDataPoint[];
  availableAgents: {
    value: string;
    label: string;
    jobCount: number;
  }[];
  stats: {
    totalJobs: number;
    totalTicketsShipped: number;
  };
  userCreatedAt: string;
}

export async function getActivityHeatmap(options: {
  request?: NextRequest;
  range?: string;
  agentFilter?: string;
}): Promise<ActivityHeatmapResponse> {
  const { request, range = 'last-12-months', agentFilter = 'all' } = options;
  const userId = await requireAuth(request);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Get all projects the user has access to
  const accessibleProjects = await prisma.project.findMany({
    where: {
      OR: [
        { userId },
        { members: { some: { userId } } },
      ],
    },
    select: {
      id: true,
      defaultAgent: true,
    },
  });

  const projectIds = accessibleProjects.map(p => p.id);
  const projectDefaultAgents = new Map(accessibleProjects.map(p => [p.id, p.defaultAgent]));

  // Determine date range
  const { startDate, endDate } = calculateDateRange(range);

  // Fetch all jobs in the range for these projects
  const jobs = await prisma.job.findMany({
    where: {
      projectId: { in: projectIds },
      startedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      ticket: {
        select: {
          id: true,
          ticketKey: true,
          title: true,
          agent: true,
        },
      },
    },
    orderBy: { startedAt: 'asc' },
  });

  // Group by date and calculate metrics
  const dayMap = new Map<string, HeatmapDataPoint>();
  const agentCounts = new Map<string, number>();

  // Initialize available agents with 'all'
  // But requirement says "derived from distinct agents actually present"
  
  jobs.forEach(job => {
    const effectiveAgent = resolveEffectiveAgent(
      job.ticket.agent,
      projectDefaultAgents.get(job.projectId) || 'CLAUDE'
    );

    // Update agent counts for the filter
    agentCounts.set(effectiveAgent, (agentCounts.get(effectiveAgent) || 0) + 1);

    // Apply agent filter
    if (agentFilter !== 'all' && effectiveAgent !== agentFilter) {
      return;
    }

    const dateKey = job.startedAt.toISOString().split('T')[0] || '';
    if (!dateKey) return;

    let dataPoint = dayMap.get(dateKey);
    if (!dataPoint) {
      dataPoint = {
        date: dateKey,
        jobCount: 0,
        totalCost: null,
        shippedTickets: [],
      };
      dayMap.set(dateKey, dataPoint);
    }

    dataPoint.jobCount += 1;
    if (job.costUsd !== null) {
      dataPoint.totalCost = (dataPoint.totalCost || 0) + job.costUsd;
    }

    // Check if this job was a successful ship job
    if (job.command === 'ship' && job.status === 'COMPLETED') {
      const isAlreadyAdded = dataPoint.shippedTickets.some(t => t.id === job.ticket.id);
      if (!isAlreadyAdded) {
        dataPoint.shippedTickets.push({
          id: job.ticket.id,
          ticketKey: job.ticket.ticketKey,
          title: job.ticket.title,
        });
      }
    }
  });

  const heatmapData = Array.from(dayMap.values());
  const totalJobs = heatmapData.reduce((acc, curr) => acc + curr.jobCount, 0);
  const totalTicketsShipped = heatmapData.reduce((acc, curr) => acc + curr.shippedTickets.length, 0);

  const availableAgents = Array.from(agentCounts.entries())
    .map(([value, jobCount]) => ({
      value,
      label: value.charAt(0) + value.slice(1).toLowerCase(), // e.g. 'Claude'
      jobCount,
    }))
    .sort((a, b) => b.jobCount - a.jobCount);

  return {
    data: heatmapData,
    availableAgents,
    stats: {
      totalJobs,
      totalTicketsShipped,
    },
    userCreatedAt: user.createdAt.toISOString(),
  };
}
