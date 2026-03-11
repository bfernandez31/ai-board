import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/db/users';
import { getUserSubscription } from '@/lib/billing/subscription';
import { prisma } from '@/lib/db/client';
import { PLANS } from '@/lib/billing/plans';

export async function GET() {
  try {
    const userId = await requireAuth();
    const subscription = await getUserSubscription(userId);

    const projectCount = await prisma.project.count({
      where: { userId },
    });

    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const ticketCount = await prisma.ticket.count({
      where: {
        project: { userId },
        createdAt: { gte: startOfMonth },
      },
    });

    const nextMonth = new Date(startOfMonth);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

    const planConfig = PLANS[subscription.plan];

    return NextResponse.json({
      plan: subscription.plan,
      planName: planConfig.name,
      projects: {
        current: projectCount,
        max: subscription.limits.maxProjects,
      },
      ticketsThisMonth: {
        current: ticketCount,
        max: subscription.limits.maxTicketsPerMonth,
        resetDate: nextMonth.toISOString(),
      },
      status: subscription.status,
      gracePeriodEndsAt: subscription.gracePeriodEndsAt,
    });
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
