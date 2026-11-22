import {Module} from '@nestjs/common';
import {PrismaMembershipAdapter} from '../academics/infrastructure/prisma-subject-repository.js';
import {SuggestClassPracticeUseCase} from './application/suggest-practice-use-case.js';
import {PrismaAiPracticeRepository} from './infrastructure/prisma-ai-practice-repository.js';
import {OpenAiPracticeAdapter} from './infrastructure/openai-practice-adapter.js';
import {AiClassAliveController} from './presentation/ai-class-alive.controller.js';

@Module({
 controllers:[AiClassAliveController],
 providers:[{
  provide:SuggestClassPracticeUseCase,
  useFactory:()=>new SuggestClassPracticeUseCase(
    new PrismaAiPracticeRepository(),new PrismaMembershipAdapter(),new OpenAiPracticeAdapter(),
  ),
 }],
})
export class LearningModule {}
