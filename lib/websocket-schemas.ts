import { z } from 'zod'

/**
 * Client → Server Message Schemas
 */
export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('subscribe'),
    projectId: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('unsubscribe'),
    projectId: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('ping'),
    timestamp: z.string().datetime(),
  }),
])

/**
 * Server → Client Message Schemas
 */
export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('connected'),
    clientId: z.string().uuid(),
    timestamp: z.string().datetime(),
  }),
  z.object({
    type: z.literal('subscribed'),
    projectId: z.number().int().positive(),
    timestamp: z.string().datetime(),
  }),
  z.object({
    type: z.literal('unsubscribed'),
    projectId: z.number().int().positive(),
    timestamp: z.string().datetime(),
  }),
  z.object({
    type: z.literal('job-status-update'),
    projectId: z.number().int().positive(),
    ticketId: z.number().int().positive(),
    jobId: z.number().int().positive(),
    status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
    command: z.string().max(50),
    timestamp: z.string().datetime(),
  }),
  z.object({
    type: z.literal('error'),
    code: z.string(),
    message: z.string(),
    timestamp: z.string().datetime(),
  }),
  z.object({
    type: z.literal('pong'),
    timestamp: z.string().datetime(),
  }),
])

/**
 * TypeScript Types Inferred from Zod Schemas
 */
export type ClientMessage = z.infer<typeof ClientMessageSchema>
export type ServerMessage = z.infer<typeof ServerMessageSchema>

/**
 * Helper type to extract specific message types
 */
export type JobStatusUpdate = Extract<ServerMessage, { type: 'job-status-update' }>
export type ConnectedMessage = Extract<ServerMessage, { type: 'connected' }>
export type SubscribedMessage = Extract<ServerMessage, { type: 'subscribed' }>
export type UnsubscribedMessage = Extract<ServerMessage, { type: 'unsubscribed' }>
export type ErrorMessage = Extract<ServerMessage, { type: 'error' }>
export type PongMessage = Extract<ServerMessage, { type: 'pong' }>

export type SubscribeMessage = Extract<ClientMessage, { type: 'subscribe' }>
export type UnsubscribeMessage = Extract<ClientMessage, { type: 'unsubscribe' }>
export type PingMessage = Extract<ClientMessage, { type: 'ping' }>
