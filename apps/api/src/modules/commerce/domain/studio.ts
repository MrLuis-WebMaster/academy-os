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

export class InvalidStudioInput extends Error {
  constructor(readonly details:unknown){super('Invalid Studio input');this.name='InvalidStudioInput';}
}
export function parseStudioSettings(raw:unknown){
  const parsed=studioSettingsInput.safeParse(raw);
  if(!parsed.success)throw new InvalidStudioInput(parsed.error.flatten());
  return parsed.data;
}
export function parseStudioOffering(raw:unknown){
  const parsed=offeringInput.safeParse(raw);
  if(!parsed.success)throw new InvalidStudioInput(parsed.error.flatten());
  return parsed.data;
}
export function parseOfferingVisibility(raw:unknown){
  const parsed=offeringVisibilityInput.safeParse(raw);
  if(!parsed.success)throw new InvalidStudioInput(parsed.error.flatten());
  return parsed.data.published;
}
export function parseStudioIdentifier(raw:unknown):string{
  if(typeof raw!=='string'||!raw.trim()||raw.length>128)throw new InvalidStudioInput('Invalid identifier');
  return raw.trim();
}
