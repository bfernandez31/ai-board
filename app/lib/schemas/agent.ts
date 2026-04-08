import { z } from 'zod';
import { Agent } from '@prisma/client';

export const projectAgentSchema = z.nativeEnum(Agent);

export const ticketAgentSchema = z.nativeEnum(Agent).nullable();

export const setupAgentSchema = z.nativeEnum(Agent);

export const setupAgentListSchema = z.array(setupAgentSchema).min(1);
