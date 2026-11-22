/** A dated teacher absence, separate from recurring weekly working hours. */
export interface TimeOffWindow {
 startsAt:Date;
 endsAt:Date;
 reason:string;
}
export class InvalidTimeOffWindow extends Error {
 constructor(message='Time off must be in the future and between 15 minutes and 30 days'){
  super(message);this.name='InvalidTimeOffWindow';
 }
}
export function parseTimeOffWindow(input:unknown,now=new Date()):TimeOffWindow {
 if(!input||typeof input!=='object')throw new InvalidTimeOffWindow();
 const body=input as Record<string,unknown>;
 if(typeof body.startsAt!=='string'||typeof body.endsAt!=='string'
   ||typeof body.reason!=='string'
   ||!/(?:Z|[+-]\d{2}:\d{2})$/.test(body.startsAt)
   ||!/(?:Z|[+-]\d{2}:\d{2})$/.test(body.endsAt))
  throw new InvalidTimeOffWindow('Use ISO dates with a timezone offset and a reason');
 const startsAt=new Date(body.startsAt),endsAt=new Date(body.endsAt),reason=body.reason.trim();
 if(!Number.isFinite(startsAt.getTime())||!Number.isFinite(endsAt.getTime())
  ||startsAt<=now||endsAt<=startsAt
  ||endsAt.getTime()-startsAt.getTime()<15*60*1000
  ||endsAt.getTime()-startsAt.getTime()>30*24*60*60*1000)throw new InvalidTimeOffWindow();
 if(reason.length<3||reason.length>240)throw new InvalidTimeOffWindow('Reason must be between 3 and 240 characters');
 return {startsAt,endsAt,reason};
}
/** Intervals are half-open: an absence ending at class start is not a conflict. */
export function intervalsOverlap(a:{startsAt:Date;endsAt:Date},b:{startsAt:Date;endsAt:Date}):boolean {
 return a.startsAt<b.endsAt && b.startsAt<a.endsAt;
}
