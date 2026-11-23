import {z} from 'zod';

const id=z.string().trim().min(1).max(128);
export const evidenceInputSchema=z.object({
  topicId:id,
  studentUserId:id,
  requestId:z.uuid(),
  score:z.number().int().min(0).max(100),
  note:z.string().trim().min(10).max(1500),
});
export const goalInputSchema=z.object({
  courseId:id,
  studentUserId:id,
  topicId:id.optional(),
  title:z.string().trim().min(3).max(140),
  description:z.string().trim().max(1200).optional(),
  targetMastery:z.number().int().min(1).max(100).optional(),
  targetAt:z.iso.datetime({offset:true}).optional(),
}).superRefine((input,ctx)=>{
  if(input.targetAt&&Date.parse(input.targetAt)<=Date.now()){
    ctx.addIssue({code:'custom',path:['targetAt'],message:'Goal target date must be in the future'});
  }
});
export const goalStatusInputSchema=z.object({
  status:z.enum(['ACHIEVED','CANCELLED']),
  reason:z.string().trim().min(5).max(300),
});
export type EvidenceInput=z.infer<typeof evidenceInputSchema>;
export type GoalInput=z.infer<typeof goalInputSchema>;
export type GoalStatusInput=z.infer<typeof goalStatusInputSchema>;
export class InvalidStudentProgress extends Error {
  constructor(readonly details:unknown){super('Invalid learning progress input');this.name='InvalidStudentProgress';}
}
function parse<T>(schema:z.ZodType<T>,value:unknown):T{
  const result=schema.safeParse(value);
  if(!result.success)throw new InvalidStudentProgress(result.error.flatten());
  return result.data;
}
export const parseEvidenceInput=(value:unknown)=>parse(evidenceInputSchema,value);
export const parseGoalInput=(value:unknown)=>parse(goalInputSchema,value);
export const parseGoalStatusInput=(value:unknown)=>parse(goalStatusInputSchema,value);
export function parseProgressId(value:unknown):string{
  return parse(id,value);
}
export function aggregateSkillMastery(scores:readonly number[]){
  if(!scores.length)return {mastery:0,evidenceCount:0};
  if(scores.some(score=>!Number.isInteger(score)||score<0||score>100)){
    throw new InvalidStudentProgress('Evidence scores must be integer percentages');
  }
  return {
    mastery:Math.round(scores.reduce((total,score)=>total+score,0)/scores.length),
    evidenceCount:scores.length,
  };
}
