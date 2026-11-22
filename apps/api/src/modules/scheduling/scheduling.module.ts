import {Module} from '@nestjs/common';
import {PrismaMembershipAdapter} from '../academics/infrastructure/prisma-subject-repository.js';
import {RescheduleLessonUseCase} from './application/reschedule-use-case.js';
import {PrismaSessionRescheduleRepository} from './infrastructure/prisma-reschedule-repository.js';
import {RescheduleController} from './presentation/reschedule.controller.js';

@Module({
  controllers:[RescheduleController],
  providers:[{
    provide:RescheduleLessonUseCase,
    useFactory:()=>new RescheduleLessonUseCase(
      new PrismaSessionRescheduleRepository(),new PrismaMembershipAdapter(),
    ),
  }],
})
export class SchedulingModule {}
