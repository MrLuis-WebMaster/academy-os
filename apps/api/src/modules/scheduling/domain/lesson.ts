import {z} from 'zod';

/** Single-lesson contract shared with the legacy import path and weekly-series UI. */
export const bookingInput=z.object({
  title:z.string().trim().min(3).max(120),
  courseId:z.string().optional(),
  teacherProfileId:z.string().min(1).max(128),
  mode:z.enum(['ONLINE','ONSITE','HYBRID']),
  startsAt:z.iso.datetime({offset:true}),
  endsAt:z.iso.datetime({offset:true}),
  capacity:z.number().int().min(1).max(500).default(1),
  location:z.string().trim().max(300).optional(),
  meetingUrl:z.url().max(2048).optional(),
}).superRefine((input,ctx)=>{
  const starts=Date.parse(input.startsAt),ends=Date.parse(input.endsAt);
  if(starts>=ends)ctx.addIssue({code:'custom',path:['endsAt'],message:'End must follow start'});
  if(ends-starts>12*60*60*1000)ctx.addIssue({code:'custom',path:['endsAt'],message:'A session cannot exceed 12 hours'});
  if(input.mode!=='ONLINE'&&(!input.location||input.location.length<5)){
    ctx.addIssue({code:'custom',path:['location'],message:'Location required for onsite and hybrid sessions'});
  }
  if(input.mode!=='ONSITE'&&!input.meetingUrl){
    ctx.addIssue({code:'custom',path:['meetingUrl'],message:'Provide a meeting link until Google/Zoom OAuth integrations are connected'});
  }
  if(input.meetingUrl&&!input.meetingUrl.startsWith('https://')){
    ctx.addIssue({code:'custom',path:['meetingUrl'],message:'HTTPS meeting link required'});
  }
});
export type LessonStatus='DRAFT'|'CONFIRMED'|'COMPLETED'|'CANCELLED';
export type LessonDraft=Omit<z.infer<typeof bookingInput>,'startsAt'|'endsAt'> & {
  startsAt:Date;endsAt:Date;
};

export class InvalidLessonInput extends Error {
  constructor(readonly details:unknown){super('Invalid lesson input');this.name='InvalidLessonInput';}
}
export class LessonTeacherMismatch extends Error {
  constructor(){super('You can only manage your own lessons');this.name='LessonTeacherMismatch';}
}
export class CompletedLessonCannotBeCancelled extends Error {
  constructor(){super('Completed lessons cannot be cancelled');this.name='CompletedLessonCannotBeCancelled';}
}
export function parseLessonDraft(raw:unknown):LessonDraft {
  const parsed=bookingInput.safeParse(raw);
  if(!parsed.success)throw new InvalidLessonInput(
    parsed.error.issues.map(issue=>({path:issue.path.join('.'),message:issue.message})),
  );
  return {...parsed.data,startsAt:new Date(parsed.data.startsAt),endsAt:new Date(parsed.data.endsAt)};
}
export function parseLessonId(raw:unknown):string {
  if(typeof raw!=='string'||!raw.trim()||raw.length>128)throw new InvalidLessonInput('A valid class identifier is required');
  return raw.trim();
}
export function ensureMayCancelLesson(status:LessonStatus,actorId:string,
  teacherUserId:string|null,isManager:boolean):void {
  if(!isManager&&teacherUserId!==actorId)throw new LessonTeacherMismatch();
  if(status==='COMPLETED')throw new CompletedLessonCannotBeCancelled();
}
