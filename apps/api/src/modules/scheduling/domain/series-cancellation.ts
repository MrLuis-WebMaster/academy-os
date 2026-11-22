export interface SeriesOccurrence {
 id:string;startsAt:Date;status:'DRAFT'|'CONFIRMED'|'COMPLETED'|'CANCELLED';
}
export class InvalidSeriesIdentifier extends Error {
 constructor(){super('A valid class series identifier is required');this.name='InvalidSeriesIdentifier';}
}
export function parseSeriesId(raw:unknown):string{
 if(typeof raw!=='string'||!raw.trim()||raw.length>128)throw new InvalidSeriesIdentifier();
 return raw.trim();
}
/** Preserve historical lessons and notes; only future confirmed sessions may be cancelled. */
export function futureConfirmedOccurrences(lessons:readonly SeriesOccurrence[],now=new Date()):string[]{
 return lessons.filter(x=>x.status==='CONFIRMED'&&x.startsAt>now).map(x=>x.id);
}
