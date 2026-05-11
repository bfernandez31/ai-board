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

// Admin Insights (AIB-791). Same Vercel Blob wrapper, two siblings of the
// job-log helpers. Stores HTML reports under deterministic keys
// (`insights/reports/<reportId>.html`) so the iframe `src` can serve the
// artifact directly without an extra lookup column (D-1, D-2).

export async function uploadInsightsReportArtifact(
  key: string,
  html: Buffer | Uint8Array
): Promise<{ key: string; size: number }> {
  const token = requireToken();
  const buf = Buffer.isBuffer(html) ? html : Buffer.from(html);
  if (buf.byteLength <= 0) {
    throw new Error('Insights report artifact must be non-empty');
  }
  const result = await put(key, buf, {
    access: 'private',
    token,
    contentType: 'text/html; charset=utf-8',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return { key: result.pathname, size: buf.byteLength };
}

export async function streamInsightsReportArtifact(
  key: string
): Promise<{
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
} | null> {
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
  return {
    stream: result.stream,
    contentType: result.blob.contentType ?? 'text/html; charset=utf-8',
    size: result.blob.size,
  };
}
