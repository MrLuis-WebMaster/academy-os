import {Module} from '@nestjs/common';
import {PrismaMembershipAdapter} from '../academics/infrastructure/prisma-subject-repository.js';
import {AttendanceUseCases} from './application/attendance-use-cases.js';
import {PrismaAttendanceRepository} from './infrastructure/prisma-attendance-repository.js';
import {AttendanceController} from './presentation/attendance.controller.js';

@Module({
  controllers:[AttendanceController],
  providers:[{
    provide:AttendanceUseCases,
    useFactory:()=>new AttendanceUseCases(new PrismaAttendanceRepository(),new PrismaMembershipAdapter()),
  }],
})
export class AttendanceModule {}
