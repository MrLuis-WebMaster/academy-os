import { z } from 'zod';

export const questionSchema=z.object({
  prompt:z.string().trim().min(8).max(500),
  options:z.array(z.string().trim().min(1).max(180)).length(4),
  correctIndex:z.number().int().min(0).max(3),
  explanation:z.string().trim().max(500).optional(),
});
export const questionSetSchema=z.array(questionSchema).min(1).max(10);
export const newPracticeSchema=z.object({
  sessionId:z.string().min(1),
  title:z.string().trim().min(3).max(120),
  questions:questionSetSchema,
});
export const attemptSchema=z.object({
  answers:z.array(z.number().int().min(0).max(3)).min(1).max(10),
});
export type QuizQuestion=z.infer<typeof questionSchema>;

export function gradePractice(questions:QuizQuestion[], answers:number[]) {
  if(questions.length!==answers.length)throw new Error('Answer count mismatch');
  const matches=questions.map((question,index)=>question.correctIndex===answers[index]);
  const correct=matches.filter(Boolean).length;
  return {
    correct,total:questions.length,score:Math.round(100*correct/questions.length),
    feedback:questions.map((q,i)=>({correct:matches[i],correctIndex:q.correctIndex,explanation:q.explanation??''})),
  };
}
export function publicQuestions(questions:QuizQuestion[]) {
  return questions.map(({prompt,options})=>({prompt,options}));
}

export class InvalidPracticeInput extends Error {
  constructor(readonly details:unknown){super('Invalid practice input');this.name='InvalidPracticeInput';}
}
export function parsePracticeDraft(raw:unknown) {
  const parsed=newPracticeSchema.safeParse(raw);
  if(!parsed.success)throw new InvalidPracticeInput(parsed.error.flatten());
  return parsed.data;
}
export function parsePracticeRevision(raw:unknown) {
  const parsed=newPracticeSchema.pick({title:true,questions:true}).safeParse(raw);
  if(!parsed.success)throw new InvalidPracticeInput(parsed.error.flatten());
  return parsed.data;
}
export function parseAttempt(raw:unknown) {
  const parsed=attemptSchema.safeParse(raw);
  if(!parsed.success)throw new InvalidPracticeInput(parsed.error.flatten());
  return parsed.data;
}
export function parsePracticeId(raw:unknown):string {
  if(typeof raw!=='string'||!raw.trim()||raw.length>128)
    throw new InvalidPracticeInput('A valid practice identifier is required');
  return raw.trim();
}
