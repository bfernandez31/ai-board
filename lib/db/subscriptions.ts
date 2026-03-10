import { prisma } from './client';
import type { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

export async function findSubscriptionByUserId(userId: string) {
  return prisma.subscription.findUnique({
    where: { userId },
  });
}

export async function findSubscriptionByStripeId(stripeSubscriptionId: string) {
  return prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
  });
}

export interface UpsertSubscriptionData {
  userId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date | null;
  trialEnd?: Date | null;
  cancelAt?: Date | null;
  canceledAt?: Date | null;
  gracePeriodEndsAt?: Date | null;
}

export async function upsertSubscription(data: UpsertSubscriptionData) {
  // Filter undefined values for exactOptionalPropertyTypes compatibility
  const updateData: Record<string, unknown> = {
    stripeSubscriptionId: data.stripeSubscriptionId,
    stripePriceId: data.stripePriceId,
    plan: data.plan,
    status: data.status,
    currentPeriodStart: data.currentPeriodStart,
    currentPeriodEnd: data.currentPeriodEnd,
  };
  if (data.trialStart !== undefined) updateData.trialStart = data.trialStart;
  if (data.trialEnd !== undefined) updateData.trialEnd = data.trialEnd;
  if (data.cancelAt !== undefined) updateData.cancelAt = data.cancelAt;
  if (data.canceledAt !== undefined) updateData.canceledAt = data.canceledAt;
  if (data.gracePeriodEndsAt !== undefined) updateData.gracePeriodEndsAt = data.gracePeriodEndsAt;

  const createData: Record<string, unknown> = { ...data };
  for (const key of Object.keys(createData)) {
    if (createData[key] === undefined) delete createData[key];
  }

  return prisma.subscription.upsert({
    where: { userId: data.userId },
    create: createData as unknown as typeof data,
    update: updateData,
  });
}

export async function createStripeEvent(eventId: string, type: string) {
  return prisma.stripeEvent.create({
    data: { id: eventId, type },
  });
}

