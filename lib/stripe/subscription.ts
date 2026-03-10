import { prisma } from '@/lib/db/client';
import type { SubscriptionPlan } from '@prisma/client';
import { PLANS } from './plans';

/**
 * Get the current user's subscription plan.
 * Returns FREE if no active subscription exists.
 */
export async function getUserPlan(userId: string): Promise<SubscriptionPlan> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true },
  });

  if (!subscription) return 'FREE';
  if (subscription.status === 'ACTIVE' || subscription.status === 'TRIALING') {
    return subscription.plan;
  }
  return 'FREE';
}

/**
 * Get the full subscription record for a user, or null if none exists.
 */
export async function getUserSubscription(userId: string) {
  return prisma.subscription.findUnique({
    where: { userId },
  });
}

/**
 * Check if user can create a new project based on their plan limits.
 */
export async function canCreateProject(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId);
  const limits = PLANS[plan].limits;

  if (limits.maxProjects === Infinity) return true;

  const projectCount = await prisma.project.count({
    where: { userId },
  });

  return projectCount < limits.maxProjects;
}

/**
 * Check if user can create a new ticket this month based on their plan limits.
 */
export async function canCreateTicket(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId);
  const limits = PLANS[plan].limits;

  if (limits.maxTicketsPerMonth === Infinity) return true;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const ticketCount = await prisma.ticket.count({
    where: {
      project: { userId },
      createdAt: { gte: startOfMonth },
    },
  });

  return ticketCount < limits.maxTicketsPerMonth;
}

/**
 * Check if user's plan allows adding members to projects.
 */
export async function canAddMembers(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId);
  return PLANS[plan].limits.membersAllowed;
}

/**
 * Get the Stripe customer ID for a user, creating one if needed.
 */
export async function getOrCreateStripeCustomerId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, email: true, name: true },
  });

  if (!user) throw new Error('User not found');

  if (user.stripeCustomerId) return user.stripeCustomerId;

  // Lazy import to avoid loading Stripe in contexts where it's not needed
  const { stripe } = await import('./client');

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    metadata: { userId },
    ...(user.name && { name: user.name }),
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}
