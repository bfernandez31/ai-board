import { prisma } from './client';
import type { PushSubscriptionInput } from '@/app/lib/push/subscription-schema';

export async function upsertPushSubscription(
  userId: string,
  subscription: PushSubscriptionInput,
  userAgent?: string
) {
  const expirationTime = subscription.expirationTime
    ? new Date(subscription.expirationTime)
    : null;

  // Build update/create data to handle exactOptionalPropertyTypes
  const updateData: {
    p256dh: string;
    auth: string;
    expirationTime: Date | null;
    updatedAt: Date;
    userAgent?: string | null;
  } = {
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    expirationTime,
    updatedAt: new Date(),
  };

  const createData: {
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    expirationTime: Date | null;
    userAgent?: string | null;
  } = {
    userId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    expirationTime,
  };

  if (userAgent !== undefined) {
    updateData.userAgent = userAgent;
    createData.userAgent = userAgent;
  }

  return prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: updateData,
    create: createData,
  });
}

export async function getUserPushSubscriptions(userId: string) {
  return prisma.pushSubscription.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function deletePushSubscription(userId: string, endpoint: string) {
  return prisma.pushSubscription.deleteMany({
    where: { userId, endpoint },
  });
}

export async function deletePushSubscriptionById(id: number) {
  return prisma.pushSubscription.delete({
    where: { id },
  });
}

export async function deletePushSubscriptionByEndpoint(endpoint: string) {
  return prisma.pushSubscription.deleteMany({
    where: { endpoint },
  });
}

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const count = await prisma.pushSubscription.count({
    where: { userId },
  });
  return count > 0;
}

export async function getSubscriptionByEndpoint(endpoint: string) {
  return prisma.pushSubscription.findUnique({
    where: { endpoint },
  });
}

export async function cleanupExpiredSubscriptions(): Promise<number> {
  const result = await prisma.pushSubscription.deleteMany({
    where: {
      expirationTime: {
        lt: new Date(),
      },
    },
  });
  return result.count;
}
