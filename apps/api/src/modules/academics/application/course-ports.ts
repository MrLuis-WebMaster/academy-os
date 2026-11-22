import type { CourseDraft } from '../domain/course-draft.js';

export interface CourseListItem {
  id:string;title:string;summary:string|null;published:boolean;subjectId:string|null;
  subject:{id:string;name:string}|null;
}
export interface CourseCreated {
  id:string;title:string;summary:string|null;subjectId:string|null;
}
export interface CourseRepository {
  listByWorkspace(workspaceId:string):Promise<CourseListItem[]>;
  subjectExists(workspaceId:string,subjectId:string):Promise<boolean>;
  create(workspaceId:string, draft:CourseDraft):Promise<CourseCreated>;
}
