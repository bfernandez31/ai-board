import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CriticalCron } from '@prisma/client';
import { prisma } from '@/lib/db/client';

const bodySchema = z.object({ cron: z.nativeEnum(CriticalCron) }).strict();

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const expectedToken = process.env.WORKFLOW_API_TOKEN;
  if (!expectedToken || !authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'UNKNOWN_CRON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Unknown cron', code: 'UNKNOWN_CRON' }, { status: 400 });
  }

  const { cron } = parsed.data;

  try {
    const row = await prisma.cronRun.upsert({
      where: { cron },
      create: { cron, lastSuccessAt: new Date() },
      update: { lastSuccessAt: new Date() },
    });
    return NextResponse.json({ cron: row.cron, lastSuccessAt: row.lastSuccessAt.toISOString() });
  } catch (err) {
    console.error('cron-heartbeat: DB write failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
