import {Module} from '@nestjs/common';
import {PrismaMembershipAdapter} from '../academics/infrastructure/prisma-subject-repository.js';
import {RescheduleLessonUseCase} from './application/reschedule-use-case.js';
import {PrismaSessionRescheduleRepository} from './infrastructure/prisma-reschedule-repository.js';
import {RescheduleController} from './presentation/reschedule.controller.js';
import {BookingActionsController} from './presentation/booking-actions.controller.js';
import {BookingUseCases} from './application/booking-use-cases.js';
import {PrismaBookingRepository} from './infrastructure/prisma-booking-repository.js';
import {AvailabilityController} from './presentation/availability.controller.js';
import {ManageAvailabilityUseCase} from './application/manage-availability-use-case.js';
import {PrismaAvailabilityRepository} from './infrastructure/prisma-availability-repository.js';
import {TeacherTimeOffController} from './presentation/teacher-time-off.controller.js';
import {ManageTimeOffUseCase} from './application/manage-time-off-use-case.js';
import {PrismaTeacherTimeOffRepository} from './infrastructure/prisma-teacher-time-off-repository.js';

@Module({
  controllers:[RescheduleController,BookingActionsController,AvailabilityController,TeacherTimeOffController],
  providers:[{
    provide:ManageTimeOffUseCase,
    useFactory:()=>new ManageTimeOffUseCase(new PrismaTeacherTimeOffRepository(),new PrismaMembershipAdapter()),
  },{
    provide:ManageAvailabilityUseCase,
    useFactory:()=>new ManageAvailabilityUseCase(new PrismaAvailabilityRepository(),new PrismaMembershipAdapter()),
  },{
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
