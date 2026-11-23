import type {MembershipPort} from '../../academics/application/ports.js';
import type {StudentTutoringRepository,TutorProvider} from './tutor-ports.js';
import {tutorQuestionSchema,validatedTutorResponse} from '../domain/tutor-answer.js';
import {minimizeTeachingNotes} from '../domain/suggestion.js';
import {AiConsentRequired,AiProviderNotConfigured} from './suggest-practice-use-case.js';

export class TutorNotAllowed extends Error {
  constructor(){super('Only enrolled students can ask about this course');this.name='TutorNotAllowed';}
}
export class TutorWithoutEvidence extends Error {
  constructor(){super('No teacher-approved notes are available for this course yet');this.name='TutorWithoutEvidence';}
}
export class TutorDisabledByTeacher extends Error {
  constructor(){super('El profesor aún no ha habilitado Profe SOS para este curso');this.name='TutorDisabledByTeacher';}
}
export class InvalidTutorQuestion extends Error {
  constructor(){super('Provide a question (8–650 characters) and explicitly approve external processing');this.name='InvalidTutorQuestion';}
}
export class AskProfeSosUseCase {
  constructor(
    private readonly repository:StudentTutoringRepository,
    private readonly memberships:MembershipPort,
    private readonly provider:TutorProvider,
  ){}
  async execute(workspaceId:string,userId:string,input:unknown){
    const membership=await this.memberships.hasAnyRole(workspaceId,userId,['STUDENT']);
    if(!membership)throw new TutorNotAllowed();
    const parsed=tutorQuestionSchema.safeParse(input);
    if(!parsed.success)throw new InvalidTutorQuestion();
    const {courseId,question,approveExternalProcessing}=parsed.data;
    if(!approveExternalProcessing)throw new AiConsentRequired();
    if(!await this.repository.enrolled(workspaceId,userId,courseId))throw new TutorNotAllowed();
    const method=await this.repository.methodForCourse(workspaceId,courseId);
    if(!method.sosEnabled)throw new TutorDisabledByTeacher();
    if(!this.provider.available())throw new AiProviderNotConfigured();
    const published=await this.repository.publishedEvidence(workspaceId,courseId);
    if(!published.length)throw new TutorWithoutEvidence();
    // Strict data minimization; other students' profiles, private files, unpublished notes
    // and unapproved materials are never included in the provider request.
    const evidence=published.slice(0,6).map(x=>({
      ...x,notes:minimizeTeachingNotes(x.notes).slice(0,1800),
    }));
    const id=await this.repository.reserveDailyAttempt(workspaceId,userId,published[0]!.id,this.provider.model);
    try{
      const raw=await this.provider.answer(
        question.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[EMAIL OMITIDO]').slice(0,650),
        evidence,method,
      );
      const result=validatedTutorResponse(raw,evidence);
      await this.repository.finishAttempt(id);
      return {...result,model:this.provider.model,disclaimer:'Orientación basada en las notas aprobadas; consulta al profesor para confirmar.'};
    }catch(error){
      await this.repository.failAttempt(id).catch(()=>{});
      throw error;
    }
  }
}
