import {Module} from '@nestjs/common';
import {PrismaMembershipAdapter} from '../academics/infrastructure/prisma-subject-repository.js';
import {RescheduleLessonUseCase} from './application/reschedule-use-case.js';
import {PrismaSessionRescheduleRepository} from './infrastructure/prisma-reschedule-repository.js';
import {RescheduleController} from './presentation/reschedule.controller.js';
import {BookingActionsController} from './presentation/booking-actions.controller.js';
import {BookingUseCases} from './application/booking-use-cases.js';
import {PrismaBookingRepository} from './infrastructure/prisma-booking-repository.js';

@Module({
  controllers:[RescheduleController,BookingActionsController],
  providers:[{
    provide:BookingUseCases,
    useFactory:()=>new BookingUseCases(new PrismaBookingRepository(),new PrismaMembershipAdapter()),
  },{
    provide:RescheduleLessonUseCase,
    useFactory:()=>new RescheduleLessonUseCase(
      new PrismaSessionRescheduleRepository(),new PrismaMembershipAdapter(),
    ),
  }],
})
export class SchedulingModule {}
