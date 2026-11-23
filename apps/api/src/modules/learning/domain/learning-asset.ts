import {z} from 'zod';

const id=z.string().trim().min(1).max(128);
const flashcards=z.object({
 cards:z.array(z.object({
  front:z.string().trim().min(3).max(250),
  back:z.string().trim().min(3).max(700),
 }).strict()).min(2).max(30),
}).strict();
const microLesson=z.object({
 summary:z.string().trim().min(30).max(2000),
 steps:z.array(z.object({
  heading:z.string().trim().min(3).max(120),
  body:z.string().trim().min(15).max(1500),
 }).strict()).min(1).max(8),
 reviewPrompt:z.string().trim().min(8).max(400).optional(),
}).strict();

const fields=z.object({sessionId:id,title:z.string().trim().min(3).max(140)});
const flashcardDraft=fields.extend({kind:z.literal('FLASHCARDS'),content:flashcards}).strict();
const microLessonDraft=fields.extend({kind:z.literal('MICROLESSON'),content:microLesson}).strict();
export const learningAssetSchema=z.discriminatedUnion('kind',[flashcardDraft,microLessonDraft]);
export type LearningAssetDraft=z.infer<typeof learningAssetSchema>;
export type LearningAssetKind=LearningAssetDraft['kind'];
export type LearningAssetContent=LearningAssetDraft['content'];
export class InvalidLearningAsset extends Error {
 constructor(readonly details:unknown){super('Invalid Class Alive learning content');this.name='InvalidLearningAsset';}
}
export function parseLearningAsset(raw:unknown):LearningAssetDraft{
 const parsed=learningAssetSchema.safeParse(raw);
 if(!parsed.success)throw new InvalidLearningAsset(parsed.error.flatten());
 return parsed.data;
}
export function parseLearningAssetRevision(kind:LearningAssetKind,raw:unknown){
 const schema=z.object({
  title:z.string().trim().min(3).max(140),
  content:kind==='FLASHCARDS'?flashcards:microLesson,
 }).strict();
 const parsed=schema.safeParse(raw);
 if(!parsed.success)throw new InvalidLearningAsset(parsed.error.flatten());
 return parsed.data;
}
export function parseLearningContent(kind:LearningAssetKind,raw:unknown):LearningAssetContent{
 const parsed=(kind==='FLASHCARDS'?flashcards:microLesson).safeParse(raw);
 if(!parsed.success)throw new InvalidLearningAsset(parsed.error.flatten());
 return parsed.data;
}
export function parseLearningAssetId(raw:unknown):string{
 const value=id.safeParse(raw);
 if(!value.success)throw new InvalidLearningAsset(value.error.flatten());
 return value.data;
}
