import type {EvidenceInput,GoalInput,GoalStatusInput} from '../domain/student-progress.js';

export interface VerifiedSkillEvidence {
  id:string;topicId:string;studentUserId:string;score:number;note:string;
  createdAt:Date;mastery:number;evidenceCount:number;
}
export interface LearningGoalRow {
  id:string;courseId:string;topicId:string|null;studentUserId:string;
  title:string;description:string|null;targetMastery:number|null;targetAt:Date|null;
  status:'ACTIVE'|'ACHIEVED'|'CANCELLED';createdAt:Date;completedAt:Date|null;
}
export interface StudentSkillSummary {
  topicId:string;mastery:number;evidenceCount:number;
  topic:{title:string;courseId:string;course:{title:string}};
}
export interface StudentGoalSummary extends LearningGoalRow {
  course:{title:string};topic:{title:string}|null;
}
export interface StudentProgressView {
  skills:StudentSkillSummary[];goals:StudentGoalSummary[];
}
export interface CourseProgressView {
  courseId:string;
  topics:Array<{id:string;title:string;order:number}>;
  students:Array<{
    id:string;name:string;
    skills:Array<{topicId:string;mastery:number;evidenceCount:number}>;
    goals:LearningGoalRow[];
  }>;
}
export interface SkillEvidenceRow {
  id:string;score:number;note:string;createdAt:Date;
  reviewer:{name:string};
}
export interface StudentProgressRepository {
  student(workspaceId:string,userId:string):Promise<StudentProgressView>;
  course(workspaceId:string,actorId:string,courseId:string):Promise<CourseProgressView>;
  evidence(workspaceId:string,actorId:string,input:EvidenceInput):Promise<VerifiedSkillEvidence>;
  evidenceHistory(workspaceId:string,actorId:string,topicId:string,studentId:string):Promise<SkillEvidenceRow[]>;
  createGoal(workspaceId:string,actorId:string,input:GoalInput):Promise<LearningGoalRow>;
  changeGoal(workspaceId:string,actorId:string,goalId:string,input:GoalStatusInput):Promise<LearningGoalRow>;
}
