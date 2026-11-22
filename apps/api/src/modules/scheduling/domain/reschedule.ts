export class InvalidReschedule extends Error {
  constructor(message='Rescheduling requires a future start and valid class duration') {
    super(message); this.name='InvalidReschedule';
  }
}
export interface ReschedulePlan {startsAt:Date;endsAt:Date;reason:string}
export function planReschedule(input:unknown,now=new Date()):ReschedulePlan {
  if(!input||typeof input!=='object')throw new InvalidReschedule();
  const value=input as Record<string,unknown>;
  if(typeof value.startsAt!=='string'||typeof value.endsAt!=='string'
    ||typeof value.reason!=='string')throw new InvalidReschedule();
  const startsAt=new Date(value.startsAt),endsAt=new Date(value.endsAt);
  const reason=value.reason.trim();
  if(!Number.isFinite(startsAt.getTime())||!Number.isFinite(endsAt.getTime())
    ||!/(Z|[+-]\d\d:\d\d)$/.test(value.startsAt)
    ||!/(Z|[+-]\d\d:\d\d)$/.test(value.endsAt)) throw new InvalidReschedule('Dates must include a timezone offset');
  if(startsAt<=now || endsAt<=startsAt || endsAt.getTime()-startsAt.getTime()>12*60*60*1000){
    throw new InvalidReschedule();
  }
  if(reason.length<5||reason.length>300)throw new InvalidReschedule('Explain the schedule change in 5–300 characters');
  return {startsAt,endsAt,reason};
}
