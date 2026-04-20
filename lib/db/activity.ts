import { prisma } from "./client";
import { Agent, JobStatus } from "@prisma/client";
import { HeatmapDay, ActivityHeatmapResponse } from "../types/activity";
import { formatDateKey } from "../utils/activity-date-utils";

interface GetHeatmapDataParams {
  userId: string;
  start: Date;
  end: Date;
  agent?: Agent | null;
}

/**
 * Fetches and aggregates activity data for the heatmap
 */
export async function getHeatmapData({
  userId,
  start,
  end,
  agent,
}: GetHeatmapDataParams): Promise<ActivityHeatmapResponse> {
  // 1. Get user's projects to scope all queries
  const projects = await prisma.project.findMany({
    where: { userId },
    select: { id: true, defaultAgent: true, createdAt: true },
  });
  const projectIds = projects.map((p) => p.id);

  if (projectIds.length === 0) {
    return emptyResponse(start, end, agent || null, []);
  }

  // 2. Fetch jobs within the range for these projects
  // We include ticket to determine the "effective agent"
  const jobs = await prisma.job.findMany({
    where: {
      projectId: { in: projectIds },
      startedAt: {
        gte: start,
        lte: end,
      },
      // If agent filter is provided, we need to apply it
      ...(agent ? {
        OR: [
          { ticket: { agent } },
          { ticket: { agent: null }, projectId: { in: projects.filter(p => p.defaultAgent === agent).map(p => p.id) } }
        ]
      } : {}),
    },
    select: {
      startedAt: true,
      costUsd: true,
      command: true,
      status: true,
      ticketId: true,
      projectId: true,
      ticket: {
        select: {
          agent: true,
        },
      },
    },
  });

  // 3. Aggregate data by day
  const dailyData: Record<string, HeatmapDay> = {};
  let totalJobs = 0;
  let totalShippedTickets = 0;
  const shippedTicketIdsPerDay: Record<string, Set<number>> = {};

  jobs.forEach((job) => {
    const dateKey = formatDateKey(job.startedAt);
    
    if (!dailyData[dateKey]) {
      dailyData[dateKey] = {
        date: dateKey,
        jobCount: 0,
        shippedTicketCount: 0,
        totalCost: 0,
      };
      shippedTicketIdsPerDay[dateKey] = new Set();
    }

    const day = dailyData[dateKey]!;
    const shippedTickets = shippedTicketIdsPerDay[dateKey]!;

    day.jobCount++;
    totalJobs++;
    day.totalCost = (day.totalCost || 0) + (job.costUsd || 0);

    // Shipped ticket logic: distinct ticketId where Job.command === 'ship' and Job.status === 'COMPLETED'
    if (job.command === "ship" && job.status === JobStatus.COMPLETED) {
      if (!shippedTickets.has(job.ticketId)) {
        shippedTickets.add(job.ticketId);
        day.shippedTicketCount++;
        totalShippedTickets++;
      }
    }
  });

  // 4. Get available agents (from all user's jobs, not just in range)
  // This satisfies FR-008: "distinct agents present in the user's jobs"
  const distinctAgents = await prisma.ticket.findMany({
    where: { projectId: { in: projectIds } },
    select: { agent: true },
    distinct: ["agent"],
  });
  
  const availableAgents = new Set<string>();
  distinctAgents.forEach(t => {
    if (t.agent) availableAgents.add(t.agent);
  });
  // Also include project default agents if no tickets exist yet
  projects.forEach(p => availableAgents.add(p.defaultAgent));

  // 5. Get available years (from account creation to now)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });
  const startYear = user?.createdAt.getFullYear() || projects[0]?.createdAt.getFullYear() || new Date().getFullYear();
  const currentYear = new Date().getFullYear();
  const availableYears = [];
  for (let y = startYear; y <= currentYear; y++) {
    availableYears.push(y);
  }

  // 6. Format response
  const days = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

  return {
    days,
    stats: {
      totalJobs,
      totalShippedTickets,
      period: {
        start: formatDateKey(start),
        end: formatDateKey(end),
      },
    },
    filters: {
      availableAgents: Array.from(availableAgents).sort(),
      availableYears: availableYears.sort((a, b) => b - a),
      currentAgent: agent || null,
      currentYear: start.getFullYear() === end.getFullYear() ? start.getFullYear().toString() : "last-12-months",
    },
  };
}

function emptyResponse(start: Date, end: Date, currentAgent: Agent | null, availableAgents: string[]): ActivityHeatmapResponse {
  return {
    days: [],
    stats: {
      totalJobs: 0,
      totalShippedTickets: 0,
      period: {
        start: formatDateKey(start),
        end: formatDateKey(end),
      },
    },
    filters: {
      availableAgents,
      availableYears: [new Date().getFullYear()],
      currentAgent,
      currentYear: start.getFullYear() === end.getFullYear() ? start.getFullYear().toString() : "last-12-months",
    },
  };
}
