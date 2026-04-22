import { put, del, head, type PutBlobResult } from '@vercel/blob';

function getToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

export function isConfigured(): boolean {
  return !!getToken();
}

export async function uploadJobLogArtifact(
  key: string,
  body: Buffer | Uint8Array,
  size: number
): Promise<PutBlobResult> {
  const token = getToken();
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  }
  if (size <= 0) {
    throw new Error('Artifact size must be positive');
  }
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  return put(key, buf, {
    access: 'public',
    token,
    contentType: 'application/gzip',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function streamJobLogArtifact(
  key: string
): Promise<{ stream: ReadableStream<Uint8Array>; size: number } | null> {
  const token = getToken();
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  }
  let info;
  try {
    info = await head(key, { token });
  } catch (error) {
    const status = (error as { status?: number } | null)?.status;
    if (status === 404) return null;
    throw error;
  }
  const response = await fetch(info.url);
  if (response.status === 404) return null;
  if (!response.ok || !response.body) {
    throw new Error(`Blob fetch failed: HTTP ${response.status}`);
  }
  return { stream: response.body, size: info.size };
}

export async function deleteJobLogArtifact(key: string): Promise<{ deleted: boolean }> {
  const token = getToken();
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  }
  try {
    await del(key, { token });
    return { deleted: true };
  } catch (error) {
    const status = (error as { status?: number } | null)?.status;
    if (status === 404) return { deleted: false };
    throw error;
  }
}
