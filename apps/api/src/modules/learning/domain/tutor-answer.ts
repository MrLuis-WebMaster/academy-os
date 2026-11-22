import {z} from 'zod';
export const tutorResponseSchema=z.object({
  answer:z.string().trim().min(5).max(2500),
  evidenceIds:z.array(z.string()).max(6),
  referToTeacher:z.boolean(),
});
export const tutorQuestionSchema=z.object({
  courseId:z.string().min(1),
  question:z.string().trim().min(8).max(650),
  approveExternalProcessing:z.literal(true),
});
export type TutorAnswer=z.infer<typeof tutorResponseSchema>;
export type CourseEvidence={id:string;title:string;notes:string};

export function validatedTutorResponse(raw:unknown,sources:CourseEvidence[]){
  const data=tutorResponseSchema.parse(raw);
  const allowed=new Set(sources.map(x=>x.id));
  const evidenceIds=[...new Set(data.evidenceIds.filter(id=>allowed.has(id)))];
  return {
    answer:data.answer,
    sources:sources.filter(x=>evidenceIds.includes(x.id)).map(x=>({id:x.id,title:x.title})),
    referToTeacher:data.referToTeacher||!evidenceIds.length,
  };
}
