import { put, del, get, type PutBlobResult } from '@vercel/blob';

function requireToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  }
  return token;
}

export function isConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export async function uploadJobLogArtifact(
  key: string,
  body: Buffer | Uint8Array,
  size: number
): Promise<PutBlobResult> {
  const token = requireToken();
  if (size <= 0) {
    throw new Error('Artifact size must be positive');
  }
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  // Private access so deterministic keys (`logs/<projectId>/<ticketId>/<jobId>.jsonl.gz`)
  // aren't world-readable via guessed URLs — reads go through the authenticated
  // raw-log route, which proxies via `get()` below.
  return put(key, buf, {
    access: 'private',
    token,
    contentType: 'application/gzip',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function streamJobLogArtifact(
  key: string
): Promise<{ stream: ReadableStream<Uint8Array>; size: number } | null> {
  const token = requireToken();
  let result;
  try {
    result = await get(key, { access: 'private', token });
  } catch (error) {
    const status = (error as { status?: number } | null)?.status;
    if (status === 404) return null;
    throw error;
  }
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return { stream: result.stream, size: result.blob.size };
}

export async function uploadInsightsReportArtifact(
  key: string,
  html: string
): Promise<PutBlobResult> {
  const token = requireToken();
  if (!html) {
    throw new Error('Report HTML must not be empty');
  }
  return put(key, html, {
    access: 'private',
    token,
    contentType: 'text/html; charset=utf-8',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function fetchInsightsReportArtifact(
  key: string
): Promise<string | null> {
  const token = requireToken();
  let result;
  try {
    result = await get(key, { access: 'private', token });
  } catch (error) {
    const status = (error as { status?: number } | null)?.status;
    if (status === 404) return null;
    throw error;
  }
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const reader = result.stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

export async function deleteJobLogArtifact(key: string): Promise<{ deleted: boolean }> {
  const token = requireToken();
  try {
    await del(key, { token });
    return { deleted: true };
  } catch (error) {
    const status = (error as { status?: number } | null)?.status;
    if (status === 404) return { deleted: false };
    throw error;
  }
}
