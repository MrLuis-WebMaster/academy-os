import {z} from 'zod';

/** Notes are authored and approved by a human educator; AI cannot auto-publish. */
export const noteInput=z.object({notes:z.string().trim().min(10).max(12000)});

export class InvalidClassReflection extends Error {
  constructor(readonly details:unknown){super('Please provide between 10 and 12000 characters of notes');this.name='InvalidClassReflection';}
}
export class InvalidReflectionSessionId extends Error {
  constructor(){super('A valid lesson identifier is required');this.name='InvalidReflectionSessionId';}
}
export function parseReflectionNotes(raw:unknown):string {
  const parsed=noteInput.safeParse(raw);
  if(!parsed.success)throw new InvalidClassReflection(parsed.error.flatten());
  return parsed.data.notes;
}
export function parseReflectionSessionId(raw:unknown):string {
  if(typeof raw!=='string'||!raw.trim()||raw.length>128)throw new InvalidReflectionSessionId();
  return raw.trim();
}
