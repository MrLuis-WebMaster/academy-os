import type {QuizQuestion} from '../domain/practice.js';

export interface PracticeDraft {
  sessionId:string;title:string;questions:QuizQuestion[];
}
export interface PracticeRevision {
  title:string;questions:QuizQuestion[];
}
export interface PracticeCreateResult {
  id:string;title:string;publishedAt:Date|null;
}
export interface PracticeRevisionResult extends PracticeCreateResult {
  questions:unknown;
}
export interface TeacherPracticeRow extends PracticeRevisionResult {
  reflection:{
    sessionId:string;status:'DRAFT'|'REVIEW'|'PUBLISHED';
    session:{title:string;courseId:string|null};
  };
  _count:{attempts:number};
}
export interface StudentPracticeRow {
  id:string;title:string;
  questions:Array<{prompt:string;options:string[]}>;
  courseId:string|null;sessionTitle:string;
  lastAttempt:{id:string;score:number|null;createdAt:Date}|null;
}
export interface PracticeAttemptResult {
  id:string;createdAt:Date;correct:number;total:number;score:number;
  feedback:Array<{correct:boolean;correctIndex:number;explanation:string}>;
  attemptNumber:number;
}
export interface PassportRow {
  courseId:string;title:string;subject:string;
  attempts:number;averageScore:number|null;metric:string;
}
export interface PracticeRepository {
  create(workspaceId:string,actorId:string,draft:PracticeDraft):Promise<PracticeCreateResult>;
  listTeacher(workspaceId:string,actorId:string):Promise<TeacherPracticeRow[]>;
  revise(workspaceId:string,actorId:string,activityId:string,draft:PracticeRevision):Promise<PracticeRevisionResult>;
  publish(workspaceId:string,actorId:string,activityId:string):Promise<{id:string;publishedAt:Date|null}>;
  listStudent(workspaceId:string,actorId:string):Promise<StudentPracticeRow[]>;
  submit(workspaceId:string,actorId:string,activityId:string,answers:number[]):Promise<PracticeAttemptResult>;
  passport(workspaceId:string,actorId:string):Promise<PassportRow[]>;
}
