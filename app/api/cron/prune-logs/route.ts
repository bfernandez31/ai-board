import { NextRequest, NextResponse } from 'next/server';
import { pruneExpiredLogs } from '@/lib/logs/prune-expired-logs';

const RETENTION_DAYS = 30;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || !authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();
    const result = await pruneExpiredLogs(RETENTION_DAYS);
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      pruned: result.pruned,
      errors: result.errors,
      durationMs,
    });
  } catch (error: unknown) {
    console.error('[CRON Prune Logs] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
