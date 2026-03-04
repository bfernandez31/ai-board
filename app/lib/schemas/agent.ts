import { z } from 'zod';
import { Agent } from '@prisma/client';

export const projectAgentSchema = z.nativeEnum(Agent);

export const ticketAgentSchema = z.nativeEnum(Agent).nullable();
