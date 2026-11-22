import type {CourseEvidence} from '../domain/tutor-answer.js';
export interface StudentTutoringRepository {
  enrolled(workspaceId:string,userId:string,courseId:string):Promise<boolean>;
  publishedEvidence(workspaceId:string,courseId:string):Promise<CourseEvidence[]>;
  reserveDailyAttempt(workspaceId:string,userId:string,sessionId:string,model:string):Promise<string>;
  finishAttempt(id:string):Promise<void>;
  failAttempt(id:string):Promise<void>;
}
export interface TutorProvider {
  model:string;
  available():boolean;
  answer(question:string,evidence:CourseEvidence[]):Promise<unknown>;
}
