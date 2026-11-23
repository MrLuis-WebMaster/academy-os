import type {MembershipPort} from '../../academics/application/ports.js';
import {buildEvidenceBasedProfile} from '../domain/learner-profile.js';
import {
  parseEvidenceInput,parseGoalInput,parseGoalStatusInput,parseProgressId,
} from '../domain/student-progress.js';
import type {StudentProgressRepository} from './student-progress-ports.js';

export class ProgressAccessDenied extends Error {
  constructor(){super('You cannot access this student progress record');this.name='ProgressAccessDenied';}
}
export class ProgressResourceMissing extends Error {
  constructor(){super('Course, topic, student or goal is not available in this academy');this.name='ProgressResourceMissing';}
}
export class ProgressConflict extends Error {
  constructor(message='Learning progress changed during this operation'){super(message);this.name='ProgressConflict';}
}
export class StudentProgressUseCases {
  constructor(private readonly progress:StudentProgressRepository,private readonly member:MembershipPort){}
  private async authorize(workspaceId:string,userId:string,student:boolean):Promise<void>{
    if(!workspaceId||!userId||!await this.member.hasAnyRole(
      workspaceId,userId,student?['STUDENT']:['OWNER','ADMIN','TEACHER'],
    ))throw new ProgressAccessDenied();
  }
  async student(workspaceId:string,userId:string){
    await this.authorize(workspaceId,userId,true);
    return this.progress.student(workspaceId,userId);
  }
  async profile(workspaceId:string,userId:string){
    const {skills,goals}=await this.student(workspaceId,userId);
    return buildEvidenceBasedProfile(skills,goals);
  }
  async course(workspaceId:string,userId:string,courseId:unknown){
    await this.authorize(workspaceId,userId,false);
    return this.progress.course(workspaceId,userId,parseProgressId(courseId));
  }
  async evidence(workspaceId:string,userId:string,raw:unknown){
    await this.authorize(workspaceId,userId,false);
    return this.progress.evidence(workspaceId,userId,parseEvidenceInput(raw));
  }
  async evidenceHistory(workspaceId:string,userId:string,topicId:unknown,studentId:unknown){
    await this.authorize(workspaceId,userId,false);
    return this.progress.evidenceHistory(
      workspaceId,userId,parseProgressId(topicId),parseProgressId(studentId),
    );
  }
  async createGoal(workspaceId:string,userId:string,raw:unknown){
    await this.authorize(workspaceId,userId,false);
    return this.progress.createGoal(workspaceId,userId,parseGoalInput(raw));
  }
  async changeGoal(workspaceId:string,userId:string,goalId:unknown,raw:unknown){
    await this.authorize(workspaceId,userId,false);
    return this.progress.changeGoal(workspaceId,userId,parseProgressId(goalId),parseGoalStatusInput(raw));
  }
}
