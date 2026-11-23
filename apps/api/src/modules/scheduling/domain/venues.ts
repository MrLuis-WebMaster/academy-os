import {z} from 'zod';

export const campusInput=z.object({
 name:z.string().trim().min(3).max(100),
 address:z.string().trim().min(5).max(300),
});
export const campusPatch=z.object({
 name:z.string().trim().min(3).max(100).optional(),
 address:z.string().trim().min(5).max(300).optional(),
 active:z.boolean().optional(),
}).refine(data=>Object.values(data).some(x=>x!==undefined));
export const roomInput=z.object({
 name:z.string().trim().min(2).max(100),
 capacity:z.number().int().min(1).max(500),
});
export const roomPatch=z.object({
 name:z.string().trim().min(2).max(100).optional(),
 capacity:z.number().int().min(1).max(500).optional(),
 active:z.boolean().optional(),
}).refine(data=>Object.values(data).some(x=>x!==undefined));
export class InvalidVenueInput extends Error {
 constructor(readonly details:unknown){super('Invalid campus or room input');this.name='InvalidVenueInput';}
}
function parseWith<T>(schema:z.ZodType<T>,raw:unknown):T{
 const result=schema.safeParse(raw);
 if(!result.success)throw new InvalidVenueInput(result.error.flatten());
 return result.data;
}
export const parseCampus=(raw:unknown)=>parseWith(campusInput,raw);
export const parseCampusPatch=(raw:unknown)=>parseWith(campusPatch,raw);
export const parseRoom=(raw:unknown)=>parseWith(roomInput,raw);
export const parseRoomPatch=(raw:unknown)=>parseWith(roomPatch,raw);
export function parseVenueId(raw:unknown):string{
 if(typeof raw!=='string'||!raw.trim()||raw.length>128)
  throw new InvalidVenueInput('Valid campus or room identifier required');
 return raw.trim();
}
