import type {PracticeSuggestion} from '../domain/suggestion.js';
export interface TeacherNoteSnapshot {
  reflectionId:string;notes:string;sessionTitle:string;subjectName:string;
}
export interface AiPracticeRepository {
  isAssignedTeacher(workspaceId:string,userId:string,sessionId:string):Promise<boolean>;
  getTeacherNotes(workspaceId:string,sessionId:string):Promise<TeacherNoteSnapshot|null>;
  reserveDailyAttempt(workspaceId:string,userId:string,sessionId:string,model:string):Promise<string>;
  completeAttempt(id:string,generated:{title:string;questions:PracticeSuggestion['questions']},reflectionId:string):Promise<{id:string;title:string;publishedAt:null}>;
  failAttempt(id:string):Promise<void>;
}
export interface PracticeAiProvider {
  model:string;
  available():boolean;
  generate(input:{notes:string;sessionTitle:string;subjectName:string}):Promise<unknown>;
}
