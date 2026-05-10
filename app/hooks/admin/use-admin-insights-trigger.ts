'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

export type TriggerErrorCode =
  | 'ALREADY_RUNNING'
  | 'NO_NEW_SHIPPED_TICKETS'
  | 'DISPATCH_FAILED'
  | 'UNKNOWN';

export interface TriggerSuccessPayload {
  id: number;
  status: 'RUNNING';
  periodStart: string;
  periodEnd: string;
  startedAt: string;
}

export interface TriggerErrorPayload {
  code: TriggerErrorCode;
  error: string;
  status: number;
}

async function triggerRun(): Promise<TriggerSuccessPayload> {
  const res = await fetch('/api/admin/insights/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: '{}',
  });
  if (res.status === 201) {
    return (await res.json()) as TriggerSuccessPayload;
  }
  let body: { code?: TriggerErrorCode; error?: string } = {};
  try {
    body = await res.json();
  } catch {
    // ignore
  }
  const err: TriggerErrorPayload = {
    code: body.code ?? 'UNKNOWN',
    error: body.error ?? `Trigger failed (${res.status})`,
    status: res.status,
  };
  throw err;
}

export function useAdminInsightsTriggerMutation() {
  const qc = useQueryClient();
  return useMutation<TriggerSuccessPayload, TriggerErrorPayload>({
    mutationFn: triggerRun,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.insights.list });
    },
  });
}
