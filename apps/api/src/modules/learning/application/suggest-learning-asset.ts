import {z} from 'zod';
import type {MembershipPort} from '../../academics/application/ports.js';
import {parseLearningAsset,InvalidLearningAsset} from '../domain/learning-asset.js';
import {minimizeTeachingNotes} from '../domain/suggestion.js';
import {
 AiConsentRequired,AiNotesNotFound,AiPermissionDenied,AiProviderNotConfigured,
} from './suggest-practice-use-case.js';
import type {AiLearningAssetsRepository,LearningAssetAiProvider} from './ai-learning-asset-ports.js';

export class AiLearningAssetInvalid extends Error{
 constructor(){super('Choose a valid learning format and explicitly authorize external AI processing');this.name='AiLearningAssetInvalid';}
}
export class AiLearningAssetOutputInvalid extends Error{
 constructor(){super('The AI provider returned an invalid study-resource draft');this.name='AiLearningAssetOutputInvalid';}
}
const request=z.object({
 kind:z.enum(['FLASHCARDS','MICROLESSON']),
 approveExternalProcessing:z.literal(true),
}).strict();

export class SuggestLearningAssetUseCase{
 constructor(
  private readonly repository:AiLearningAssetsRepository,
  private readonly members:MembershipPort,
  private readonly provider:LearningAssetAiProvider,
 ){}
 async execute(workspaceId:string,actorId:string,sessionId:string,raw:unknown){
  const manager=await this.members.hasAnyRole(workspaceId,actorId,['OWNER','ADMIN']);
  const teacher=!manager&&await this.members.hasAnyRole(workspaceId,actorId,['TEACHER'])
   &&await this.repository.isAssignedTeacher(workspaceId,actorId,sessionId);
  if(!manager&&!teacher)throw new AiPermissionDenied();
  if(!raw||typeof raw!=='object'
   ||(raw as Record<string,unknown>).approveExternalProcessing!==true){
   throw new AiConsentRequired();
  }
  const parsed=request.safeParse(raw);
  if(!parsed.success)throw new AiLearningAssetInvalid();
  if(!this.provider.available())throw new AiProviderNotConfigured();
  const snapshot=await this.repository.teacherNotes(workspaceId,sessionId);
  if(!snapshot||snapshot.notes.trim().length<10)throw new AiNotesNotFound();
  const generationId=await this.repository.reserveDailyAttempt(
   workspaceId,actorId,sessionId,this.provider.model,
  );
  try{
   const suggestion=await this.provider.propose({
    kind:parsed.data.kind,sessionTitle:snapshot.sessionTitle,
    subjectName:snapshot.subjectName,
    notes:minimizeTeachingNotes(snapshot.notes),methodology:snapshot.methodology,
   });
   let draft;
   try{
    if(!suggestion||typeof suggestion!=='object')throw new AiLearningAssetOutputInvalid();
    draft=parseLearningAsset({
     ...suggestion,kind:parsed.data.kind,sessionId,
    });
   }catch(error){
    if(error instanceof InvalidLearningAsset)throw new AiLearningAssetOutputInvalid();
    throw error;
   }
   const saved=await this.repository.completeDraft(
    workspaceId,actorId,sessionId,generationId,snapshot.reflectionId,draft,
   );
   return {...saved,model:this.provider.model,reviewRequired:true};
  }catch(error){
   await this.repository.failAttempt(generationId).catch(()=>{});
   throw error;
  }
 }
}
