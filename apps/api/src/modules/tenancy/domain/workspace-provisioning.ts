import { z } from 'zod';
import { slugify } from '../../../shared/domain/slug.js';
export { slugify } from '../../../shared/domain/slug.js';

const reserved = new Set(['api','auth','admin','www','app','login','settings','billing','support']);
export const createWorkspaceSchema = z.object({
  type: z.enum(['SOLO','ACADEMY']),
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(3).max(48).optional(),
  requestId: z.uuid(),
  timezone: z.string().trim().min(3).max(64).default('America/Bogota'),
  subjects: z.array(z.string().trim().min(2).max(75)).max(8).default([]),
});

export class InvalidWorkspaceProvisioning extends Error {
  constructor(){super('Invalid workspace configuration');this.name='InvalidWorkspaceProvisioning';}
}
export function parseWorkspaceInput(input: unknown) {
  const result = createWorkspaceSchema.safeParse(input);
  if (!result.success) throw new InvalidWorkspaceProvisioning();
  const data = result.data;
  const slug = slugify(data.slug || data.name);
  if (slug.length < 3 || reserved.has(slug)) throw new InvalidWorkspaceProvisioning();
  try { new Intl.DateTimeFormat('en-US', { timeZone: data.timezone }); }
  catch { throw new InvalidWorkspaceProvisioning(); }
  // Different spellings may collapse to the same URL slug; provision one Subject per slug.
  const subjects = [...new Map(data.subjects
    .map(name=>[slugify(name),name.trim()] as const).filter(([key])=>Boolean(key))).values()];
  return { ...data, slug, subjects };
}
