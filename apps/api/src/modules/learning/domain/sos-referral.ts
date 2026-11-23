import {z} from 'zod';
import {minimizeTeachingNotes} from './suggestion.js';

const id=z.string().trim().min(1).max(128);
export const sosReferralInput=z.object({
 courseId:id,
 question:z.string().trim().min(8).max(650),
}).strict();
export const sosResolutionInput=z.object({
 reply:z.string().trim().min(10).max(1500),
}).strict();
export type SosReferralInput=z.infer<typeof sosReferralInput>;
export type SosResolution=z.infer<typeof sosResolutionInput>;
export class InvalidSosReferral extends Error {
 constructor(readonly details:unknown){super('Invalid question or teacher response');this.name='InvalidSosReferral';}
}
function parse<T>(schema:z.ZodType<T>,value:unknown):T{
 const result=schema.safeParse(value);
 if(!result.success)throw new InvalidSosReferral(result.error.flatten());
 return result.data;
}
export const parseSosReferral=(raw:unknown):SosReferralInput=>{
 const input=parse(sosReferralInput,raw);
 return {...input,question:minimizeTeachingNotes(input.question).slice(0,650)};
};
export const parseSosResolution=(raw:unknown):SosResolution=>{
 const input=parse(sosResolutionInput,raw);
 return {...input,reply:minimizeTeachingNotes(input.reply).slice(0,1500)};
};
export const parseSosReferralId=(raw:unknown)=>parse(id,raw);
