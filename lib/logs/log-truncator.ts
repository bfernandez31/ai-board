export interface TruncateResult {
  content: string;
  truncated: boolean;
}

export function truncateOutput(rawOutput: string, maxBytes: number): TruncateResult {
  const size = Buffer.byteLength(rawOutput, 'utf8');

  if (size <= maxBytes) {
    return { content: rawOutput, truncated: false };
  }

  const quarter = Math.floor(maxBytes / 4);
  const head = rawOutput.slice(0, quarter);
  const tail = rawOutput.slice(-quarter);
  const marker = `\n\n--- [TRUNCATED: original size ${size} bytes] ---\n\n`;

  return {
    content: head + marker + tail,
    truncated: true,
  };
}
