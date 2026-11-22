import { z } from 'zod';
import { slugify } from '../shared/domain/slug.js';
export { slugify } from '../shared/domain/slug.js';

const reserved = new Set(['api','auth','admin','www','app','login','settings','billing','support']);
export const createWorkspaceSchema = z.object({
  type: z.enum(['SOLO','ACADEMY']),
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(3).max(48).optional(),
  requestId: z.uuid(),
  timezone: z.string().trim().min(3).max(64).default('America/Bogota'),
  subjects: z.array(z.string().trim().min(2).max(75)).max(8).default([]),
});


