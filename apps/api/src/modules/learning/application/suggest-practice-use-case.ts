import type {MembershipPort} from '../../academics/application/ports.js';
import type {AiPracticeRepository,PracticeAiProvider} from './ports.js';
import {minimizeTeachingNotes,parseSuggestion} from '../domain/suggestion.js';

export class AiPermissionDenied extends Error {
  constructor(){super('Only the assigned teacher or workspace administrators can generate practice drafts');this.name='AiPermissionDenied';}
}
export class AiNotesNotFound extends Error {
  constructor(){super('Save Class Alive notes for a course session before generating a draft');this.name='AiNotesNotFound';}
}
export class AiProviderNotConfigured extends Error {
  constructor(){super('AI suggestions are disabled until a provider is configured');this.name='AiProviderNotConfigured';}
}
export class AiQuotaReached extends Error {
  constructor(){super('Daily AI generation quota reached for this academy');this.name='AiQuotaReached';}
}
export class AiConsentRequired extends Error {
  constructor(){super('Teacher must explicitly approve sending these class notes to the configured AI provider');this.name='AiConsentRequired';}
}

export class SuggestClassPracticeUseCase {
  constructor(
    private readonly repository:AiPracticeRepository,
    private readonly members:MembershipPort,
    private readonly provider:PracticeAiProvider,
  ){}
  async execute(workspaceId:string,userId:string,sessionId:string,input:unknown) {
    const isAdmin=await this.members.hasAnyRole(workspaceId,userId,['OWNER','ADMIN']);
    const isTeacher=!isAdmin&&await this.members.hasAnyRole(workspaceId,userId,['TEACHER'])
      &&await this.repository.isAssignedTeacher(workspaceId,userId,sessionId);
    if(!isAdmin&&!isTeacher)throw new AiPermissionDenied();
    // Consent must be given on each individual action, not buried in sign-in permissions.
    if(!input||typeof input!=='object'
      ||(input as Record<string,unknown>).approveExternalProcessing!==true)throw new AiConsentRequired();
    if(!this.provider.available())throw new AiProviderNotConfigured();
    const snapshot=await this.repository.getTeacherNotes(workspaceId,sessionId);
    if(!snapshot||snapshot.notes.trim().length<10)throw new AiNotesNotFound();
    const attemptId=await this.repository.reserveDailyAttempt(workspaceId,userId,sessionId,this.provider.model);
    try{
      const generated=await this.provider.generate({
        notes:minimizeTeachingNotes(snapshot.notes),
        sessionTitle:snapshot.sessionTitle,
        subjectName:snapshot.subjectName,
        methodology:snapshot.methodology,
      });
      const suggestion=parseSuggestion(generated);
      const saved=await this.repository.completeAttempt(attemptId,suggestion,snapshot.reflectionId);
      // Returned only to the verified teacher; publishedAt remains null.
      return {...saved,questions:suggestion.questions,model:this.provider.model,reviewRequired:true};
    }catch(error){
      await this.repository.failAttempt(attemptId).catch(()=>{});
      throw error;
    }
  }
}
