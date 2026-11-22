import {z} from 'zod';

export const externalResourceInput=z.object({
  courseId:z.string().min(1),
  title:z.string().trim().min(3).max(140),
  url:z.url().max(2048).refine(value=>value.startsWith('https://'),'Only HTTPS links are allowed'),
  published:z.boolean().default(false),
});
export const publicationInput=z.object({published:z.boolean()});

export type CreateExternalMaterial=z.infer<typeof externalResourceInput>;
export class InvalidMaterialInput extends Error {
  constructor(readonly details:unknown){
    super('Invalid material input');this.name='InvalidMaterialInput';
  }
}
export class MaterialNotPublishable extends Error {
  constructor(){
    super('Only a valid HTTPS external resource assigned to a course can be published');
    this.name='MaterialNotPublishable';
  }
}
export function parseExternalMaterial(raw:unknown):CreateExternalMaterial {
  const parsed=externalResourceInput.safeParse(raw);
  if(!parsed.success)throw new InvalidMaterialInput(parsed.error.flatten());
  return parsed.data;
}
export function parsePublication(raw:unknown):boolean {
  const parsed=publicationInput.safeParse(raw);
  if(!parsed.success)throw new InvalidMaterialInput(parsed.error.flatten());
  return parsed.data.published;
}
export function parseMaterialId(raw:unknown):string {
  if(typeof raw!=='string'||!raw.trim()||raw.length>128){
    throw new InvalidMaterialInput('A valid material identifier is required');
  }
  return raw.trim();
}
/** Never publish provider/Drive placeholders until their access rights are verified. */
export function ensurePublishableMaterial(resource:{
  source:string;url:string|null;courseId:string|null;courseWorkspaceId:string|null;
}):void {
  if(resource.source!=='EXTERNAL_URL'||!resource.courseId||
    !resource.courseWorkspaceId||
    !externalResourceInput.shape.url.safeParse(resource.url).success){
    throw new MaterialNotPublishable();
  }
}
