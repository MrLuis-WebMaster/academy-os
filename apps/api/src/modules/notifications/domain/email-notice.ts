export class EmailNoticeDenied extends Error{}
export class EmailNoticeInvalid extends Error{}
export const EMAIL_KINDS=['COURSE_ENROLLED','BOOKING_CONFIRMED','SESSION_CANCELLED','SESSION_RESCHEDULED','CLASS_REMINDER'] as const;
export const EMAIL_MAX_AGE_MS=20*60*60*1000;
export const EMAIL_MAX_ATTEMPTS=6;
export function parseEmailPreference(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||typeof (raw as Record<string,unknown>).enabled!=='boolean')throw new EmailNoticeInvalid('Explicit email preference required');
 return (raw as {enabled:boolean}).enabled;
}
export function emailRetryDelay(attempts:number){return Math.min(60,2**Math.max(0,Math.min(6,attempts)))*60000;}
export function emailMessage(origin:string){
 const url=new URL('/',origin);
 if(url.protocol!=='https:'||url.username||url.password)throw new EmailNoticeInvalid('HTTPS web origin required');
 return {subject:'Tienes una actualización en AcademyOS',text:'Hay una actualización de tu actividad académica. Ingresa a AcademyOS para consultar tus avisos y reservas.\n\n'+url.toString()+'\n\nPuedes desactivar estos correos desde las preferencias de tu Aula Digital.'};
}
