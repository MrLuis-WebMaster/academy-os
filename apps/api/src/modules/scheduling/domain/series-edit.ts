import {z} from 'zod';
import {advanceLocalWeek,InvalidWeeklySeries} from './weekly-series.js';

const date=z.iso.datetime({offset:true});
const schema=z.object({
  reason:z.string().trim().min(5).max(300),
  title:z.string().trim().min(3).max(120).optional(),
  capacity:z.number().int().min(1).max(500).optional(),
  mode:z.enum(['ONLINE','ONSITE','HYBRID']).optional(),
  meetingUrl:z.union([z.url().max(2048).refine(value=>value.startsWith('https://')),z.null()]).optional(),
  location:z.string().trim().max(300).nullable().optional(),
  startsAt:date.optional(),
  endsAt:date.optional(),
}).superRefine((input,ctx)=>{
  if(Boolean(input.startsAt)!==Boolean(input.endsAt)){
    ctx.addIssue({code:'custom',path:['endsAt'],message:'Both new start and end are required when moving weekly classes'});
  }
  if(!Object.keys(input).some(k=>k!=='reason')){
    ctx.addIssue({code:'custom',path:['reason'],message:'Provide at least one field to change'});
  }
  if(input.startsAt&&input.endsAt){
    const from=Date.parse(input.startsAt),to=Date.parse(input.endsAt);
    if(from>=to||to-from>12*60*60*1000){
      ctx.addIssue({code:'custom',path:['endsAt'],message:'Duration must be positive and under 12 hours'});
    }
  }
});
export type FutureSeriesEdit=z.infer<typeof schema>;
export class InvalidSeriesEdit extends Error {
  constructor(readonly details:unknown){super('Invalid weekly series edit');this.name='InvalidSeriesEdit';}
}
export function parseFutureSeriesEdit(raw:unknown):FutureSeriesEdit {
  const parsed=schema.safeParse(raw);
  if(!parsed.success)throw new InvalidSeriesEdit(parsed.error.flatten());
  return parsed.data;
}
export interface SeriesOccurrenceIndex {
  id:string;seriesIndex:number;startsAt:Date;endsAt:Date;
}
export function planEditedFutureSeries(
  occurrences:readonly SeriesOccurrenceIndex[],
  first:{startsAt:Date;endsAt:Date},
  timezone:string,
  now=new Date(),
):Map<string,{startsAt:Date;endsAt:Date}>{
  if(!occurrences.length||first.startsAt<=now||first.endsAt<=first.startsAt
    ||first.endsAt.getTime()-first.startsAt.getTime()>12*60*60*1000)
    throw new InvalidSeriesEdit('No valid future classes or invalid new start time');
  const sorted=[...occurrences].sort((a,b)=>a.seriesIndex-b.seriesIndex);
  const result=new Map<string,{startsAt:Date;endsAt:Date}>();
  try{
    for(const occurrence of sorted){
      const weeks=occurrence.seriesIndex-sorted[0]!.seriesIndex;
      const startsAt=advanceLocalWeek(first.startsAt,weeks,timezone);
      const endsAt=advanceLocalWeek(first.endsAt,weeks,timezone);
      if(startsAt<=now||endsAt<=startsAt||endsAt.getTime()-startsAt.getTime()>12*60*60*1000)
        throw new InvalidSeriesEdit('Edited session time is invalid or in the past');
      result.set(occurrence.id,{startsAt,endsAt});
    }
  }catch(error){
    if(error instanceof InvalidSeriesEdit)throw error;
    if(error instanceof InvalidWeeklySeries)throw new InvalidSeriesEdit(error.message);
    throw new InvalidSeriesEdit('The new time is invalid in the academy timezone');
  }
  return result;
}
