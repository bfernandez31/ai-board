/**
 * Log Service Errors
 */
export class LogCaptureError extends Error {
  constructor(message: string, public readonly jobId?: number) {
    super(message);
    this.name = 'LogCaptureError';
  }
}

export class LogRetrievalError extends Error {
  constructor(message: string, public readonly jobId?: number) {
    super(message);
    this.name = 'LogRetrievalError';
  }
}

export class LogStorageError extends Error {
  constructor(message: string, public readonly storageKey?: string) {
    super(message);
    this.name = 'LogStorageError';
  }
}

export class LogNormalizationError extends Error {
  constructor(message: string, public readonly logContent?: string) {
    super(message);
    this.name = 'LogNormalizationError';
  }
}

export class LogPruningError extends Error {
  constructor(message: string, public readonly prunedCount?: number, public readonly errorCount?: number) {
    super(message);
    this.name = 'LogPruningError';
  }
}

/**
 * Handle log service errors and convert to appropriate HTTP responses
 */
export function handleLogServiceError(error: unknown): { status: number; message: string; details?: any } {
  if (error instanceof LogCaptureError) {
    return {
      status: 400,
      message: error.message,
      details: { jobId: error.jobId }
    };
  }

  if (error instanceof LogRetrievalError) {
    return {
      status: 404,
      message: error.message,
      details: { jobId: error.jobId }
    };
  }

  if (error instanceof LogStorageError) {
    return {
      status: 500,
      message: error.message,
      details: { storageKey: error.storageKey }
    };
  }

  if (error instanceof LogNormalizationError) {
    return {
      status: 400,
      message: error.message,
      details: { logContentPreview: error.logContent?.substring(0, 100) }
    };
  }

  if (error instanceof LogPruningError) {
    return {
      status: 500,
      message: error.message,
      details: { prunedCount: error.prunedCount, errorCount: error.errorCount }
    };
  }

  // Generic error handling
  if (error instanceof Error) {
    return {
      status: 500,
      message: error.message,
    };
  }

  return {
    status: 500,
    message: 'Unknown error occurred',
  };
}