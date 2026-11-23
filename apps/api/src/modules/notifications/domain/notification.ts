export type NotificationKind = 'SESSION_CANCELLED'|'SESSION_RESCHEDULED'|'COURSE_ENROLLED'|'BOOKING_CONFIRMED'|'CLASS_REMINDER'|'SOS_REQUEST'|'SOS_ANSWERED'|'PACKAGE_ISSUED'|'PACKAGE_REVOKED';
type ScheduleChangeKind = Extract<NotificationKind,'SESSION_CANCELLED'|'SESSION_RESCHEDULED'>;

export class InvalidNotificationIdentifier extends Error {
  constructor(){super('A valid notification identifier is required');this.name='InvalidNotificationIdentifier';}
}
export function notificationId(value:unknown):string {
  if(typeof value!=='string'||!value.trim()||value.length>128)throw new InvalidNotificationIdentifier();
  return value.trim();
}
/** In-app notices contain no student profiles or external contact details. */
export function sessionNotice(kind:ScheduleChangeKind,sessionTitle:string) {
  const subject=sessionTitle.trim().replace(/\s+/g,' ').slice(0,120);
  return kind==='SESSION_CANCELLED'
    ? {title:'Clase cancelada',body:'Se canceló "'+subject+'". Consulta a tu academia para coordinar una alternativa.'}
    : {title:'Cambio de horario',body:'Se reprogramó "'+subject+'". Revisa la nueva fecha y hora en tus reservas.'};
}

export function enrollmentNotice(courseTitle:string) {
 const title=courseTitle.trim().replace(/\s+/g,' ').slice(0,120);
 return {title:'Inscripción confirmada',body:'Ya estás inscrito en "'+title+'". Revisa tus clases y materiales en el Aula Digital.'};
}
export function bookingNotice(sessionTitle:string) {
 const title=sessionTitle.trim().replace(/\s+/g,' ').slice(0,120);
 return {title:'Reserva confirmada',body:'Tu cupo para "'+title+'" está confirmado. Consulta la agenda para ver los detalles.'};
}
