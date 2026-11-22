import {z} from 'zod';

/** Teacher-facing suggestion only. Nothing is published until a human approves it. */
export const aiSuggestionSchema=z.object({
  title:z.string().trim().min(3).max(120),
  questions:z.array(z.object({
    prompt:z.string().trim().min(8).max(500),
    options:z.array(z.string().trim().min(1).max(180)).length(4),
    correctIndex:z.number().int().min(0).max(3),
    explanation:z.string().trim().max(500),
  })).min(2).max(4),
});
export type PracticeSuggestion=z.infer<typeof aiSuggestionSchema>;
export class AiSuggestionInvalid extends Error {
  constructor(message='The AI provider returned an invalid practice draft') {
    super(message);this.name='AiSuggestionInvalid';
  }
}
export function parseSuggestion(input:unknown):PracticeSuggestion {
  const result=aiSuggestionSchema.safeParse(input);
  if(!result.success)throw new AiSuggestionInvalid();
  return result.data;
}

/** Best-effort data minimization. Teachers must still remove student identities manually. */
export function minimizeTeachingNotes(notes:string){
  return notes
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[EMAIL OMITIDO]')
    .replace(/\+?\d[\d\s().-]{8,}\d/g,'[TELÉFONO OMITIDO]')
    .trim().slice(0,4000);
}
