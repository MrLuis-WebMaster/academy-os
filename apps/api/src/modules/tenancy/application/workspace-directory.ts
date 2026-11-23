import type {MembershipPort,WorkspaceRole} from '../../academics/application/ports.js';

export class DirectoryAccessDenied extends Error {
  constructor(){super('You cannot access this academy directory');this.name='DirectoryAccessDenied';}
}
export interface AcademyPerson {
  role:WorkspaceRole;
  user:{id:string;name:string;email:string;image:string|null};
}
export interface AcademyTeacher {
  id:string;bio:string|null;userId:string;
  user:{name:string;image:string|null};
}
export interface WorkspaceDirectoryRepository {
  people(workspaceId:string,actorId:string):Promise<AcademyPerson[]>;
  teachers(workspaceId:string,actorId:string):Promise<AcademyTeacher[]>;
}
export class WorkspaceDirectoryUseCases {
  constructor(private readonly directory:WorkspaceDirectoryRepository,private readonly members:MembershipPort){}
  private async authorize(workspaceId:string,actorId:string,roles:readonly WorkspaceRole[]){
    if(!workspaceId||!actorId||!await this.members.hasAnyRole(workspaceId,actorId,roles)){
      throw new DirectoryAccessDenied();
    }
  }
  async people(workspaceId:string,actorId:string){
    await this.authorize(workspaceId,actorId,['OWNER','ADMIN']);
    return this.directory.people(workspaceId,actorId);
  }
  async teachers(workspaceId:string,actorId:string){
    await this.authorize(workspaceId,actorId,['OWNER','ADMIN','TEACHER']);
    return this.directory.teachers(workspaceId,actorId);
  }
}
