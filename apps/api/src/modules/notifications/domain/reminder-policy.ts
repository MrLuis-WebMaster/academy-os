import {z} from 'zod';

/** In-app reminders are opt-in and are never email, WhatsApp or push subscriptions. */
export const reminderPreferencesInput=z.object({
  remind24h:z.boolean(),
  remind1h:z.boolean(),
});
export type ReminderPreferences=z.infer<typeof reminderPreferencesInput>;
export const REMINDER_WINDOWS=[
  {key:'24h',minutes:24*60,field:'remind24h'},
  {key:'1h',minutes:60,field:'remind1h'},
] as const;
export class InvalidReminderPreferences extends Error {
  constructor(readonly details:unknown){super('Invalid class reminder preferences');this.name='InvalidReminderPreferences';}
}
export function parseReminderPreferences(raw:unknown):ReminderPreferences{
  const result=reminderPreferencesInput.safeParse(raw);
  if(!result.success)throw new InvalidReminderPreferences(result.error.flatten());
  return result.data;
}
export function reminderDueWindow(now:Date,minutesBefore:number,graceMinutes=20){
  if(!Number.isFinite(now.getTime())||!Number.isInteger(minutesBefore)||minutesBefore<=0
    ||!Number.isInteger(graceMinutes)||graceMinutes<=0||graceMinutes>=minutesBefore){
    throw new Error('Invalid reminder schedule');
  }
  return {
    from:new Date(now.getTime()+(minutesBefore-graceMinutes)*60000),
    through:new Date(now.getTime()+minutesBefore*60000),
  };
}
export function reminderEventKey(sessionId:string,startsAt:Date,windowKey:'24h'|'1h'){
  return 'class-reminder:'+sessionId+':'+startsAt.toISOString()+':'+windowKey;
}
export function reminderNotice(sessionTitle:string,startsAt:Date,timezone:string,windowKey:'24h'|'1h'){
  const when=new Intl.DateTimeFormat('es-CO',{
    timeZone:timezone,dateStyle:'medium',timeStyle:'short',
  }).format(startsAt);
  const name=sessionTitle.trim().replace(/\s+/g,' ').slice(0,110);
  return {
    title:windowKey==='24h'?'Tu clase es mañana':'Tu clase comienza en una hora',
    body:'"'+name+'" está programada para '+when+'. Consulta tu reserva y confirma los detalles de acceso.',
  };
}
