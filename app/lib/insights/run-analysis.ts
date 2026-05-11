import { prisma } from '@/lib/db/client';
import { buildEffectiveAgentWhere } from '@/lib/analytics/queries';
import { streamJobLogArtifact, uploadInsightsReport } from '@/app/lib/blob/client';
import { buildInsightsReportKey } from './artifact-key';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { gunzipSync } from 'zlib';

const execFileAsync = promisify(execFile);

export async function executeInsightsAnalysis(runId: number): Promise<void> {
  let tempDir: string | null = null;

  try {
    await prisma.insightsRun.update({
      where: { id: runId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    const lastCompleted = await prisma.insightsRun.findFirst({
      where: { status: 'COMPLETED', id: { not: runId } },
      orderBy: { createdAt: 'desc' },
      select: { periodEnd: true },
    });

    const periodStart = lastCompleted?.periodEnd ?? new Date(0);
    const periodEnd = new Date();
    const agentWhere = buildEffectiveAgentWhere('CLAUDE');

    const tickets = await prisma.ticket.findMany({
      where: {
        stage: 'SHIP',
        updatedAt: { gt: periodStart },
        ...agentWhere,
      },
      select: {
        id: true,
        jobs: {
          where: { status: 'COMPLETED' },
          select: {
            id: true,
            log: { select: { rawArtifactKey: true } },
          },
        },
      },
    });

    const artifactKeys: string[] = [];
    for (const ticket of tickets) {
      for (const job of ticket.jobs) {
        if (job.log?.rawArtifactKey) {
          artifactKeys.push(job.log.rawArtifactKey);
        }
      }
    }

    if (artifactKeys.length === 0) {
      throw new Error('No Claude session artifacts found for shipped tickets');
    }

    tempDir = await mkdtemp(join(tmpdir(), 'insights-'));

    let downloadedCount = 0;
    for (const key of artifactKeys) {
      const result = await streamJobLogArtifact(key);
      if (!result) continue;

      const chunks: Uint8Array[] = [];
      const reader = result.stream.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }

      const compressed = Buffer.concat(chunks);
      let content: Buffer;
      try {
        content = gunzipSync(compressed);
      } catch {
        content = compressed;
      }

      await writeFile(join(tempDir, `session-${downloadedCount}.jsonl`), content);
      downloadedCount++;
    }

    if (downloadedCount === 0) {
      throw new Error('All session artifacts were unavailable or pruned');
    }

    const { stdout } = await execFileAsync('claude', ['-p', `Analyze the Claude Code session JSONL files in ${tempDir} and produce a comprehensive HTML insights report. Use the /insights analysis format covering: usage patterns, friction points, wins, and CLAUDE.md suggestions. Output ONLY the raw HTML.`], {
      timeout: 20 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const html = Buffer.from(stdout, 'utf-8');
    if (html.length === 0) {
      throw new Error('Claude Code /insights produced empty output');
    }

    const reportKey = buildInsightsReportKey(runId);
    await uploadInsightsReport(reportKey, html);

    await prisma.insightsRun.update({
      where: { id: runId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        periodStart,
        periodEnd,
        sessionCount: downloadedCount,
        ticketCount: tickets.length,
        reportKey,
        reportSize: html.length,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during analysis';
    try {
      await prisma.insightsRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: errorMessage.slice(0, 2000),
        },
      });
    } catch (updateError) {
      console.error('[Insights Analysis] Failed to mark run as failed:', updateError);
    }
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
