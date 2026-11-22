export interface CalendarLesson {
 id:string;title:string;startsAt:Date;endsAt:Date;
 status:'CONFIRMED'|'CANCELLED';location:string|null;meetingUrl:string|null;
 changes:number;
}
/** RFC 5545 text escaping: prevents CRLF/ICS field injection. */
export function escapeCalendarText(value:string):string {
 return value.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n')
  .replace(/;/g,'\\;').replace(/,/g,'\\,');
}
export function calendarTimestamp(value:Date):string {
 if(!Number.isFinite(value.getTime()))throw Error('Invalid date');
 return value.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
}
/** Keep individual content lines at <= 75 octets, including UTF-8. */
export function foldCalendarLine(line:string):string {
 const encoder=new TextEncoder();
 let result='',part='',octets=0;
 for(const char of line){
  const size=encoder.encode(char).length;
  if(octets+size>75){result+=part+'\r\n ';part='';octets=1;}
  part+=char;octets+=size;
 }
 return result+part;
}
export function serializeAcademyCalendar(lessons:readonly CalendarLesson[],now=new Date()):string {
 const lines=[
  'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//AcademyOS//Private Course Calendar//ES',
  'CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:AcademyOS',
 ];
 for(const lesson of lessons){
  if(!Number.isFinite(lesson.startsAt.getTime())||!Number.isFinite(lesson.endsAt.getTime())
   ||lesson.endsAt<=lesson.startsAt)continue;
  // Stable UID lets calendar applications update the same event on re-import.
  const id=lesson.id.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,128);
  if(!id)continue;
  lines.push('BEGIN:VEVENT');
  lines.push('UID:academy-os-'+id+'@calendar.academyos.app');
  lines.push('DTSTAMP:'+calendarTimestamp(now));
  lines.push('DTSTART:'+calendarTimestamp(lesson.startsAt));
  lines.push('DTEND:'+calendarTimestamp(lesson.endsAt));
  lines.push('SUMMARY:'+escapeCalendarText(lesson.title));
  lines.push('STATUS:'+lesson.status);
  lines.push('SEQUENCE:'+Math.max(0,Math.min(100000,Math.trunc(lesson.changes))));
  if(lesson.location)lines.push('LOCATION:'+escapeCalendarText(lesson.location));
  if(lesson.meetingUrl&&lesson.meetingUrl.startsWith('https://')){
   lines.push('DESCRIPTION:'+escapeCalendarText('Enlace de clase: '+lesson.meetingUrl));
  }
  lines.push('END:VEVENT');
 }
 lines.push('END:VCALENDAR');
 return lines.map(foldCalendarLine).join('\r\n')+'\r\n';
}
