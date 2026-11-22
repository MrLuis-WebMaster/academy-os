import type {MembershipPort} from '../../academics/application/ports.js';
import type {SessionRescheduleRepository} from './ports.js';
import {planReschedule} from '../domain/reschedule.js';

export class SessionRescheduleDenied extends Error {
  constructor(){super('Only an owner, administrator or assigned teacher can move this lesson');this.name='SessionRescheduleDenied';}
}
export class SessionRescheduleMissing extends Error {
  constructor(){super('The confirmed class could not be found');this.name='SessionRescheduleMissing';}
}
export class SessionRescheduleConflict extends Error {
  constructor(message='Teacher unavailable or class changed since you opened it'){super(message);this.name='SessionRescheduleConflict';}
}
export class RescheduleLessonUseCase {
  constructor(private readonly sessions:SessionRescheduleRepository,private readonly members:MembershipPort){}
  async execute(workspaceId:string,actorId:string,sessionId:string,payload:unknown){
    const canManage=await this.members.hasAnyRole(workspaceId,actorId,['OWNER','ADMIN']);
    const canTeach=!canManage
      &&await this.members.hasAnyRole(workspaceId,actorId,['TEACHER'])
      &&await this.sessions.belongsToTeacher(workspaceId,actorId,sessionId);
    if(!canManage&&!canTeach)throw new SessionRescheduleDenied();
    const plan=planReschedule(payload);
    return this.sessions.reschedule(workspaceId,sessionId,actorId,plan);
  }
}
