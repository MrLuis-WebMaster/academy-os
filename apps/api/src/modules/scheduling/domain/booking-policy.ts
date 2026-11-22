export class BookingPolicyViolation extends Error {
  constructor(message:string){super(message);this.name='BookingPolicyViolation';}
}
export interface ReservationSnapshot {
  status:'DRAFT'|'CONFIRMED'|'COMPLETED'|'CANCELLED';
  capacity:number;occupied:number;startsAt:Date;courseId:string|null;
}
export function hasRoom(capacity:number,occupied:number){return capacity>0&&occupied<capacity;}
export function ensureReservable(session:ReservationSnapshot,now=new Date()){
  if(session.status!=='CONFIRMED')throw new BookingPolicyViolation('Class is not open for reservations');
  if(session.startsAt<=now)throw new BookingPolicyViolation('Cannot book a class that has already started');
  if(!session.courseId)throw new BookingPolicyViolation('Class must belong to an enrolled course');
  if(!hasRoom(session.capacity,session.occupied))throw new BookingPolicyViolation('No seats are available in this class');
}
export function ensureCancellable(startsAt:Date,now=new Date()){
  if(startsAt<=now)throw new BookingPolicyViolation('Cannot cancel after a class has started');
}
export function bookingId(raw:unknown){
  if(typeof raw!=='string'||!raw.trim()||raw.length>128)throw new BookingPolicyViolation('A valid identifier is required');
  return raw.trim();
}
