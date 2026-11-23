import type {LearningAssetDraft,LearningAssetKind} from '../domain/learning-asset.js';
import type {TeacherNoteSnapshot} from './ports.js';
export interface AiLearningAssetsRepository{
 isAssignedTeacher(workspaceId:string,actorId:string,sessionId:string):Promise<boolean>;
 teacherNotes(workspaceId:string,sessionId:string):Promise<TeacherNoteSnapshot|null>;
 reserveDailyAttempt(workspaceId:string,actorId:string,sessionId:string,model:string):Promise<string>;
 completeDraft(workspaceId:string,actorId:string,sessionId:string,
  generationId:string,reflectionId:string,draft:LearningAssetDraft):
  Promise<{id:string;title:string;kind:LearningAssetKind;publishedAt:null}>;
 failAttempt(id:string):Promise<void>;
}
export interface LearningAssetAiProvider{
 model:string;
 available():boolean;
 propose(input:{
  kind:LearningAssetKind;notes:string;sessionTitle:string;subjectName:string;
  methodology?:TeacherNoteSnapshot['methodology'];
 }):Promise<unknown>;
}
