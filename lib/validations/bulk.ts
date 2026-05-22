import { z } from 'zod';
import { Agent } from '@prisma/client';
import { titleSchema, descriptionSchema } from './ticket';

const ticketIdsBase = z
  .array(z.number().int().positive())
  .min(1, 'At least one ticket must be selected')
  .max(50, 'Select at most 50 tickets per bulk action')
  .refine((ids) => new Set(ids).size === ids.length, 'Ticket ids must be unique');

const expectedVersionsSchema = z.record(
  z.string().regex(/^\d+$/, 'Expected version key must be a positive integer'),
  z.number().int().positive()
);

export const bulkDeleteSchema = z
  .object({
    ticketIds: ticketIdsBase,
    expectedVersions: expectedVersionsSchema,
  })
  .refine(
    (data) => data.ticketIds.every((id) => data.expectedVersions[String(id)] !== undefined),
    {
      message: 'expectedVersions must include every selected ticket id',
      path: ['expectedVersions'],
    }
  );

export const bulkMergeSchema = z
  .object({
    baseTicketId: z.number().int().positive(),
    sourceTicketIds: z
      .array(z.number().int().positive())
      .min(1, 'Merge requires at least 2 tickets')
      .max(49, 'Select at most 50 tickets per bulk action'),
    title: titleSchema,
    description: descriptionSchema,
    expectedVersions: expectedVersionsSchema,
  })
  .refine((d) => !d.sourceTicketIds.includes(d.baseTicketId), {
    message: 'baseTicketId cannot appear in sourceTicketIds',
    path: ['sourceTicketIds'],
  })
  .refine((d) => new Set(d.sourceTicketIds).size === d.sourceTicketIds.length, {
    message: 'sourceTicketIds must be unique',
    path: ['sourceTicketIds'],
  })
  .refine((d) => d.sourceTicketIds.every((id) => id > d.baseTicketId), {
    message: 'baseTicketId must be smaller than every source id',
    path: ['baseTicketId'],
  })
  .refine(
    (d) =>
      d.expectedVersions[String(d.baseTicketId)] !== undefined &&
      d.sourceTicketIds.every((id) => d.expectedVersions[String(id)] !== undefined),
    {
      message: 'expectedVersions must include base and every source id',
      path: ['expectedVersions'],
    }
  );

export const bulkAgentSchema = z.object({
  ticketIds: ticketIdsBase,
  agent: z.nativeEnum(Agent).nullable(),
});

export const bulkModelSchema = z.object({
  ticketIds: ticketIdsBase,
  model: z.union([z.string().min(1).max(50), z.null()]),
});

export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;
export type BulkMergeInput = z.infer<typeof bulkMergeSchema>;
export type BulkAgentInput = z.infer<typeof bulkAgentSchema>;
export type BulkModelInput = z.infer<typeof bulkModelSchema>;
