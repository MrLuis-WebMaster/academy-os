import {Module} from '@nestjs/common';
import {PrismaMembershipAdapter} from '../academics/infrastructure/prisma-subject-repository.js';
import {SuggestClassPracticeUseCase} from './application/suggest-practice-use-case.js';
import {PrismaAiPracticeRepository} from './infrastructure/prisma-ai-practice-repository.js';
import {OpenAiPracticeAdapter} from './infrastructure/openai-practice-adapter.js';
import {AiClassAliveController} from './presentation/ai-class-alive.controller.js';
import {ProfeSosController} from './presentation/profe-sos.controller.js';
import {AskProfeSosUseCase} from './application/ask-profe-sos-use-case.js';
import {PrismaStudentTutorRepository} from './infrastructure/prisma-student-tutor-repository.js';
import {OpenAiTutorAdapter} from './infrastructure/openai-tutor-adapter.js';

@Module({
 controllers:[AiClassAliveController,ProfeSosController],
 providers:[{
  provide:AskProfeSosUseCase,
  useFactory:()=>new AskProfeSosUseCase(
    new PrismaStudentTutorRepository(),new PrismaMembershipAdapter(),new OpenAiTutorAdapter(),
  ),
 },{
  provide:SuggestClassPracticeUseCase,
  useFactory:()=>new SuggestClassPracticeUseCase(
    new PrismaAiPracticeRepository(),new PrismaMembershipAdapter(),new OpenAiPracticeAdapter(),
  ),
 }],
})
export class LearningModule {}
