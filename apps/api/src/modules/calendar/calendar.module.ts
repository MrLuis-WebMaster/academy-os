import {Module} from '@nestjs/common';
import {ExportCalendarUseCase} from './application/export-calendar-use-case.js';
import {PrismaCalendarReadRepository} from './infrastructure/prisma-calendar-read-repository.js';
import {CalendarController} from './presentation/calendar.controller.js';
@Module({
 controllers:[CalendarController],
 providers:[{
  provide:ExportCalendarUseCase,
  useFactory:()=>new ExportCalendarUseCase(new PrismaCalendarReadRepository()),
 }],
})
export class CalendarModule {}
