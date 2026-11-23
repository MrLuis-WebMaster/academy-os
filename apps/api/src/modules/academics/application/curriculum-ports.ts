import type {z} from 'zod';
import type {topicInput} from '../domain/curriculum.js';
export type TopicInput=z.infer<typeof topicInput>;
export interface TopicRow {
  id:string;title:string;parentId:string|null;order:number;
}
export interface CurriculumDetail {
  courseId:string;topics:TopicRow[];
  teachers:Array<{teacherId:string;teacher:{user:{name:string}}}>;
}
export interface CurriculumRepository {
  show(workspaceId:string,actorId:string,courseId:string):Promise<CurriculumDetail>;
  assign(workspaceId:string,actorId:string,courseId:string,teacherId:string):
    Promise<{teacherId:string;courseId:string}>;
  unassign(workspaceId:string,actorId:string,courseId:string,teacherId:string):
    Promise<{courseId:string;teacherId:string;assigned:false}>;
  createTopic(workspaceId:string,actorId:string,courseId:string,input:TopicInput):
    Promise<TopicRow & {courseId:string}>;
}
