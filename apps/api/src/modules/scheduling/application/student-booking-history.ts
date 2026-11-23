import type {MembershipPort} from '../../academics/application/ports.js';

export class BookingHistoryAccessDenied extends Error {
  constructor(){super('Only enrolled students may access their private reservation history');this.name='BookingHistoryAccessDenied';}
}
export interface StudentBookingHistoryRepository {
  mine(workspaceId:string,actorId:string):Promise<unknown[]>;
}
export class StudentBookingHistoryUseCase {
  constructor(
    private readonly history:StudentBookingHistoryRepository,
    private readonly members:MembershipPort,
  ){}
  async execute(workspaceId:string,actorId:string){
    if(!workspaceId||!actorId||!await this.members.hasAnyRole(workspaceId,actorId,['STUDENT'])){
      throw new BookingHistoryAccessDenied();
    }
    return this.history.mine(workspaceId,actorId);
  }
}
