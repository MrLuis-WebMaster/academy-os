export type NotificationKind = 'SESSION_CANCELLED'|'SESSION_RESCHEDULED';

export class InvalidNotificationIdentifier extends Error {
  constructor(){super('A valid notification identifier is required');this.name='InvalidNotificationIdentifier';}
}
export function notificationId(value:unknown):string {
  if(typeof value!=='string'||!value.trim()||value.length>128)throw new InvalidNotificationIdentifier();
  return value.trim();
}
/** In-app notices contain no student profiles or external contact details. */
export function sessionNotice(kind:NotificationKind,sessionTitle:string) {
  const subject=sessionTitle.trim().replace(/\s+/g,' ').slice(0,120);
  return kind==='SESSION_CANCELLED'
    ? {title:'Clase cancelada',body:'Se canceló "'+subject+'". Consulta a tu academia para coordinar una alternativa.'}
    : {title:'Cambio de horario',body:'Se reprogramó "'+subject+'". Revisa la nueva fecha y hora en tus reservas.'};
}
