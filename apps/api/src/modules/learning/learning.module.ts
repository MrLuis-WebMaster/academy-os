import {Module} from '@nestjs/common';
import {TeachingMethodologyController} from './presentation/methodology.controller.js';
import {TeacherMethodologyUseCases} from './application/methodology-use-cases.js';
import {PrismaMethodologyRepository} from './infrastructure/prisma-methodology-repository.js';
import {StudentProgressController} from './presentation/student-progress.controller.js';
import {StudentProgressUseCases} from './application/student-progress-use-cases.js';
import {PrismaStudentProgressRepository} from './infrastructure/prisma-student-progress-repository.js';
import {PracticeController} from './presentation/practice.controller.js';
import {PracticeUseCases} from './application/practice-use-cases.js';
import {PrismaPracticeRepository} from './infrastructure/prisma-practice-repository.js';
import {ClassAliveController} from './presentation/class-alive.controller.js';
import {ReflectionUseCases} from './application/reflection-use-cases.js';
import {PrismaReflectionRepository} from './infrastructure/prisma-reflection-repository.js';
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
 controllers:[TeachingMethodologyController,StudentProgressController,PracticeController,ClassAliveController,AiClassAliveController,ProfeSosController],
 providers:[{
  provide:TeacherMethodologyUseCases,
  useFactory:()=>new TeacherMethodologyUseCases(new PrismaMethodologyRepository(),new PrismaMembershipAdapter()),
 },{
  provide:StudentProgressUseCases,
  useFactory:()=>new StudentProgressUseCases(new PrismaStudentProgressRepository(),new PrismaMembershipAdapter()),
 },{
  provide:PracticeUseCases,
  useFactory:()=>new PracticeUseCases(new PrismaPracticeRepository(),new PrismaMembershipAdapter()),
 },{
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
