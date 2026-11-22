import type {MembershipPort} from '../../academics/application/ports.js';
import type {BookingReservationPort} from './booking-ports.js';
import {bookingId} from '../domain/booking-policy.js';

export class BookingAccessDenied extends Error {
  constructor(){super('Only a student in this academy can manage their reservations');this.name='BookingAccessDenied';}
}
export class BookingCourseNotAllowed extends Error {
  constructor(){super('Student must be enrolled in the course');this.name='BookingCourseNotAllowed';}
}
export class BookingMissing extends Error {
  constructor(){super('Requested booking or class was not found');this.name='BookingMissing';}
}
export class BookingCapacityConflict extends Error {
  constructor(message='Class booking status changed or no seats remain'){super(message);this.name='BookingCapacityConflict';}
}

export class BookingUseCases {
  constructor(private readonly bookings:BookingReservationPort,private readonly memberships:MembershipPort){}
  private async authorize(workspaceId:string,userId:string) {
    if(!workspaceId||!userId||!await this.memberships.hasAnyRole(workspaceId,userId,['STUDENT']))throw new BookingAccessDenied();
  }
  async reserve(workspaceId:string,userId:string,sessionId:unknown){
    await this.authorize(workspaceId,userId);
    return this.bookings.reserve(workspaceId,bookingId(sessionId),userId);
  }
  async cancel(workspaceId:string,userId:string,bookingIdValue:unknown){
    await this.authorize(workspaceId,userId);
    return this.bookings.cancel(workspaceId,bookingId(bookingIdValue),userId);
  }
}
