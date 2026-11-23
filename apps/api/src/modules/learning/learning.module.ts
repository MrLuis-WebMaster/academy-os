import {Module} from '@nestjs/common';
import {ClassAliveController} from './presentation/class-alive.controller.js';
import {ReflectionUseCases} from './application/reflection-use-cases.js';
import {PrismaReflectionRepository} from './infrastructure/prisma-reflection-repository.js';
import {PrismaMembershipAdapter} from '../academics/infrastructure/prisma-subject-repository.js';
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
 controllers:[ClassAliveController,AiClassAliveController,ProfeSosController],
 providers:[{
    provide:ReflectionUseCases,
    useFactory:()=>new ReflectionUseCases(new PrismaReflectionRepository(),new PrismaMembershipAdapter()),
  },{
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
