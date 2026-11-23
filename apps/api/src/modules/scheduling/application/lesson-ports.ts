import type {LessonDraft,LessonStatus} from '../domain/lesson.js';

export type LessonMode='ONLINE'|'ONSITE'|'HYBRID';
export interface LessonListRow {
  id:string;title:string;status:LessonStatus;mode:LessonMode;
  startsAt:Date;endsAt:Date;location:string|null;meetingUrl:string|null;capacity:number;
  teacherProfileId:string|null;courseId:string|null;seriesId:string|null;seriesIndex:number|null;
  roomId:string|null;
}
export interface CreatedLesson {
  id:string;title:string;mode:LessonMode;startsAt:Date;endsAt:Date;status:LessonStatus;
}
export interface CancelledLesson {
  id:string;status:'CANCELLED';inAppNotificationsCreated:number;
}
export interface LessonRepository {
  /** Enforces current membership and teacher scope again while reading from storage. */
  list(workspaceId:string,actorId:string):Promise<LessonListRow[]>;
  /** Serializes on teacher lock and validates current roles/references/availability inside transaction. */
  create(workspaceId:string,actorId:string,plan:LessonDraft):Promise<CreatedLesson>;
  /** Booking lock then teacher lock; status/ownership + notifications are transactional. */
  cancel(workspaceId:string,actorId:string,lessonId:string):Promise<CancelledLesson>;
}
