import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/db/users';
import { getUserSubscription } from '@/lib/billing/subscription';
import { prisma } from '@/lib/db/client';

export interface UsageData {
  projects: { current: number; limit: number | null };
  ticketsThisMonth: { current: number; limit: number | null };
}

export async function GET() {
  try {
    const userId = await requireAuth();
    const subscription = await getUserSubscription(userId);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [projectCount, ticketCount] = await Promise.all([
      prisma.project.count({ where: { userId } }),
      prisma.ticket.count({
        where: {
          project: { userId },
          createdAt: { gte: startOfMonth },
        },
      }),
    ]);

    const usage: UsageData = {
      projects: {
        current: projectCount,
        limit: subscription.limits.maxProjects,
      },
      ticketsThisMonth: {
        current: ticketCount,
        limit: subscription.limits.maxTicketsPerMonth,
      },
    };

    return NextResponse.json(usage);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to fetch usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage' },
      { status: 500 }
    );
  }
}
