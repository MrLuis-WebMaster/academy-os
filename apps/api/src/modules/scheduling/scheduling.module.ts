import {Module} from '@nestjs/common';
import {StudentBookingsController} from './presentation/student-bookings.controller.js';
import {StudentBookingHistoryUseCase} from './application/student-booking-history.js';
import {PrismaStudentBookingHistory} from './infrastructure/prisma-student-booking-history.js';
import {LessonsController} from './presentation/lessons.controller.js';
import {LessonUseCases} from './application/lesson-use-cases.js';
import {PrismaLessonRepository} from './infrastructure/prisma-lesson-repository.js';
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
import {WeeklySeriesController} from './presentation/weekly-series.controller.js';
import {CreateWeeklySeriesUseCase} from './application/create-weekly-series-use-case.js';
import {PrismaWeeklySeriesRepository} from './infrastructure/prisma-weekly-series-repository.js';
import {SeriesCancellationController} from './presentation/series-cancellation.controller.js';
import {CancelFutureSeriesUseCase} from './application/cancel-future-series-use-case.js';
import {PrismaWeeklySeriesCancellationRepository} from './infrastructure/prisma-series-cancellation-repository.js';

@Module({
  controllers:[StudentBookingsController,LessonsController,RescheduleController,BookingActionsController,AvailabilityController,TeacherTimeOffController,WeeklySeriesController,SeriesCancellationController],
  providers:[{
    provide:StudentBookingHistoryUseCase,
    useFactory:()=>new StudentBookingHistoryUseCase(new PrismaStudentBookingHistory(),new PrismaMembershipAdapter()),
  },{
    provide:LessonUseCases,
    useFactory:()=>new LessonUseCases(new PrismaLessonRepository(),new PrismaMembershipAdapter()),
  },{
    provide:CancelFutureSeriesUseCase,
    useFactory:()=>new CancelFutureSeriesUseCase(new PrismaWeeklySeriesCancellationRepository(),new PrismaMembershipAdapter()),
  },{
    provide:CreateWeeklySeriesUseCase,
    useFactory:()=>new CreateWeeklySeriesUseCase(new PrismaWeeklySeriesRepository(),new PrismaMembershipAdapter()),
  },{
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
