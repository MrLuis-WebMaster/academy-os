/** Course input value object and invariants, independent of persistence and HTTP. */
export class InvalidCourseDetails extends Error {
  constructor(message = 'Course title must contain 3–120 characters') {
    super(message);
    this.name = 'InvalidCourseDetails';
  }
}
export interface CourseDraft {
  title: string;
  summary?: string;
  subjectId?: string;
}
export function createCourseDraft(raw: unknown): CourseDraft {
  if (!raw || typeof raw !== 'object') throw new InvalidCourseDetails();
  const record=raw as Record<string,unknown>;
  if(typeof record.title!=='string')throw new InvalidCourseDetails();
  const title=record.title.trim().replace(/\s+/g,' ');
  if(title.length<3||title.length>120)throw new InvalidCourseDetails();
  if(record.summary!==undefined&&(typeof record.summary!=='string'||record.summary.trim().length>2000)){
    throw new InvalidCourseDetails('Course summary must not exceed 2000 characters');
  }
  if(record.subjectId!==undefined&&(typeof record.subjectId!=='string'||!record.subjectId.trim())){
    throw new InvalidCourseDetails('A valid subject identifier is required');
  }
  return {
    title,
    ...(typeof record.summary==='string'?{summary:record.summary.trim()}:{}),
    ...(typeof record.subjectId==='string'?{subjectId:record.subjectId}:{}),
  };
}
