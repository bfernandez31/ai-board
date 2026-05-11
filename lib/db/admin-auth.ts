import { requireAuth } from './users';
import { prisma } from './client';
import type { NextRequest } from 'next/server';

export interface AdminUser {
  userId: string;
  email: string;
}

export async function verifyAdminAccess(request?: NextRequest): Promise<AdminUser> {
  const userId = await requireAuth(request);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    throw new Error('Not found');
  }

  const adminEmails = process.env.ADMIN_EMAILS;
  if (!adminEmails || adminEmails.trim() === '') {
    throw new Error('Not found');
  }

  const allowlist = adminEmails
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowlist.length === 0) {
    throw new Error('Not found');
  }

  if (!allowlist.includes(user.email.toLowerCase())) {
    throw new Error('Not found');
  }

  return { userId, email: user.email };
}
