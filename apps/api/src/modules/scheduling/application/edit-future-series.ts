import type {MembershipPort} from '../../academics/application/ports.js';
import {parseSeriesId} from '../domain/series-cancellation.js';
import {parseFutureSeriesEdit} from '../domain/series-edit.js';
import type {FutureSeriesEdit} from '../domain/series-edit.js';

export interface SeriesEditReceipt {
  seriesId:string;
  updatedSessions:number;
  affectedBookings:number;
  inAppNotificationsCreated:number;
  historicalSessionsPreserved:true;
}
export interface SeriesEditRepository {
  editFuture(workspaceId:string,actorId:string,seriesId:string,input:FutureSeriesEdit):Promise<SeriesEditReceipt>;
}
export class SeriesEditDenied extends Error {
  constructor(){super('Only academy managers and the assigned teacher can update weekly lessons');this.name='SeriesEditDenied';}
}
export class SeriesEditNotFound extends Error {
  constructor(){super('Weekly class series not found in this academy');this.name='SeriesEditNotFound';}
}
export class SeriesEditConflict extends Error {
  constructor(message='Future sessions cannot be changed due to a conflict'){
    super(message);this.name='SeriesEditConflict';
  }
}
export class EditFutureSeriesUseCase {
  constructor(private readonly repository:SeriesEditRepository,private readonly members:MembershipPort){}
  async execute(workspaceId:string,actorId:string,seriesId:unknown,raw:unknown){
    if(!workspaceId||!actorId||!await this.members.hasAnyRole(workspaceId,actorId,['OWNER','ADMIN','TEACHER'])){
      throw new SeriesEditDenied();
    }
    return this.repository.editFuture(workspaceId,actorId,parseSeriesId(seriesId),parseFutureSeriesEdit(raw));
  }
}
