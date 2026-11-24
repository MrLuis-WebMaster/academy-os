export type CalendarClass={id:string;title:string;startsAt:Date;endsAt:Date;timezone:string;status:string;mode:string};
export type CalendarSyncResult={state:'saved'|'removed';meetUrl:string|null;conferencePending:boolean};
export class CalendarSyncConflict extends Error{}
export class CalendarProviderError extends Error{}
export function calendarEventBody(eventId:string,lesson:CalendarClass){
 if(!['CONFIRMED','CANCELLED'].includes(lesson.status))throw new CalendarSyncConflict('Only confirmed or cancelled classes can be exported');
 if(!Number.isFinite(lesson.startsAt.getTime())||!Number.isFinite(lesson.endsAt.getTime())||lesson.endsAt<=lesson.startsAt)
  throw new CalendarSyncConflict('Invalid class interval');
 return {
  summary:lesson.title,
  start:{dateTime:lesson.startsAt.toISOString(),timeZone:lesson.timezone},
  end:{dateTime:lesson.endsAt.toISOString(),timeZone:lesson.timezone},
  visibility:'private',
  extendedProperties:{private:{academyOS:eventId}},
 };
}
export function safeMeetUrl(value:unknown):string|null{
 if(typeof value!=='string')return null;
 try{
  const url=new URL(value);
  if(url.protocol==='https:'&&url.hostname==='meet.google.com'&&!url.port&&!url.username&&!url.password&&/^\/[a-zA-Z0-9-]+$/.test(url.pathname))
   return 'https://meet.google.com'+url.pathname;
 }catch{}
 return null;
}
