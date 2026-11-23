import {z} from 'zod';

export const topicInput=z.object({
  title:z.string().trim().min(2).max(140),
  parentId:z.string().min(1).nullable().optional(),
  order:z.number().int().min(0).max(9999).default(0),
});
export const assignmentInput=z.object({teacherId:z.string().min(1)});
export class InvalidCurriculumInput extends Error {
  constructor(readonly details:unknown){super('Invalid curriculum input');this.name='InvalidCurriculumInput';}
}
export function parseTopic(raw:unknown){
  const parsed=topicInput.safeParse(raw);
  if(!parsed.success)throw new InvalidCurriculumInput(parsed.error.flatten());
  return parsed.data;
}
export function parseAssignment(raw:unknown){
  const parsed=assignmentInput.safeParse(raw);
  if(!parsed.success)throw new InvalidCurriculumInput(parsed.error.flatten());
  return parsed.data.teacherId;
}
export function parseCurriculumId(raw:unknown):string{
  if(typeof raw!=='string'||!raw.trim()||raw.length>128)throw new InvalidCurriculumInput('Invalid identifier');
  return raw.trim();
}
