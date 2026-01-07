import { z } from 'zod';

export const pushSubscriptionInputSchema = z.object({
  endpoint: z.string().url().max(500),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1).max(100),
    auth: z.string().min(1).max(50),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionInputSchema>;

export const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(500),
});

export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>;

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url: string;
  type: 'job_completion' | 'mention';
  ticketKey: string;
}

export interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}
