'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { ArtifactHeader, NormalizedEvent } from '@/app/lib/logs/schema';

export interface ParsedRawArtifact {
  header: ArtifactHeader;
  events: NormalizedEvent[];
}

async function decodeStreamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const decompressed = (stream as unknown as ReadableStream).pipeThrough(
    new DecompressionStream('gzip')
  );
  const reader = (decompressed as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8').decode(merged);
}

function parseNdjson(text: string): { header: ArtifactHeader | null; events: NormalizedEvent[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  let header: ArtifactHeader | null = null;
  const events: NormalizedEvent[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (i === 0 && typeof parsed === 'object' && parsed && 'schemaVersion' in parsed) {
      header = parsed as ArtifactHeader;
      continue;
    }
    events.push(parsed as NormalizedEvent);
  }
  return { header, events };
}

export function useJobLogRaw(
  projectId: number,
  ticketId: number,
  jobId: number,
  isOpen: boolean
) {
  return useQuery({
    queryKey: queryKeys.projects.jobLogRaw(projectId, ticketId, jobId),
    queryFn: async (): Promise<ParsedRawArtifact> => {
      const res = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}/jobs/${jobId}/logs/raw`,
        { cache: 'no-store' }
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch raw log: HTTP ${res.status}`);
      }
      if (!res.body) {
        throw new Error('Raw log response had no body');
      }
      const text = await decodeStreamToText(res.body);
      const { header, events } = parseNdjson(text);
      if (!header) {
        throw new Error('Raw log artifact missing header line');
      }
      return { header, events };
    },
    enabled: isOpen,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
}
