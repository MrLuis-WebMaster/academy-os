import type {MembershipPort} from '../../academics/application/ports.js';
import {parseSeriesId} from '../domain/series-cancellation.js';
import type {SeriesBookingRepository} from './series-booking-ports.js';

export class SeriesBookingAccessDenied extends Error {
  constructor(){super('Only students in the academy can book a weekly series');this.name='SeriesBookingAccessDenied';}
}
export class SeriesBookingNotFound extends Error {
  constructor(){super('Weekly class series does not exist in this academy');this.name='SeriesBookingNotFound';}
}
export class SeriesBookingConflict extends Error {
  constructor(message='No future places are available across the entire series'){super(message);this.name='SeriesBookingConflict';}
}
export class SeriesBookingNotEnrolled extends Error {
  constructor(){super('You must be enrolled in the course to reserve this series');this.name='SeriesBookingNotEnrolled';}
}
export class SeriesBookingUseCases {
  constructor(private readonly repo:SeriesBookingRepository,private readonly membership:MembershipPort){}
  private async authorize(workspaceId:string,userId:string){
    if(!workspaceId||!userId||!await this.membership.hasAnyRole(workspaceId,userId,['STUDENT']))
      throw new SeriesBookingAccessDenied();
  }
  async reserve(workspaceId:string,userId:string,seriesId:unknown){
    await this.authorize(workspaceId,userId);
    return this.repo.reserveFuture(workspaceId,userId,parseSeriesId(seriesId));
  }
  async cancelFuture(workspaceId:string,userId:string,seriesId:unknown){
    await this.authorize(workspaceId,userId);
    return this.repo.cancelFuture(workspaceId,userId,parseSeriesId(seriesId));
  }
}
