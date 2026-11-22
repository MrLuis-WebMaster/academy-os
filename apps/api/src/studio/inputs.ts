import {z} from 'zod';
export const studioSettingsInput=z.object({
  description:z.string().trim().max(800).nullable().optional(),
  contactUrl:z.union([
    z.url().max(2048).refine(v=>v.startsWith('https://'),'HTTPS is required'),
    z.literal(''),z.null()
  ]).optional(),
  publicEnabled:z.boolean().optional(),
}).refine(v=>Object.values(v).some(x=>x!==undefined),'At least one setting is required');

export const offeringInput=z.object({
  courseId:z.string().min(1).nullable().optional(),
  title:z.string().trim().min(3).max(120),
  description:z.string().trim().max(700).optional(),
  priceCOP:z.number().int().min(0).max(100000000),
  durationMinutes:z.number().int().min(15).max(480),
  mode:z.enum(['ONLINE','ONSITE','HYBRID']),
});
export const offeringVisibilityInput=z.object({published:z.boolean()});
