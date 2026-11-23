import type {MembershipPort} from '../../academics/application/ports.js';

export class StudentClassroomAccessDenied extends Error {
  constructor(){super('Only students can access their own enrolled classroom');this.name='StudentClassroomAccessDenied';}
}
export interface ClassroomEnrollment {
  id:string;
  course:{
    id:string;title:string;summary:string|null;
    subject:{name:string}|null;
    resources:Array<{id:string;title:string;source:string;url:string|null}>;
    sessions:Array<{
      id:string;title:string;startsAt:Date;endsAt:Date;seriesId:string|null;seriesIndex:number|null;
      mode:'ONLINE'|'ONSITE'|'HYBRID';location:string|null;meetingUrl:string|null;
    }>;
  };
}
export interface StudentClassroomReadRepository {
  forStudent(workspaceId:string,actorId:string):Promise<ClassroomEnrollment[]>;
}
export class StudentClassroomUseCases {
  constructor(private readonly classroom:StudentClassroomReadRepository,private readonly members:MembershipPort){}
  async list(workspaceId:string,actorId:string){
    if(!workspaceId||!actorId||!await this.members.hasAnyRole(workspaceId,actorId,['STUDENT'])){
      throw new StudentClassroomAccessDenied();
    }
    return this.classroom.forStudent(workspaceId,actorId);
  }
}
