import type {MembershipPort} from '../../academics/application/ports.js';
import {parseSeriesId} from '../domain/series-cancellation.js';
import type {WeeklySeriesCancellationRepository} from './series-cancellation-ports.js';

export class SeriesCancellationDenied extends Error {
 constructor(){super('Only academy managers and the assigned teacher can cancel weekly lessons');this.name='SeriesCancellationDenied';}
}
export class SeriesCancellationNotFound extends Error {
 constructor(){super('Class series does not exist in this academy');this.name='SeriesCancellationNotFound';}
}
export class CancelFutureSeriesUseCase {
 constructor(private readonly store:WeeklySeriesCancellationRepository,private readonly members:MembershipPort){}
 async execute(workspaceId:string,userId:string,raw:unknown){
  const id=parseSeriesId(raw);
  const manager=await this.members.hasAnyRole(workspaceId,userId,['OWNER','ADMIN']);
  if(!manager){
   const teacher=await this.members.hasAnyRole(workspaceId,userId,['TEACHER'])
    &&await this.store.belongsToAssignedTeacher(workspaceId,userId,id);
   if(!teacher)throw new SeriesCancellationDenied();
  }
  return this.store.cancelFuture(workspaceId,id);
 }
}
