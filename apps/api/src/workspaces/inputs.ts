import { z } from 'zod';

const reserved = new Set(['api','auth','admin','www','app','login','settings','billing','support']);
export const createWorkspaceSchema = z.object({
  type: z.enum(['SOLO','ACADEMY']),
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(3).max(48).optional(),
  requestId: z.uuid(),
  timezone: z.string().trim().min(3).max(64).default('America/Bogota'),
  subjects: z.array(z.string().trim().min(2).max(75)).max(8).default([]),
});

export function slugify(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48).replace(/-$/,'');
}

export function parseWorkspaceInput(input: unknown) {
  const data = createWorkspaceSchema.parse(input);
  const slug = slugify(data.slug || data.name);
  if (slug.length < 3 || reserved.has(slug)) throw new Error('INVALID_SLUG');
  try { new Intl.DateTimeFormat('en-US', { timeZone: data.timezone }); }
  catch { throw new Error('INVALID_TIMEZONE'); }
  return { ...data, slug, subjects: [...new Set(data.subjects.map(s => s.trim()).filter(Boolean))] };
}
