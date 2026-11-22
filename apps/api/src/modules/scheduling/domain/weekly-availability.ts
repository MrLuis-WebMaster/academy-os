export interface WeeklySlotValue {
  dayOfWeek:number;startMinute:number;endMinute:number;
}
export class InvalidWeeklySlot extends Error {
  constructor(message='Choose a valid weekday and start/end time'){super(message);this.name='InvalidWeeklySlot';}
}
function toMinute(time:unknown):number {
  if(typeof time!=='string'||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))throw new InvalidWeeklySlot();
  const [hour,minute]=time.split(':').map(Number);
  return hour!*60+minute!;
}
export function parseWeeklySlot(raw:unknown):WeeklySlotValue {
  if(!raw||typeof raw!=='object')throw new InvalidWeeklySlot();
  const value=raw as Record<string,unknown>;
  const dayOfWeek=value.dayOfWeek;
  const startMinute=toMinute(value.startTime),endMinute=toMinute(value.endTime);
  if(typeof dayOfWeek!=='number'||!Number.isInteger(dayOfWeek)||dayOfWeek<0||dayOfWeek>6
    ||endMinute-startMinute<15)throw new InvalidWeeklySlot('Minimum duration is 15 minutes on one weekday');
  return {dayOfWeek,startMinute,endMinute};
}
function localStamp(date:Date,timeZone:string) {
  const formatter=new Intl.DateTimeFormat('en-GB',{
    timeZone,year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23',
  });
  const parts=Object.fromEntries(formatter.formatToParts(date).map(p=>[p.type,p.value]));
  const year=Number(parts.year),month=Number(parts.month),day=Number(parts.day);
  return {
    date:year+'-'+month+'-'+day,
    weekday:new Date(Date.UTC(year,month-1,day)).getUTCDay(),
    minute:Number(parts.hour)*60+Number(parts.minute),
  };
}
/** Slots are expressed in the academy timezone; sessions may be in any UTC offset. */
export function withinWeeklyAvailability(slots:readonly WeeklySlotValue[],
  startsAt:Date,endsAt:Date,timeZone:string):boolean {
  if(!slots.length)return true; // A teacher has not configured regular hours yet.
  if(!Number.isFinite(startsAt.getTime())||!Number.isFinite(endsAt.getTime())||endsAt<=startsAt)return false;
  const start=localStamp(startsAt,timeZone),end=localStamp(endsAt,timeZone);
  if(start.date!==end.date||start.weekday!==end.weekday)return false;
  return slots.some(slot=>slot.dayOfWeek===start.weekday
    &&start.minute>=slot.startMinute&&end.minute<=slot.endMinute);
}

/** Throws no exceptions: class interval overlaps any dated absence. */
export function overlapsTimeOff(
  timeOff:readonly {startsAt:Date;endsAt:Date}[],startsAt:Date,endsAt:Date,
):boolean {
  return timeOff.some(x=>x.startsAt<endsAt&&startsAt<x.endsAt);
}
