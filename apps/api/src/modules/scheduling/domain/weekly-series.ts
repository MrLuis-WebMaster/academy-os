export interface LessonWindow {startsAt:Date;endsAt:Date}
export class InvalidWeeklySeries extends Error {
 constructor(message='Weekly class series must have 2–16 future occurrences and a duration under 12 hours'){
  super(message);this.name='InvalidWeeklySeries';
 }
}
type LocalFields={year:number;month:number;day:number;hour:number;minute:number;second:number};
function localFields(date:Date,timeZone:string):LocalFields{
 const f=new Intl.DateTimeFormat('en-GB',{
  timeZone,year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',
 });
 const parts=Object.fromEntries(f.formatToParts(date).map(p=>[p.type,Number(p.value)]));
 return {year:parts.year!,month:parts.month!,day:parts.day!,
  hour:parts.hour!,minute:parts.minute!,second:parts.second!};
}
function zonedInstant(fields:LocalFields,timeZone:string):Date{
 const localMilliseconds=Date.UTC(fields.year,fields.month-1,fields.day,fields.hour,fields.minute,fields.second);
 let guess=localMilliseconds;
 for(let attempt=0;attempt<7;attempt++){
  const seen=localFields(new Date(guess),timeZone);
  const actual=Date.UTC(seen.year,seen.month-1,seen.day,seen.hour,seen.minute,seen.second);
  const delta=localMilliseconds-actual;
  if(delta===0)return new Date(guess);
  guess+=delta;
 }
 // E.g. a spring DST transition skips 02:30. Never create a class at another hour silently.
 throw new InvalidWeeklySeries('This local class time does not exist on a daylight-saving transition');
}
export function advanceLocalWeek(date:Date,index:number,timeZone:string):Date{
 const f=localFields(date,timeZone);
 const shifted=new Date(Date.UTC(f.year,f.month-1,f.day+7*index,f.hour,f.minute,f.second));
 return zonedInstant({
  year:shifted.getUTCFullYear(),month:shifted.getUTCMonth()+1,day:shifted.getUTCDate(),
  hour:shifted.getUTCHours(),minute:shifted.getUTCMinutes(),second:shifted.getUTCSeconds(),
 },timeZone);
}
/** Preserves *local wall-clock* hours during DST shifts; no UTC + 7 days drift. */
export function planWeeklySeries(
 first:LessonWindow,repeatWeeks:number,timeZone:string,now=new Date(),
):LessonWindow[]{
 if(!Number.isInteger(repeatWeeks)||repeatWeeks<2||repeatWeeks>16
  ||!Number.isFinite(first.startsAt.getTime())||!Number.isFinite(first.endsAt.getTime())
  ||first.startsAt<=now||first.endsAt<=first.startsAt
  ||first.endsAt.getTime()-first.startsAt.getTime()>12*60*60*1000)
  throw new InvalidWeeklySeries();
 try {
  const plan:LessonWindow[]=[];
  for(let index=0;index<repeatWeeks;index++){
   const startsAt=advanceLocalWeek(first.startsAt,index,timeZone);
   const endsAt=advanceLocalWeek(first.endsAt,index,timeZone);
   if(endsAt<=startsAt||endsAt.getTime()-startsAt.getTime()>12*60*60*1000)
    throw new InvalidWeeklySeries('Class duration is invalid after a timezone change');
   plan.push({startsAt,endsAt});
  }
  return plan;
 }catch(error){
  if(error instanceof InvalidWeeklySeries)throw error;
  throw new InvalidWeeklySeries('Invalid academy timezone for weekly classes');
 }
}
